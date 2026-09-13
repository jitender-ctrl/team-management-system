const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");
const { logActivity } = require("../utils/activityLog");
const { isAdmin, getSubordinateIds } = require("../utils/hierarchy");
const { sendOtpEmail } = require("../utils/mailer");
const { generateOtp } = require("../utils/otp");

const safe = ({ password, ...rest }) => rest;

async function listUsers(req, res) {
  const { search, roleId, status, projectId } = req.query;

  const users = await prisma.user.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(roleId && { roleId: Number(roleId) }),
      ...(status === "active" && { isActive: true }),
      ...(status === "inactive" && { isActive: false }),
      ...(projectId && { projectMembers: { some: { projectId: Number(projectId) } } }),
    },
    include: {
      role: true,
      manager: { select: { id: true, name: true } },
      assignedTasks: { select: { id: true, status: { select: { isDone: true } } } },
    },
    orderBy: { id: "asc" },
  });

  const withCounts = users.map(({ assignedTasks, ...u }) => {
    const completedTasks = assignedTasks.filter((t) => t.status.isDone).length;
    const pendingTasks = assignedTasks.length - completedTasks;
    return { ...u, taskCounts: { total: assignedTasks.length, completed: completedTasks, pending: pendingTasks } };
  });

  return ok(res, withCounts.map(safe));
}

