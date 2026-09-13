const prisma = require("../config/prisma");
const { ok, fail } = require("../utils/response");

// Read-only client portal: no login required, gated only by knowing the
// opaque token. Deliberately returns a limited, non-sensitive slice of the
// project — no internal comments, no other clients' data, no user contact
// info, no financial/complaint data. Just status, timeline, and task
// progress by column, which is what a client needs to see.
async function getPortalProject(req, res) {
  try {
    const { token } = req.params;
    const project = await prisma.project.findUnique({
      where: { portalToken: token },
      include: {
        client: { select: { name: true, company: true } },
        statuses: { orderBy: { order: "asc" }, include: { tasks: { select: { id: true, title: true, priority: true, dueDate: true } } } },
      },
    });

    if (!project || !project.portalEnabled) return fail(res, 404, "This portal link is invalid or has been disabled");

    const totalTasks = project.statuses.reduce((sum, s) => sum + s.tasks.length, 0);
    const doneTasks = project.statuses.filter((s) => s.isDone).reduce((sum, s) => sum + s.tasks.length, 0);

    return ok(res, {
      name: project.name,
      description: project.description,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      client: project.client,
      progressPct: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
      columns: project.statuses.map((s) => ({
        name: s.name,
        color: s.color,
        isDone: s.isDone,
        // Task titles only — no assignees, comments, or internal detail.
        tasks: s.tasks.map((t) => ({ title: t.title, priority: t.priority, dueDate: t.dueDate })),
      })),
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = { getPortalProject };
