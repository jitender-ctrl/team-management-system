const prisma = require("../config/prisma");
const { ok } = require("../utils/response");

// Paginated activity feed, optionally filtered by entity type/id — e.g. the
// Projects page can show "history for this project" via entityType=Project&entityId=5.
async function listActivity(req, res) {
  const { entityType, entityId, limit } = req.query;
  const logs = await prisma.activityLog.findMany({
    where: {
      ...(entityType && { entityType }),
      ...(entityId && { entityId: Number(entityId) }),
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit) || 50, 200),
  });
  return ok(res, logs);
}

module.exports = { listActivity };