// Who the current user is allowed to assign tasks to: Admins get everyone
// (active), everyone else gets themselves + their own direct/indirect
// reports only — this is what the task-assignment dropdown should offer,
// so the UI can't even present an option the backend would reject.
async function listAssignableUsers(req, res) {
  const admin = isAdmin(req.user);
  const ids = admin ? null : [req.user.id, ...(await getSubordinateIds(req.user.id))];

  const users = await prisma.user.findMany({
    where: { isActive: true, ...(ids && { id: { in: ids } }) },
    select: { id: true, name: true, email: true, avatarUrl: true, role: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return ok(res, users);
}

// Full profile + performance detail for one employee — powers the profile
// page's header, stats, and history chart.
async function getUserById(req, res) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        projectMembers: { include: { project: { select: { id: true, name: true, status: true } } } },
      },
    });
    if (!user) return fail(res, 404, "User not found");

    const tasks = await prisma.task.findMany({
      where: { assigneeId: id },
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        updatedAt: true,
        createdAt: true,
        status: { select: { name: true, isDone: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const now = new Date();
    const completed = tasks.filter((t) => t.status.isDone);
    const overdue = tasks.filter((t) => !t.status.isDone && t.dueDate && new Date(t.dueDate) < now);

    // 12-week completed-tasks-per-week history, for the profile chart.
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i * 7 - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const count = completed.filter((t) => new Date(t.updatedAt) >= start && new Date(t.updatedAt) < end).length;
      weeks.push({ week: start.toISOString().slice(0, 10), completed: count });
    }

    return ok(res, {
      ...safe(user),
      stats: {
        totalTasks: tasks.length,
        completedTasks: completed.length,
        pendingTasks: tasks.length - completed.length,
        overdueTasks: overdue.length,
        completionRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
        projectsCount: user.projectMembers.length,
      },
      history: weeks,
      recentTasks: tasks.slice(0, 10),
      projects: user.projectMembers.map((pm) => pm.project),
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password, roleId } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const { code, expiry } = generateOtp();
    const user = await prisma.user.create({
      data: { name, email, password: hashed, roleId: Number(roleId), otpCode: code, otpExpiry: expiry },
      include: { role: true },
    });
    await sendOtpEmail(user.email, { code, name: user.name });
    await logActivity({
      userId: req.user.id,
      action: "created",
      entityType: "User",
      entityId: user.id,
      description: `added team member "${user.name}"`,
    });
    return created(res, safe(user), "Team member added — a verification code was emailed to them");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const targetId = Number(id);
    const { name, roleId, isActive, bio, phone, jobTitle, email, managerId } = req.body;

    const perms = req.user.role?.permissions || {};
    const canManage = perms["*"] === true || perms["users.manage"] === true;
    const isSelf = targetId === req.user.id;
    if (!canManage && !isSelf) return fail(res, 403, "Not allowed to edit this user");
    // Only managers can change role, active status, email, or reporting manager.
    if (!canManage && (roleId !== undefined || isActive !== undefined || email !== undefined || managerId !== undefined)) {
      return fail(res, 403, "Only an admin/manager can change role, status, email, or reporting manager");
    }
    if (managerId !== undefined && Number(managerId) === targetId) {
      return fail(res, 400, "A user can't report to themselves");
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(roleId && { roleId: Number(roleId) }),
        ...(typeof isActive === "boolean" && { isActive }),
        ...(bio !== undefined && { bio }),
        ...(phone !== undefined && { phone }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(managerId !== undefined && { managerId: managerId ? Number(managerId) : null }),
      },
      include: { role: true, manager: { select: { id: true, name: true } } },
    });
    return ok(res, safe(user), "User updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Called after multer's uploadAvatar.single("avatar") middleware has
// already written the file to disk — this just records the URL. Anyone can
// update their own avatar; updating someone else's needs users.manage.
async function updateAvatar(req, res) {
  try {
    const { id } = req.params;
    const targetId = Number(id);
    const perms = req.user.role?.permissions || {};
    const canManage = perms["*"] === true || perms["users.manage"] === true;
    if (targetId !== req.user.id && !canManage) return fail(res, 403, "Not allowed to change this user's avatar");
    if (!req.file) return fail(res, 400, "No image uploaded");
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({ where: { id: targetId }, data: { avatarUrl }, include: { role: true } });
    return ok(res, safe(user), "Avatar updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Soft delete: deactivates the account (blocks login) but keeps all their
// history — tasks they created/were assigned, comments, attendance, etc.
// This is the safe default and what the "Deactivate" button calls.
async function deactivateUser(req, res) {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({ where: { id: Number(id) }, data: { isActive: false } });
    await logActivity({
      userId: req.user.id,
      action: "deactivated",
      entityType: "User",
      entityId: user.id,
      description: `deactivated team member "${user.name}"`,
    });
    return ok(res, null, "User deactivated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function reactivateUser(req, res) {
  try {
    const { id } = req.params;
    await prisma.user.update({ where: { id: Number(id) }, data: { isActive: true } });
    return ok(res, null, "User reactivated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Hard delete: permanently removes the user record. Only allowed once
// they're no longer the recorded creator of projects/clients/tasks or the
// sender of chat messages, since those columns are required (NOT NULL)
// foreign keys — deleting straight through them would corrupt that history.
// The error message tells the admin exactly what to reassign first.
// Permanently removes a user. Per your policy: anything they *created*
// (projects, clients, tasks, chat messages, complaints, groups, meetings,
// task attachments) is transferred to the admin performing the deletion —
// nothing is silently lost. Personal/participation records that don't make
// sense to reassign (their own time entries, daily updates, attendance,
// notifications, comments, memberships) are removed along with them.
async function permanentlyDeleteUser(req, res) {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) return fail(res, 400, "You can't delete your own account");

    const target = await prisma.user.findUnique({ where: { id }, select: { name: true } });
    if (!target) return fail(res, 404, "User not found");

    const adminId = req.user.id;

    await prisma.$transaction([
      // Transfer ownership of anything they created to the admin doing the deletion.
      prisma.project.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),
      prisma.client.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),
      prisma.task.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),
      prisma.message.updateMany({ where: { senderId: id }, data: { senderId: adminId } }),
      prisma.complaint.updateMany({ where: { raisedById: id }, data: { raisedById: adminId } }),
      prisma.taskAttachment.updateMany({ where: { uploadedById: id }, data: { uploadedById: adminId } }),
      prisma.conversation.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),
      prisma.meeting.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),

      // Detach references that shouldn't block deletion but aren't "ownership".
      prisma.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } }),
      prisma.task.updateMany({ where: { assignedById: id }, data: { assignedById: null } }),
      prisma.complaint.updateMany({ where: { resolvedById: id }, data: { resolvedById: null } }),

      // Personal/participation records: remove along with the account.
      prisma.taskComment.deleteMany({ where: { userId: id } }),
      prisma.dailyUpdate.deleteMany({ where: { userId: id } }),
      prisma.timeEntry.deleteMany({ where: { userId: id } }),
      prisma.projectMember.deleteMany({ where: { userId: id } }),
      prisma.breakLog.deleteMany({ where: { attendance: { userId: id } } }),
      prisma.attendance.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.conversationParticipant.deleteMany({ where: { userId: id } }),
      prisma.meetingAttendee.deleteMany({ where: { userId: id } }),

      prisma.user.delete({ where: { id } }),
    ]);

    await logActivity({
      userId: adminId,
      action: "deleted",
      entityType: "User",
      entityId: id,
      description: `permanently deleted team member "${target.name}" (their created projects/tasks/clients/messages were transferred to this admin)`,
    });

    return ok(res, null, "User permanently deleted — anything they created was transferred to you");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Bulk deactivate/reactivate/delete, used by the Users page's multi-select
// action bar. `action` is "deactivate" | "reactivate" | "delete". Delete
// runs the same safety checks as the single-user permanent delete, and
// reports per-id success/failure so a batch that's partly blocked doesn't
// silently fail the whole thing.
async function bulkAction(req, res) {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return fail(res, 400, "No users selected");
    const targetIds = ids.map(Number).filter((id) => id !== req.user.id);

    if (action === "deactivate") {
      await prisma.user.updateMany({ where: { id: { in: targetIds } }, data: { isActive: false } });
      return ok(res, null, `Deactivated ${targetIds.length} user(s)`);
    }
    if (action === "reactivate") {
      await prisma.user.updateMany({ where: { id: { in: targetIds } }, data: { isActive: true } });
      return ok(res, null, `Reactivated ${targetIds.length} user(s)`);
    }
    if (action === "delete") {
      const adminId = req.user.id;
      const results = { deleted: [] };
      for (const id of targetIds) {
        await prisma.$transaction([
          prisma.project.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),
          prisma.client.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),
          prisma.task.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),
          prisma.message.updateMany({ where: { senderId: id }, data: { senderId: adminId } }),
          prisma.complaint.updateMany({ where: { raisedById: id }, data: { raisedById: adminId } }),
          prisma.taskAttachment.updateMany({ where: { uploadedById: id }, data: { uploadedById: adminId } }),
          prisma.conversation.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),
          prisma.meeting.updateMany({ where: { createdById: id }, data: { createdById: adminId } }),
          prisma.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } }),
          prisma.task.updateMany({ where: { assignedById: id }, data: { assignedById: null } }),
          prisma.complaint.updateMany({ where: { resolvedById: id }, data: { resolvedById: null } }),
          prisma.taskComment.deleteMany({ where: { userId: id } }),
          prisma.dailyUpdate.deleteMany({ where: { userId: id } }),
          prisma.timeEntry.deleteMany({ where: { userId: id } }),
          prisma.projectMember.deleteMany({ where: { userId: id } }),
          prisma.breakLog.deleteMany({ where: { attendance: { userId: id } } }),
          prisma.attendance.deleteMany({ where: { userId: id } }),
          prisma.notification.deleteMany({ where: { userId: id } }),
          prisma.conversationParticipant.deleteMany({ where: { userId: id } }),
          prisma.meetingAttendee.deleteMany({ where: { userId: id } }),
          prisma.user.delete({ where: { id } }),
        ]);
        results.deleted.push(id);
      }
      return ok(res, results, `Deleted ${results.deleted.length} user(s) — anything they created was transferred to you`);
    }
    return fail(res, 400, "Unknown bulk action");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Per-user notification preferences (self-only). Missing keys default to
