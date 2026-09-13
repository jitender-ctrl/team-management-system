const prisma = require("../config/prisma");

// Central place to record an audit trail entry. Called from the mutation
// points that matter most (create/update/delete on users, projects, tasks,
// clients) rather than instrumented on every possible write — this keeps
// the log readable as a "what happened" feed instead of noise.
async function logActivity({ userId, action, entityType, entityId, description }) {
  try {
    return await prisma.activityLog.create({
      data: { userId: userId || null, action, entityType, entityId: entityId || null, description },
    });
  } catch (err) {
    // Never let audit logging break the actual request.
    console.error("Failed to write activity log:", err.message);
    return null;
  }
}

module.exports = { logActivity };
