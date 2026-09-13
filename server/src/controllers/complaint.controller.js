const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");
const { notify } = require("../utils/notify");

// Any authenticated user can raise a complaint about anything — a coworker,
// a client, workload, etc. Only Admin/Manager (complaints.manage) can see
// the full list and resolve them; everyone can see their own.

async function createComplaint(req, res) {
  try {
    const { subject, description } = req.body;
    if (!subject || !description) return fail(res, 400, "subject and description are required");

    const complaint = await prisma.complaint.create({
      data: { subject, description, raisedById: req.user.id },
    });

    // Let every Admin/Manager know a complaint was raised.
    const managers = await prisma.user.findMany({
      where: { role: { permissions: { path: ["complaints.manage"], equals: true } } },
      select: { id: true },
    });
    // Fallback: also cover the "*" super-admin role, whose permission map
    // doesn't literally contain "complaints.manage".
    const superAdmins = await prisma.user.findMany({
      where: { role: { permissions: { path: ["*"], equals: true } } },
      select: { id: true },
    });
    const recipientIds = new Set([...managers.map((m) => m.id), ...superAdmins.map((m) => m.id)]);
    for (const userId of recipientIds) {
      await notify({
        userId,
        type: "complaint_raised",
        message: `${req.user.name} raised a complaint: "${subject}"`,
        link: "/complaints",
        refType: "complaint",
        refId: complaint.id,
      });
    }

    return created(res, complaint);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function listMyComplaints(req, res) {
  const complaints = await prisma.complaint.findMany({
    where: { raisedById: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, complaints);
}

async function listAllComplaints(req, res) {
  const complaints = await prisma.complaint.findMany({
    include: {
      raisedBy: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, complaints);
}

async function updateComplaint(req, res) {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;
    const complaint = await prisma.complaint.update({
      where: { id: Number(id) },
      data: {
        ...(status && { status }),
        ...(resolutionNote !== undefined && { resolutionNote }),
        ...(status && status !== "OPEN" && { resolvedById: req.user.id }),
      },
    });

    if (status) {
      await notify({
        userId: complaint.raisedById,
        type: "complaint_update",
        message: `Your complaint "${complaint.subject}" is now ${status.replace("_", " ").toLowerCase()}`,
        link: "/complaints",
        refType: "complaint",
        refId: complaint.id,
      });
    }

    return ok(res, complaint, "Complaint updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = { createComplaint, listMyComplaints, listAllComplaints, updateComplaint };