// "on", so this only needs to store the ones the user has turned off.
async function updateNotificationPreferences(req, res) {
  try {
    const { id } = req.params;
    const targetId = Number(id);
    if (targetId !== req.user.id) return fail(res, 403, "You can only change your own notification preferences");

    const { preferences } = req.body;
    if (typeof preferences !== "object" || preferences === null) return fail(res, 400, "preferences object is required");

    const user = await prisma.user.update({
      where: { id: targetId },
      data: { notificationPrefs: preferences },
      include: { role: true },
    });
    return ok(res, safe(user), "Notification preferences updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Per-employee report: which clients they're currently working with, which
// they've worked with previously, and how fast/reliably they complete
// work. Viewable by the person themself, or anyone with a management
// permission (Team Lead/Manager/Admin) — same gate as viewing the profile
// performance stats, just packaged for export.
async function getUserReport(req, res) {
  try {
    const id = Number(req.params.id);
    const perms = req.user.role?.permissions || {};
    const canView =
      req.user.id === id || perms["*"] === true || perms["users.manage"] === true || perms["projects.manage"] === true || perms["tasks.manage"] === true;
    if (!canView) return fail(res, 403, "Not allowed to view this report");

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!user) return fail(res, 404, "User not found");

    const tasks = await prisma.task.findMany({
      where: { assigneeId: id },
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        assignedAt: true,
        createdAt: true,
        updatedAt: true,
        status: { select: { isDone: true } },
        project: { select: { id: true, name: true, status: true, client: { select: { id: true, name: true, company: true } } } },
      },
    });

    const now = new Date();
    const completed = tasks.filter((t) => t.status.isDone);
    const withDueDate = completed.filter((t) => t.dueDate);
    const onTime = withDueDate.filter((t) => new Date(t.updatedAt) <= new Date(t.dueDate));
    const completionTimesHours = completed
      .filter((t) => t.assignedAt)
      .map((t) => (new Date(t.updatedAt) - new Date(t.assignedAt)) / (1000 * 60 * 60));
    const avgCompletionHours = completionTimesHours.length
      ? Math.round((completionTimesHours.reduce((a, b) => a + b, 0) / completionTimesHours.length) * 10) / 10
      : null;

    // "Current" = tasks not done, on a project that isn't completed/cancelled.
    // "Previous" = any other client they've touched, not already counted as current.
    const currentClientIds = new Set();
    const previousClientIds = new Set();
    const clientsById = {};

    for (const t of tasks) {
      const client = t.project.client;
      if (!client) continue;
      clientsById[client.id] = client;
      const isCurrent = !t.status.isDone && !["COMPLETED", "CANCELLED"].includes(t.project.status);
      if (isCurrent) currentClientIds.add(client.id);
      else previousClientIds.add(client.id);
    }
    // A client counted as current shouldn't also show as "previous".
    for (const cid of currentClientIds) previousClientIds.delete(cid);

    // Clients that used to be handled by this person but changed hands —
    // either transferred to someone else, or the engagement was ended
    // outright (newHandler null). This is the audit trail a manager
    // reviews to understand "why did this client leave their list".
    const handlerHistory = await prisma.clientHandlerHistory.findMany({
      where: { previousHandlerId: id },
      include: {
        client: { select: { id: true, name: true, company: true } },
        newHandler: { select: { id: true, name: true } },
        changedBy: { select: { id: true, name: true } },
      },
      orderBy: { changedAt: "desc" },
    });
    const clientHandlingChanges = handlerHistory.map((h) => ({
      client: h.client,
      type: h.newHandlerId ? "TRANSFERRED" : "TERMINATED",
      transferredTo: h.newHandler,
      reason: h.reason,
      changedBy: h.changedBy,
      changedAt: h.changedAt,
    }));

    return ok(res, {
      user,
      currentClients: Array.from(currentClientIds).map((cid) => clientsById[cid]),
      previousClients: Array.from(previousClientIds).map((cid) => clientsById[cid]),
      clientHandlingChanges,
      stats: {
        totalAssigned: tasks.length,
        totalCompleted: completed.length,
        completionRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
        onTimeRate: withDueDate.length ? Math.round((onTime.length / withDueDate.length) * 100) : null,
        avgCompletionHours,
        overdueOpen: tasks.filter((t) => !t.status.isDone && t.dueDate && new Date(t.dueDate) < now).length,
      },
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = {
  listUsers,
  listAssignableUsers,
  getUserById,
  getUserReport,
  createUser,
  updateUser,
  updateAvatar,
  updateNotificationPreferences,
  deactivateUser,
  reactivateUser,
  permanentlyDeleteUser,
  bulkAction,
};
