const prisma = require("../config/prisma");
const crypto = require("crypto");
const { ok, created, fail } = require("../utils/response");
const { logActivity } = require("../utils/activityLog");

const DEFAULT_STATUSES = [
  { name: "To Do", color: "#94A3B8", order: 0, isDefault: true },
  { name: "In Progress", color: "#3B82F6", order: 1, isDefault: false },
  { name: "Review", color: "#F59E0B", order: 2, isDefault: false },
  { name: "Done", color: "#22C55E", order: 3, isDefault: false, isDone: true },
];

async function listProjects(req, res) {
  const projects = await prisma.project.findMany({
    include: {
      client: true,
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, projects);
}

async function getProject(req, res) {
  const { id } = req.params;
  const project = await prisma.project.findUnique({
    where: { id: Number(id) },
    include: {
      client: true,
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      statuses: { orderBy: { order: "asc" } },
    },
  });
  if (!project) return fail(res, 404, "Project not found");
  return ok(res, project);
}

// Creates the project AND seeds a default set of statuses/columns.
// The statuses are just rows in TaskStatus tied to this project, so the
// user can immediately rename/reorder/add/remove columns per project.
async function createProject(req, res) {
  try {
    const { name, description, clientId, startDate, endDate, memberIds = [] } = req.body;
    if (!name) return fail(res, 400, "name is required");

    const project = await prisma.project.create({
      data: {
        name,
        description,
        clientId: clientId ? Number(clientId) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdById: req.user.id,
        statuses: { create: DEFAULT_STATUSES },
        members: {
          create: [
            { userId: req.user.id, roleInProject: "Owner" },
            ...memberIds
              .filter((id) => id !== req.user.id)
              .map((id) => ({ userId: Number(id), roleInProject: "Member" })),
          ],
        },
        conversation: { create: { type: "PROJECT" } }, // auto-create the project's group chat
      },
      include: { statuses: true, members: true },
    });

    await logActivity({
      userId: req.user.id,
      action: "created",
      entityType: "Project",
      entityId: project.id,
      description: `created project "${project.name}"`,
    });

    return created(res, project);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function updateProject(req, res) {
  try {
    const { id } = req.params;
    const { name, description, status, clientId, startDate, endDate } = req.body;
    const project = await prisma.project.update({
      where: { id: Number(id) },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(clientId !== undefined && { clientId: clientId ? Number(clientId) : null }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
    });
    await logActivity({
      userId: req.user.id,
      action: "updated",
      entityType: "Project",
      entityId: project.id,
      description: `updated project "${project.name}"`,
    });
    return ok(res, project, "Project updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function deleteProject(req, res) {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id: Number(id) } });
    if (!project) return fail(res, 404, "Project not found");
    await prisma.project.delete({ where: { id: Number(id) } });
    await logActivity({
      userId: req.user.id,
      action: "deleted",
      entityType: "Project",
      entityId: Number(id),
      description: `deleted project "${project.name}"`,
    });
    return ok(res, null, "Project deleted");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Generates (or rotates) the read-only client portal link for a project.
// The token is an opaque random string — knowing it is the only "auth"
// needed to view the public, read-only portal page.
async function generatePortalLink(req, res) {
  try {
    const { id } = req.params;
    const token = crypto.randomBytes(16).toString("hex");
    const project = await prisma.project.update({
      where: { id: Number(id) },
      data: { portalToken: token, portalEnabled: true },
    });
    await logActivity({
      userId: req.user.id,
      action: "updated",
      entityType: "Project",
      entityId: project.id,
      description: `generated a client portal link for "${project.name}"`,
    });
    return ok(res, { portalToken: project.portalToken, portalEnabled: project.portalEnabled });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function revokePortalLink(req, res) {
  try {
    const { id } = req.params;
    const project = await prisma.project.update({
      where: { id: Number(id) },
      data: { portalEnabled: false },
    });
    return ok(res, { portalEnabled: project.portalEnabled }, "Portal link disabled");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function addMember(req, res) {
  try {
    const { id } = req.params;
    const { userId, roleInProject } = req.body;
    const member = await prisma.projectMember.create({
      data: { projectId: Number(id), userId: Number(userId), roleInProject: roleInProject || "Member" },
    });
    return created(res, member);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function removeMember(req, res) {
  try {
    const { id, userId } = req.params;
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: Number(id), userId: Number(userId) } },
    });
    return ok(res, null, "Member removed");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
  generatePortalLink,
  revokePortalLink,
};
