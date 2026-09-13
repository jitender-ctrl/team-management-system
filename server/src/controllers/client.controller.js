const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");
const { logActivity } = require("../utils/activityLog");
const { notify } = require("../utils/notify");

const CLIENT_INCLUDE = {
  _count: { select: { projects: true } },
  handledBy: { select: { id: true, name: true, avatarUrl: true } },
};

function canManageClients(user) {
  const perms = user.role?.permissions || {};
  return perms["*"] === true || perms["clients.manage"] === true;
}

// Anyone with clients.manage (Admin/Manager) sees every client. Everyone
// else only sees the clients they're personally the handler for — their
// "own" client relationships — so a big client list doesn't leak to
// people who have no reason to see or contact clients outside their remit.
async function listClients(req, res) {
  const canManage = canManageClients(req.user);
  const clients = await prisma.client.findMany({
    where: canManage ? {} : { handledById: req.user.id },
    include: CLIENT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return ok(res, clients);
}

async function getClient(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({
    where: { id: Number(id) },
    include: { projects: true, handledBy: { select: { id: true, name: true, avatarUrl: true } } },
  });
  if (!client) return fail(res, 404, "Client not found");
  if (!canManageClients(req.user) && client.handledById !== req.user.id) {
    return fail(res, 403, "You can only view clients you handle");
  }
  return ok(res, client);
}

async function createClient(req, res) {
  try {
    const { name, company, email, phone, address, notes, handledById, engagementType } = req.body;
    if (!name) return fail(res, 400, "name is required");
    const client = await prisma.client.create({
      data: {
        name,
        company,
        email,
        phone,
        address,
        notes,
        handledById: handledById ? Number(handledById) : null,
        engagementType: engagementType || null,
        createdById: req.user.id,
      },
      include: CLIENT_INCLUDE,
    });
    await logActivity({
      userId: req.user.id,
      action: "created",
      entityType: "Client",
      entityId: client.id,
      description: `added client "${client.name}"`,
    });
    return created(res, client);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Note: handledById is deliberately NOT accepted here. Changing who
// handles a client always goes through transferClientHandler below, so
// every handoff or termination is forced to carry a reason and gets
// logged — no silent reassignment via a generic field edit.
async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const { name, company, email, phone, address, notes, engagementType } = req.body;
    const client = await prisma.client.update({
      where: { id: Number(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(company !== undefined && { company }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
        ...(engagementType !== undefined && { engagementType: engagementType || null }),
      },
      include: CLIENT_INCLUDE,
    });
    await logActivity({
      userId: req.user.id,
      action: "updated",
      entityType: "Client",
      entityId: client.id,
      description: `updated client "${client.name}"`,
    });
    return ok(res, client, "Client updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// The only way a client's handler changes. newHandlerId null means the
// engagement is ending with no replacement (a termination); otherwise
// it's a handoff to someone else (a transfer). Either way, `reason` is
// required so there's always an auditable answer to "why did this client
// leave this person's list".
async function transferClientHandler(req, res) {
  try {
    const { id } = req.params;
    const { newHandlerId, reason } = req.body;
    if (!reason?.trim()) return fail(res, 400, "A reason is required to transfer or end a client engagement");

    const client = await prisma.client.findUnique({ where: { id: Number(id) } });
    if (!client) return fail(res, 404, "Client not found");

    const previousHandlerId = client.handledById;
    const resolvedNewHandlerId = newHandlerId ? Number(newHandlerId) : null;

    if (previousHandlerId === resolvedNewHandlerId) {
      return fail(res, 400, "That's already who's handling this client");
    }

    const [updated] = await prisma.$transaction([
      prisma.client.update({
        where: { id: Number(id) },
        data: { handledById: resolvedNewHandlerId },
        include: CLIENT_INCLUDE,
      }),
      prisma.clientHandlerHistory.create({
        data: {
          clientId: Number(id),
          previousHandlerId,
          newHandlerId: resolvedNewHandlerId,
          reason: reason.trim(),
          changedById: req.user.id,
        },
      }),
    ]);

    const isTermination = resolvedNewHandlerId === null;
    const actionWord = isTermination ? "ended the engagement for" : "transferred";
    await logActivity({
      userId: req.user.id,
      action: "updated",
      entityType: "Client",
      entityId: Number(id),
      description: `${actionWord} client "${client.name}"${isTermination ? "" : ""} — ${reason.trim()}`,
    });

    // Let both the outgoing and incoming handler know what happened.
    if (previousHandlerId && previousHandlerId !== req.user.id) {
      await notify({
        userId: previousHandlerId,
        type: "client_handler_change",
        message: isTermination
          ? `${req.user.name} ended your engagement with client "${client.name}": ${reason.trim()}`
          : `${req.user.name} transferred client "${client.name}" from you: ${reason.trim()}`,
        link: "/clients",
        refType: "client",
        refId: Number(id),
      });
    }
    if (resolvedNewHandlerId && resolvedNewHandlerId !== req.user.id) {
      await notify({
        userId: resolvedNewHandlerId,
        type: "client_handler_change",
        message: `${req.user.name} assigned you client "${client.name}": ${reason.trim()}`,
        link: "/clients",
        refType: "client",
        refId: Number(id),
      });
    }

    return ok(res, updated, isTermination ? "Client engagement ended" : "Client transferred");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Full handler-change history for one client — who handled it, when it
// changed, who changed it, and why, each step of the way.
async function getClientHandlerHistory(req, res) {
  const { id } = req.params;
  const client = await prisma.client.findUnique({ where: { id: Number(id) } });
  if (!client) return fail(res, 404, "Client not found");
  if (!canManageClients(req.user) && client.handledById !== req.user.id) {
    return fail(res, 403, "You can only view history for clients you handle");
  }

  const history = await prisma.clientHandlerHistory.findMany({
    where: { clientId: Number(id) },
    include: {
      previousHandler: { select: { id: true, name: true } },
      newHandler: { select: { id: true, name: true } },
      changedBy: { select: { id: true, name: true } },
    },
    orderBy: { changedAt: "desc" },
  });
  return ok(res, history);
}

async function deleteClient(req, res) {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({ where: { id: Number(id) } });
    if (!client) return fail(res, 404, "Client not found");
    await prisma.client.delete({ where: { id: Number(id) } });
    await logActivity({
      userId: req.user.id,
      action: "deleted",
      entityType: "Client",
      entityId: Number(id),
      description: `deleted client "${client.name}"`,
    });
    return ok(res, null, "Client deleted");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = {
  listClients,
  getClient,
  createClient,
  updateClient,
  transferClientHandler,
  getClientHandlerHistory,
  deleteClient,
};
