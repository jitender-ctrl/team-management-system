const prisma = require("../config/prisma");

function isAdmin(user) {
  const perms = user.role?.permissions || {};
  return perms["*"] === true || perms["users.manage"] === true;
}

// Every user (direct + indirect) who reports up to `managerId`, via
// breadth-first traversal of the manager/directReports self-relation.
// Small team sizes make this cheap; this isn't meant to scale to thousands
// of employees without switching to a recursive SQL query.
async function getSubordinateIds(managerId) {
  const all = new Set();
  let frontier = [managerId];

  while (frontier.length > 0) {
    const reports = await prisma.user.findMany({
      where: { managerId: { in: frontier } },
      select: { id: true },
    });
    const newIds = reports.map((r) => r.id).filter((id) => !all.has(id));
    newIds.forEach((id) => all.add(id));
    frontier = newIds;
  }

  return Array.from(all);
}

// Can `assigner` assign a task to `assigneeId`? Admins can assign to
// anyone. Everyone else (Managers, Team Leads — anyone with tasks.assign or
// tasks.manage) can only assign to themselves or their own direct/indirect
// reports — never sideways or up the chain.
async function canAssignTo(assigner, assigneeId) {
  if (isAdmin(assigner)) return true;
  if (assigneeId === assigner.id) return true;
  const subordinateIds = await getSubordinateIds(assigner.id);
  return subordinateIds.includes(assigneeId);
}

module.exports = { isAdmin, getSubordinateIds, canAssignTo };
