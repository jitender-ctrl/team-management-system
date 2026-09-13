const prisma = require("../config/prisma");
const { ok } = require("../utils/response");

// Global search across the entities the current user is allowed to see —
// each section is skipped if they lack the corresponding view permission,
// so results never leak beyond what the sidebar would show them anyway.
async function search(req, res) {
  const q = (req.query.q || "").trim();
  if (!q) return ok(res, { users: [], projects: [], tasks: [], clients: [] });

  const perms = req.user.role?.permissions || {};
  const canAll = perms["*"] === true;
  const can = (key) => canAll || perms[key] === true;

  const [users, projects, tasks, clients] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: 8,
    }),
    can("projects.view") || can("projects.manage")
      ? prisma.project.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          select: { id: true, name: true, status: true },
          take: 8,
        })
      : [],
    can("tasks.view") || can("tasks.manage")
      ? prisma.task.findMany({
          where: { title: { contains: q, mode: "insensitive" } },
          select: { id: true, title: true, projectId: true, project: { select: { name: true } } },
          take: 8,
        })
      : [],
    can("clients.view") || can("clients.manage")
      ? prisma.client.findMany({
          where: {
            OR: [{ name: { contains: q, mode: "insensitive" } }, { company: { contains: q, mode: "insensitive" } }],
          },
          select: { id: true, name: true, company: true },
          take: 8,
        })
      : [],
  ]);

  return ok(res, { users, projects, tasks, clients });
}

module.exports = { search };
