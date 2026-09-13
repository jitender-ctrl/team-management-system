const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");

// These endpoints let a project owner fully customize their board columns —
// this is the "dynamic structure" piece: no fixed enum of statuses.

async function listStatuses(req, res) {
  const { projectId } = req.params;
  const statuses = await prisma.taskStatus.findMany({
    where: { projectId: Number(projectId) },
    orderBy: { order: "asc" },
  });
  return ok(res, statuses);
}

async function createStatus(req, res) {
  try {
    const { projectId } = req.params;
    const { name, color, isDone } = req.body;
    if (!name) return fail(res, 400, "name is required");

    const count = await prisma.taskStatus.count({ where: { projectId: Number(projectId) } });
    const status = await prisma.taskStatus.create({
      data: {
        projectId: Number(projectId),
        name,
        color: color || "#6B7280",
        order: count,
        isDone: !!isDone,
      },
    });
    return created(res, status);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function updateStatus(req, res) {
  try {
    const { statusId } = req.params;
    const { name, color, order, isDefault, isDone } = req.body;
    const status = await prisma.taskStatus.update({
      where: { id: Number(statusId) },
      data: {
        ...(name && { name }),
        ...(color && { color }),
        ...(order !== undefined && { order }),
        ...(typeof isDefault === "boolean" && { isDefault }),
        ...(typeof isDone === "boolean" && { isDone }),
      },
    });
    return ok(res, status, "Status updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Bulk reorder, sent from the board UI after a column drag.
async function reorderStatuses(req, res) {
  try {
    const { order } = req.body; // [{ id, order }, ...]
    await Promise.all(
      order.map((s) => prisma.taskStatus.update({ where: { id: s.id }, data: { order: s.order } }))
    );
    return ok(res, null, "Statuses reordered");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function deleteStatus(req, res) {
  try {
    const { statusId } = req.params;
    const { moveTasksToStatusId } = req.body || {};

    if (moveTasksToStatusId) {
      await prisma.task.updateMany({
        where: { statusId: Number(statusId) },
        data: { statusId: Number(moveTasksToStatusId) },
      });
    }
    await prisma.taskStatus.delete({ where: { id: Number(statusId) } });
    return ok(res, null, "Status deleted");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = { listStatuses, createStatus, updateStatus, reorderStatuses, deleteStatus };
