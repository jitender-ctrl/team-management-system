const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");

// Starts a running timer for the current user on a task. Only one running
// timer per user across all tasks — starting a new one auto-stops the old
// one first, since a person can't really be tracking two things at once.
async function startTimer(req, res) {
  try {
    const taskId = Number(req.params.taskId);

    const running = await prisma.timeEntry.findFirst({ where: { userId: req.user.id, endTime: null } });
    if (running) {
      const durationSeconds = Math.round((Date.now() - new Date(running.startTime).getTime()) / 1000);
      await prisma.timeEntry.update({ where: { id: running.id }, data: { endTime: new Date(), durationSeconds } });
    }

    const entry = await prisma.timeEntry.create({
      data: { taskId, userId: req.user.id, startTime: new Date() },
    });
    return created(res, entry);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function stopTimer(req, res) {
  try {
    const taskId = Number(req.params.taskId);
    const running = await prisma.timeEntry.findFirst({
      where: { taskId, userId: req.user.id, endTime: null },
    });
    if (!running) return fail(res, 400, "No running timer for this task");

    const durationSeconds = Math.round((Date.now() - new Date(running.startTime).getTime()) / 1000);
    const entry = await prisma.timeEntry.update({
      where: { id: running.id },
      data: { endTime: new Date(), durationSeconds },
    });
    return ok(res, entry, "Timer stopped");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// The current user's running timer, if any — checked on app load so the UI
// can show "Timer running on <task>" even after a page refresh.
async function getRunningTimer(req, res) {
  const running = await prisma.timeEntry.findFirst({
    where: { userId: req.user.id, endTime: null },
    include: { task: { select: { id: true, title: true, projectId: true } } },
  });
  return ok(res, running);
}

// Manually log a block of time after the fact (no live timer involved).
async function logManualEntry(req, res) {
  try {
    const taskId = Number(req.params.taskId);
    const { startTime, endTime, durationMinutes, note } = req.body;

    let start, end, durationSeconds;
    if (durationMinutes) {
      // Simple path: just a duration, defaulting the end time to now.
      durationSeconds = Math.round(Number(durationMinutes) * 60);
      end = endTime ? new Date(endTime) : new Date();
      start = startTime ? new Date(startTime) : new Date(end.getTime() - durationSeconds * 1000);
    } else if (startTime && endTime) {
      start = new Date(startTime);
      end = new Date(endTime);
      durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
    } else {
      return fail(res, 400, "Provide either durationMinutes or both startTime and endTime");
    }
    if (durationSeconds <= 0) return fail(res, 400, "Duration must be positive");

    const entry = await prisma.timeEntry.create({
      data: { taskId, userId: req.user.id, startTime: start, endTime: end, durationSeconds, note: note || null },
    });
    return created(res, entry);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function listTaskEntries(req, res) {
  const taskId = Number(req.params.taskId);
  const entries = await prisma.timeEntry.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startTime: "desc" },
  });
  const totalSeconds = entries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
  return ok(res, { entries, totalSeconds });
}

async function deleteEntry(req, res) {
  try {
    const id = Number(req.params.id);
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) return fail(res, 404, "Entry not found");
    if (entry.userId !== req.user.id) {
      const perms = req.user.role?.permissions || {};
      const canManage = perms["*"] === true || perms["tasks.manage"] === true;
      if (!canManage) return fail(res, 403, "Only the person who logged this time (or a manager) can delete it");
    }
    await prisma.timeEntry.delete({ where: { id } });
    return ok(res, null, "Time entry deleted");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// A user's logged time across all tasks in a range — powers a personal
// "hours this week" summary on the profile/dashboard.
async function myTimeSummary(req, res) {
  const { start, end } = req.query;
  const where = {
    userId: req.user.id,
    ...(start || end
      ? {
          startTime: {
            ...(start && { gte: new Date(start) }),
            ...(end && { lte: new Date(end) }),
          },
        }
      : {}),
  };
  const entries = await prisma.timeEntry.findMany({
    where,
    include: { task: { select: { id: true, title: true, project: { select: { id: true, name: true } } } } },
    orderBy: { startTime: "desc" },
  });
  const totalSeconds = entries.reduce((sum, e) => sum + (e.durationSeconds || 0), 0);
  return ok(res, { entries, totalSeconds });
}

module.exports = {
  startTimer,
  stopTimer,
  getRunningTimer,
  logManualEntry,
  listTaskEntries,
  deleteEntry,
  myTimeSummary,
};
