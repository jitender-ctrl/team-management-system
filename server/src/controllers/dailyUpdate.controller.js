const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");

function todayDateOnly() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Create or update *today's* entry for the current user (one entry per day —
// posting again the same day edits it rather than creating a duplicate).
async function upsertToday(req, res) {
  try {
    const { content, hoursSpent } = req.body;
    if (!content?.trim()) return fail(res, 400, "Update content is required");

    const entry = await prisma.dailyUpdate.upsert({
      where: { userId_date: { userId: req.user.id, date: todayDateOnly() } },
      create: {
        userId: req.user.id,
        date: todayDateOnly(),
        content: content.trim(),
        hoursSpent: hoursSpent != null ? Number(hoursSpent) : null,
      },
      update: {
        content: content.trim(),
        hoursSpent: hoursSpent != null ? Number(hoursSpent) : null,
      },
    });
    return created(res, entry);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// A user's own history, or — for managers — anyone's, via ?userId=.
async function listUpdates(req, res) {
  try {
    const { userId, limit } = req.query;
    let targetId = req.user.id;

    if (userId && Number(userId) !== req.user.id) {
      const perms = req.user.role?.permissions || {};
      const canView = perms["*"] === true || perms["users.manage"] === true || perms["projects.manage"] === true;
      if (!canView) return fail(res, 403, "Not allowed to view this user's updates");
      targetId = Number(userId);
    }

    const updates = await prisma.dailyUpdate.findMany({
      where: { userId: targetId },
      orderBy: { date: "desc" },
      take: Math.min(Number(limit) || 30, 90),
    });
    return ok(res, updates);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function deleteUpdate(req, res) {
  try {
    const id = Number(req.params.id);
    const entry = await prisma.dailyUpdate.findUnique({ where: { id } });
    if (!entry) return fail(res, 404, "Update not found");
    if (entry.userId !== req.user.id) return fail(res, 403, "You can only delete your own updates");
    await prisma.dailyUpdate.delete({ where: { id } });
    return ok(res, null, "Update deleted");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = { upsertToday, listUpdates, deleteUpdate };
