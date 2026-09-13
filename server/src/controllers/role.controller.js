const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");

async function listRoles(req, res) {
  const roles = await prisma.role.findMany({ orderBy: { id: "asc" } });
  return ok(res, roles);
}

// Create a brand new role with any permission map — this is what makes
// the role system dynamic instead of a fixed enum of 3 roles.
async function createRole(req, res) {
  try {
    const { name, permissions } = req.body;
    if (!name || typeof permissions !== "object") {
      return fail(res, 400, "name and permissions (object) are required");
    }
    const role = await prisma.role.create({ data: { name, permissions } });
    return created(res, role);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;
    const role = await prisma.role.update({
      where: { id: Number(id) },
      data: { ...(name && { name }), ...(permissions && { permissions }) },
    });
    return ok(res, role, "Role updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function deleteRole(req, res) {
  try {
    const { id } = req.params;
    const role = await prisma.role.findUnique({ where: { id: Number(id) } });
    if (role?.isSystem) return fail(res, 400, "Cannot delete a system role");
    await prisma.role.delete({ where: { id: Number(id) } });
    return ok(res, null, "Role deleted");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = { listRoles, createRole, updateRole, deleteRole };
