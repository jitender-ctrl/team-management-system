const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");
const { notify, extractMentionedUsers } = require("../utils/notify");
const { logActivity } = require("../utils/activityLog");
const { canAssignTo } = require("../utils/hierarchy");
const { checkWorkloadCapacity } = require("../utils/workload");

async function listTasksByProject(req, res) {
  const { projectId } = req.params;
  const tasks = await prisma.task.findMany({
    where: { projectId: Number(projectId) },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      assignedBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      status: true,
      _count: { select: { comments: true } },
    },
    orderBy: [{ statusId: "asc" }, { order: "asc" }],
  });
  return ok(res, tasks);
}

// All tasks with a due date in a given range, across every project the
// current user can see — powers the Calendar view. `start`/`end` are ISO
// date strings; defaults to the current month if omitted.
async function listTasksForCalendar(req, res) {
  const now = new Date();
  const start = req.query.start ? new Date(req.query.start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = req.query.end ? new Date(req.query.end) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const tasks = await prisma.task.findMany({
    where: { dueDate: { gte: start, lte: end } },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      status: { select: { name: true, isDone: true } },
    },
    orderBy: { dueDate: "asc" },
  });
  return ok(res, tasks);
}
async function listMyTasks(req, res) {
  const tasks = await prisma.task.findMany({
    where: { assigneeId: req.user.id },
    include: {
      project: { select: { id: true, name: true } },
      status: true,
      assignedBy: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
  });
  return ok(res, tasks);
}

async function getTask(req, res) {
  const { id } = req.params;
  const task = await prisma.task.findUnique({
    where: { id: Number(id) },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      createdBy: { select: { id: true, name: true } },
      assignedBy: { select: { id: true, name: true } },
      status: true,
      comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!task) return fail(res, 404, "Task not found");
  return ok(res, task);
}

async function createTask(req, res) {
  try {
    const { projectId } = req.params;
    const { title, description, statusId, priority, assigneeId, dueDate } = req.body;
    if (!title) return fail(res, 400, "title is required");

    let finalStatusId = statusId ? Number(statusId) : null;
    if (!finalStatusId) {
      const defaultStatus = await prisma.taskStatus.findFirst({
        where: { projectId: Number(projectId), isDefault: true },
      });
      finalStatusId = defaultStatus
        ? defaultStatus.id
        : (await prisma.taskStatus.findFirst({ where: { projectId: Number(projectId) }, orderBy: { order: "asc" } }))
            ?.id;
    }
    if (!finalStatusId) return fail(res, 400, "Project has no statuses/columns yet");

    const hasAssignee = !!assigneeId;
    if (hasAssignee && !(await canAssignTo(req.user, Number(assigneeId)))) {
      return fail(res, 403, "You can only assign tasks to yourself or your own direct/indirect reports");
    }

    if (hasAssignee) {
      const capacity = await checkWorkloadCapacity(Number(assigneeId), priority || "MEDIUM");
      if (!capacity.allowed) {
        const assignee = await prisma.user.findUnique({ where: { id: Number(assigneeId) }, select: { name: true } });
        return fail(
          res,
          400,
          `Can't assign — ${assignee?.name || "This person"} is already at their workload limit (${capacity.current}/${capacity.max} points). Reassign or complete some of their existing tasks first.`
        );
      }
    }

    const count = await prisma.task.count({ where: { statusId: finalStatusId } });

    const task = await prisma.task.create({
      data: {
        projectId: Number(projectId),
        statusId: finalStatusId,
        title,
        description,
        priority: priority || "MEDIUM",
        assigneeId: hasAssignee ? Number(assigneeId) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        createdById: req.user.id,
        // Whoever creates the task with an assignee set is the one assigning it.
        assignedById: hasAssignee ? req.user.id : null,
        assignedAt: hasAssignee ? new Date() : null,
        order: count,
      },
      include: { assignee: true, assignedBy: { select: { id: true, name: true } }, status: true },
    });

    if (hasAssignee && task.assigneeId !== req.user.id) {
      await notify({
        userId: task.assigneeId,
        type: "task_assigned",
        message: `${req.user.name} (${req.user.role?.name || "Team"}) assigned you a task: "${task.title}"`,
        link: `/projects/${task.projectId}`,
        refType: "task",
        refId: task.id,
      });
    }

    await logActivity({
      userId: req.user.id,
      action: "created",
      entityType: "Task",
      entityId: task.id,
      description: `created task "${task.title}"`,
    });

    return created(res, task);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function updateTask(req, res) {
  try {
    const { id } = req.params;
    const { title, description, priority, assigneeId, dueDate } = req.body;

    if (assigneeId !== undefined && assigneeId !== null && assigneeId !== "") {
      if (!(await canAssignTo(req.user, Number(assigneeId)))) {
        return fail(res, 403, "You can only assign tasks to yourself or your own direct/indirect reports");
      }

      const existingForCapacity = await prisma.task.findUnique({ where: { id: Number(id) }, select: { assigneeId: true, priority: true } });
      const newAssigneeId = Number(assigneeId);
      const effectivePriority = priority || existingForCapacity?.priority || "MEDIUM";
      // Only check capacity if this actually changes who's doing the work,
      // or bumps the priority of a task they're already assigned — either
      // way it could push them over the cap.
      if (newAssigneeId !== existingForCapacity?.assigneeId || (priority && priority !== existingForCapacity?.priority)) {
        const capacity = await checkWorkloadCapacity(newAssigneeId, effectivePriority, Number(id));
        if (!capacity.allowed) {
          const assignee = await prisma.user.findUnique({ where: { id: newAssigneeId }, select: { name: true } });
          return fail(
            res,
            400,
            `Can't assign — ${assignee?.name || "This person"} is already at their workload limit (${capacity.current}/${capacity.max} points). Reassign or complete some of their existing tasks first.`
          );
        }
      }
    }

    // Only stamp a new "assigned by / at" when the assignee is actually changing,
    // so editing the title etc. doesn't wipe out who originally assigned the task.
    let assignmentFields = {};
    if (assigneeId !== undefined) {
      const existing = await prisma.task.findUnique({ where: { id: Number(id) }, select: { assigneeId: true } });
      const newAssigneeId = assigneeId ? Number(assigneeId) : null;
      if (newAssigneeId !== existing?.assigneeId) {
        assignmentFields = newAssigneeId
          ? { assignedById: req.user.id, assignedAt: new Date() }
          : { assignedById: null, assignedAt: null };
      }
    }

    const task = await prisma.task.update({
      where: { id: Number(id) },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(assigneeId !== undefined && { assigneeId: assigneeId ? Number(assigneeId) : null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...assignmentFields,
      },
      include: {
        assignee: true,
        createdBy: { select: { id: true, name: true } },
        assignedBy: { select: { id: true, name: true } },
        status: true,
      },
    });

    if (assignmentFields.assignedById && task.assigneeId !== req.user.id) {
      await notify({
        userId: task.assigneeId,
        type: "task_assigned",
        message: `${req.user.name} (${req.user.role?.name || "Team"}) assigned you a task: "${task.title}"`,
        link: `/projects/${task.projectId}`,
        refType: "task",
        refId: task.id,
      });
    }

    await logActivity({
      userId: req.user.id,
      action: "updated",
      entityType: "Task",
      entityId: task.id,
      description: `updated task "${task.title}"`,
    });

    return ok(res, task, "Task updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Called when a card is dragged to another column and/or position — this is
// what makes the board feel like Jira/Trello. Anyone with tasks.manage can
// move any task; someone with only tasks.update_own (a plain Employee) can
// only move a task that's actually assigned to them.
async function moveTask(req, res) {
  try {
    const { id } = req.params;
    const { statusId, order } = req.body;

    const perms = req.user.role?.permissions || {};
    const canManageAny = perms["*"] === true || perms["tasks.manage"] === true;
    if (!canManageAny) {
      const existing = await prisma.task.findUnique({ where: { id: Number(id) }, select: { assigneeId: true } });
      if (existing?.assigneeId !== req.user.id) {
        return fail(res, 403, "You can only move tasks assigned to you");
      }
    }

    const task = await prisma.task.update({
      where: { id: Number(id) },
      data: { statusId: Number(statusId), order: Number(order) },
      include: { assignee: true, status: true },
    });
    return ok(res, task, "Task moved");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function deleteTask(req, res) {
  try {
    const { id } = req.params;
    const task = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (!task) return fail(res, 404, "Task not found");
    await prisma.task.delete({ where: { id: Number(id) } });
    await logActivity({
      userId: req.user.id,
      action: "deleted",
      entityType: "Task",
      entityId: Number(id),
      description: `deleted task "${task.title}"`,
    });
    return ok(res, null, "Task deleted");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Task file attachments (separate from chat file sharing) — files uploaded
// straight onto a task, e.g. a spec doc or a screenshot, visible to
// anyone who can view the task.
async function listAttachments(req, res) {
  const taskId = Number(req.params.id);
  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, attachments);
}

async function addAttachment(req, res) {
  try {
    const taskId = Number(req.params.id);
    if (!req.file) return fail(res, 400, "No file uploaded");
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        uploadedById: req.user.id,
        fileUrl: `/uploads/tasks/${req.file.filename}`,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });
    return created(res, attachment);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function deleteAttachment(req, res) {
  try {
    const id = Number(req.params.attachmentId);
    const attachment = await prisma.taskAttachment.findUnique({ where: { id } });
    if (!attachment) return fail(res, 404, "Attachment not found");
    if (attachment.uploadedById !== req.user.id) {
      const perms = req.user.role?.permissions || {};
      const canManage = perms["*"] === true || perms["tasks.manage"] === true;
      if (!canManage) return fail(res, 403, "Only the uploader or a manager can delete this attachment");
    }
    await prisma.taskAttachment.delete({ where: { id } });
    return ok(res, null, "Attachment deleted");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function addComment(req, res) {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    if (!comment) return fail(res, 400, "comment is required");
    const taskId = Number(id);

    const created_ = await prisma.taskComment.create({
      data: { taskId, userId: req.user.id, comment },
      include: { user: { select: { id: true, name: true } } },
    });

    // Notify @mentioned project members, and separately let the task's
    // assignee know someone commented (if they didn't write it themselves
    // and weren't already mentioned).
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        title: true,
        projectId: true,
        assigneeId: true,
        project: { select: { members: { select: { user: { select: { id: true, name: true } } } } } },
      },
    });

    const candidateUsers = task.project.members.map((m) => m.user);
    const mentioned = extractMentionedUsers(comment, candidateUsers);
    const notifiedIds = new Set();

    for (const u of mentioned) {
      if (u.id === req.user.id) continue;
      await notify({
        userId: u.id,
        type: "mention",
        message: `${req.user.name} mentioned you on "${task.title}"`,
        link: `/projects/${task.projectId}`,
        refType: "task_comment",
        refId: created_.id,
      });
      notifiedIds.add(u.id);
    }

    if (task.assigneeId && task.assigneeId !== req.user.id && !notifiedIds.has(task.assigneeId)) {
      await notify({
        userId: task.assigneeId,
        type: "comment",
        message: `${req.user.name} commented on "${task.title}"`,
        link: `/projects/${task.projectId}`,
        refType: "task_comment",
        refId: created_.id,
      });
    }

    return created(res, created_);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = {
  listTasksByProject,
  listTasksForCalendar,
  listMyTasks,
  getTask,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  addComment,
  listAttachments,
  addAttachment,
  deleteAttachment,
};
