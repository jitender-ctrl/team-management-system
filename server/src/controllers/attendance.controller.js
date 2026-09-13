const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");
const { notify } = require("../utils/notify");

const BREAK_LIMIT_MINUTES = 60;

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Total minutes across every break logged today (closed breaks use their
// real duration; a still-open break counts up to right now).
function totalBreakMinutes(breaks) {
  const now = Date.now();
  return breaks.reduce((sum, b) => {
    const end = b.endTime ? new Date(b.endTime).getTime() : now;
    return sum + (end - new Date(b.startTime).getTime()) / 60000;
  }, 0);
}

async function checkIn(req, res) {
  try {
    const date = todayDate();
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId: req.user.id, date } },
    });
    if (existing) return fail(res, 400, "Already checked in today");

    const attendance = await prisma.attendance.create({
      data: { userId: req.user.id, date, checkIn: new Date() },
    });
    return created(res, attendance);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function checkOut(req, res) {
  try {
    const date = todayDate();
    const attendance = await prisma.attendance.update({
      where: { userId_date: { userId: req.user.id, date } },
      data: { checkOut: new Date() },
    });
    return ok(res, attendance, "Checked out");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function startBreak(req, res) {
  try {
    const { type } = req.body;
    const date = todayDate();
    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId: req.user.id, date } },
    });
    if (!attendance) return fail(res, 400, "Check in before starting a break");

    const openBreak = await prisma.breakLog.findFirst({
      where: { attendanceId: attendance.id, endTime: null },
    });
    if (openBreak) return fail(res, 400, "A break is already in progress");

    const brk = await prisma.breakLog.create({
      data: { attendanceId: attendance.id, type: type || "Break", startTime: new Date() },
    });
    return created(res, brk);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Ends the break, then checks whether today's *total* break time has
// crossed the 1-hour limit. If so (and it hasn't already been flagged
// today), marks the attendance record and notifies the person's manager
// chain (their direct manager, and that manager's manager, if any) —
// covering both "Team Lead and Manager get the message" from a 2-level
// reporting chain. The employee is notified too, so it's visible to them
// as well, not just their leads.
async function endBreak(req, res) {
  try {
    const { breakId } = req.params;
    const brk = await prisma.breakLog.update({
      where: { id: Number(breakId) },
      data: { endTime: new Date() },
    });

    const attendance = await prisma.attendance.findUnique({
      where: { id: brk.attendanceId },
      include: { breaks: true, user: { select: { id: true, name: true, managerId: true } } },
    });

    const totalMinutes = totalBreakMinutes(attendance.breaks);
    let alertTriggered = false;

    if (totalMinutes > BREAK_LIMIT_MINUTES && !attendance.breakAlertSent) {
      alertTriggered = true;
      await prisma.attendance.update({ where: { id: attendance.id }, data: { breakAlertSent: true } });

      const roundedMinutes = Math.round(totalMinutes);
      const message = `${attendance.user.name} has exceeded the 1-hour daily break limit (${roundedMinutes} min today).`;

      // Notify the person themself...
      await notify({
        userId: attendance.user.id,
        type: "break_alert",
        message: `You've exceeded the 1-hour daily break limit (${roundedMinutes} min today).`,
        link: "/attendance",
        refType: "attendance",
        refId: attendance.id,
      });

      // ...and walk up to 2 levels of their reporting chain (covers
      // Team Lead + Manager in the standard hierarchy).
      let managerId = attendance.user.managerId;
      let levels = 0;
      while (managerId && levels < 2) {
        await notify({
          userId: managerId,
          type: "break_alert",
          message,
          link: "/attendance",
          refType: "attendance",
          refId: attendance.id,
        });
        const managerRecord = await prisma.user.findUnique({ where: { id: managerId }, select: { managerId: true } });
        managerId = managerRecord?.managerId || null;
        levels++;
      }
    }

    return ok(res, { ...brk, totalBreakMinutesToday: Math.round(totalMinutes), breakAlertTriggered: alertTriggered }, "Break ended");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function myAttendanceToday(req, res) {
  const date = todayDate();
  const attendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId: req.user.id, date } },
    include: { breaks: true },
  });
  if (!attendance) return ok(res, null);

  const totalMinutes = totalBreakMinutes(attendance.breaks);
  return ok(res, {
    ...attendance,
    totalBreakMinutesToday: Math.round(totalMinutes),
    overBreakLimit: totalMinutes > BREAK_LIMIT_MINUTES,
  });
}

// For managers: view a date range across the team.
async function teamAttendance(req, res) {
  const { from, to } = req.query;
  const where = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }
  const records = await prisma.attendance.findMany({
    where,
    include: { user: { select: { id: true, name: true } }, breaks: true },
    orderBy: { date: "desc" },
  });
  const shaped = records.map((r) => {
    const totalMinutes = totalBreakMinutes(r.breaks);
    return { ...r, totalBreakMinutesToday: Math.round(totalMinutes), overBreakLimit: totalMinutes > BREAK_LIMIT_MINUTES };
  });
  return ok(res, shaped);
}

module.exports = { checkIn, checkOut, startBreak, endBreak, myAttendanceToday, teamAttendance };
