const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");
const { notify } = require("../utils/notify");
const { logActivity } = require("../utils/activityLog");
const { sendMeetingInviteEmail } = require("../utils/mailer");

const MEETING_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  attendees: { include: { user: { select: { id: true, name: true } } } },
  guests: { include: { client: { select: { id: true, name: true, company: true } } } },
};

// Meetings the current user is either the creator or an invited attendee
// of, in a date range — powers the Calendar view alongside task deadlines.
async function listMeetings(req, res) {
  const now = new Date();
  const start = req.query.start ? new Date(req.query.start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = req.query.end ? new Date(req.query.end) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const meetings = await prisma.meeting.findMany({
    where: {
      startTime: { gte: start, lte: end },
      OR: [{ createdById: req.user.id }, { attendees: { some: { userId: req.user.id } } }],
    },
    include: MEETING_INCLUDE,
    orderBy: { startTime: "asc" },
  });
  return ok(res, meetings);
}

// clientIds: existing Client records to invite (their stored email is used).
// guestEmails: freeform external guests not in the Clients list, e.g.
// [{ email, name }] — for a one-off invite to someone you haven't added
// as a Client yet.
async function createMeeting(req, res) {
  try {
    const { title, description, startTime, endTime, location, projectId, attendeeIds, clientIds, guestEmails } = req.body;
    if (!title || !startTime || !endTime) return fail(res, 400, "title, startTime, and endTime are required");
    if (new Date(endTime) <= new Date(startTime)) return fail(res, 400, "endTime must be after startTime");

    const attendeeUserIds = Array.from(new Set([req.user.id, ...(attendeeIds || []).map(Number)]));

    // Resolve client guests to their stored email/name.
    let clientGuests = [];
    if (clientIds?.length) {
      const clients = await prisma.client.findMany({
        where: { id: { in: clientIds.map(Number) } },
        select: { id: true, name: true, email: true },
      });
      clientGuests = clients.filter((c) => c.email).map((c) => ({ clientId: c.id, name: c.name, email: c.email }));
    }
    const freeformGuests = (guestEmails || [])
      .filter((g) => g?.email)
      .map((g) => ({ clientId: null, name: g.name || null, email: g.email }));
    const allGuests = [...clientGuests, ...freeformGuests];

    const meeting = await prisma.meeting.create({
      data: {
        title,
        description,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        location,
        projectId: projectId ? Number(projectId) : null,
        createdById: req.user.id,
        attendees: {
          create: attendeeUserIds.map((userId) => ({ userId, rsvp: userId === req.user.id ? "ACCEPTED" : "PENDING" })),
        },
        guests: { create: allGuests },
      },
      include: MEETING_INCLUDE,
    });

    // Notify internal attendees in-app.
    for (const userId of attendeeUserIds.filter((uid) => uid !== req.user.id)) {
      await notify({
        userId,
        type: "meeting_invite",
        message: `${req.user.name} invited you to "${meeting.title}" on ${new Date(meeting.startTime).toLocaleString()}`,
        link: `/calendar`,
        refType: "meeting",
        refId: meeting.id,
      });
    }

    // Email external guests (clients) directly — they have no in-app inbox.
    for (const guest of meeting.guests) {
      const result = await sendMeetingInviteEmail(guest.email, {
        title: meeting.title,
        description: meeting.description,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        location: meeting.location,
        organizerName: req.user.name,
        guestName: guest.name,
      });
      if (result.sent) {
        await prisma.meetingGuest.update({ where: { id: guest.id }, data: { emailSent: true } });
      }
    }

    await logActivity({
      userId: req.user.id,
      action: "created",
      entityType: "Meeting",
      entityId: meeting.id,
      description: `scheduled meeting "${meeting.title}"${allGuests.length ? ` and invited ${allGuests.length} external guest(s)` : ""}`,
    });

    return created(res, meeting);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function updateMeeting(req, res) {
  try {
    const id = Number(req.params.id);
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) return fail(res, 404, "Meeting not found");
    if (meeting.createdById !== req.user.id) return fail(res, 403, "Only the organizer can edit this meeting");

    const { title, description, startTime, endTime, location } = req.body;
    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime && { endTime: new Date(endTime) }),
        ...(location !== undefined && { location }),
      },
      include: MEETING_INCLUDE,
    });
    return ok(res, updated, "Meeting updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function deleteMeeting(req, res) {
  try {
    const id = Number(req.params.id);
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) return fail(res, 404, "Meeting not found");
    if (meeting.createdById !== req.user.id) return fail(res, 403, "Only the organizer can cancel this meeting");
    await prisma.meeting.delete({ where: { id } });
    return ok(res, null, "Meeting cancelled");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function respondToMeeting(req, res) {
  try {
    const id = Number(req.params.id);
    const { rsvp } = req.body; // "ACCEPTED" | "DECLINED"
    if (!["ACCEPTED", "DECLINED"].includes(rsvp)) return fail(res, 400, "rsvp must be ACCEPTED or DECLINED");

    await prisma.meetingAttendee.update({
      where: { meetingId_userId: { meetingId: id, userId: req.user.id } },
      data: { rsvp },
    });
    return ok(res, null, "RSVP updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = { listMeetings, createMeeting, updateMeeting, deleteMeeting, respondToMeeting };
