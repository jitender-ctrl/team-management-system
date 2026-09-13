const prisma = require("../config/prisma");
const { ok } = require("../utils/response");
const { notifyOnce } = require("../utils/notify");

// Checked lazily whenever the user opens their notifications (no cron job
// needed): any task assigned to them, past its due date, not yet in a "Done"
// column, gets a one-time "overdue" alert (de-duped via refType/refId).
async function checkOverdueForUser(userId) {
  const overdue = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      dueDate: { lt: new Date() },
      status: { isDone: false },
    },
    select: { id: true, title: true, projectId: true },
  });

  for (const t of overdue) {
    await notifyOnce({
      userId,
      type: "task_overdue",
      message: `Overdue: "${t.title}"`,
      link: `/projects/${t.projectId}`,
      refType: "task",
      refId: t.id,
    });
  }
}

async function listNotifications(req, res) {
  await checkOverdueForUser(req.user.id);
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });
  return ok(res, { notifications, unreadCount });
}

async function markRead(req, res) {
  const { id } = req.params;
  await prisma.notification.updateMany({
    where: { id: Number(id), userId: req.user.id },
    data: { isRead: true },
  });
  return ok(res, null, "Marked read");
}

async function markAllRead(req, res) {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  return ok(res, null, "All marked read");
}

module.exports = { listNotifications, markRead, markAllRead };
