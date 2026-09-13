const prisma = require("../config/prisma");
const { ok } = require("../utils/response");

// The Admin/Manager "master" overview: organization-wide totals plus a
// per-team-member breakdown, so an Admin can see everything from one screen
// instead of clicking into Team / Clients / Projects separately.
async function getOverview(req, res) {
  const now = new Date();

  const [
    teamTotal,
    teamActive,
    clientsTotal,
    projectsTotal,
    projectsActive,
    tasksTotal,
    tasksCompleted,
    tasksOverdue,
    users,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.client.count(),
    prisma.project.count(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.task.count(),
    prisma.task.count({ where: { status: { isDone: true } } }),
    prisma.task.count({ where: { dueDate: { lt: now }, status: { isDone: false } } }),
    prisma.user.findMany({
      include: {
        role: { select: { name: true } },
        projectMembers: { select: { projectId: true } },
        assignedTasks: {
          select: { id: true, dueDate: true, status: { select: { isDone: true } } },
        },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const team = users.map((u) => {
    const tasks = u.assignedTasks;
    const completed = tasks.filter((t) => t.status.isDone).length;
    const overdue = tasks.filter((t) => !t.status.isDone && t.dueDate && t.dueDate < now).length;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role?.name,
      isActive: u.isActive,
      projectsCount: u.projectMembers.length,
      tasksTotal: tasks.length,
      tasksCompleted: completed,
      tasksPending: tasks.length - completed,
      tasksOverdue: overdue,
    };
  });

  return ok(res, {
    totals: {
      teamTotal,
      teamActive,
      clientsTotal,
      projectsTotal,
      projectsActive,
      tasksTotal,
      tasksCompleted,
      tasksPending: tasksTotal - tasksCompleted,
      tasksOverdue,
    },
    team,
  });
}

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10); // YYYY-MM-DD
}

function lastNDays(n) {
  const days = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

// Everything the graphical Admin Analytics dashboard needs, in one call so
// the frontend only fires one request and renders every chart from it.
async function getAnalytics(req, res) {
  const now = new Date();
  const rangeDays = Math.min(Math.max(Number(req.query.days) || 30, 7), 180);
  const since = new Date(now);
  since.setDate(since.getDate() - rangeDays);

  const [tasksInRange, allActiveUsers, projects, clients, attendanceInRange, complaints] = await Promise.all([
    prisma.task.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        dueDate: true,
        priority: true,
        assigneeId: true,
        assignee: { select: { id: true, name: true } },
        status: { select: { isDone: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        role: { select: { name: true } },
        assignedTasks: {
          select: { id: true, dueDate: true, createdAt: true, updatedAt: true, status: { select: { isDone: true } } },
        },
      },
    }),
    prisma.project.findMany({
      select: { id: true, name: true, status: true, client: { select: { id: true, name: true } } },
    }),
    prisma.client.count(),
    prisma.attendance.findMany({
      where: { date: { gte: since } },
      select: { date: true, checkIn: true, checkOut: true },
    }),
    prisma.complaint.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  // 1. Task completion trend: tasks created vs. tasks completed, per day
  const days = lastNDays(rangeDays);
  const createdByDay = Object.fromEntries(days.map((d) => [d, 0]));
  const completedByDay = Object.fromEntries(days.map((d) => [d, 0]));
  for (const t of tasksInRange) {
    const createdKey = dayKey(t.createdAt);
    if (createdKey in createdByDay) createdByDay[createdKey]++;
    if (t.status.isDone) {
      const doneKey = dayKey(t.updatedAt); // best available proxy for completion date
      if (doneKey in completedByDay) completedByDay[doneKey]++;
    }
  }
  const taskTrend = days.map((d) => ({ date: d, created: createdByDay[d], completed: completedByDay[d] }));

  // 2. Project progress: % of each project's tasks that are done
  const projectTaskStats = await prisma.task.groupBy({
    by: ["projectId"],
    _count: { id: true },
  });
  const projectDoneStats = await prisma.task.groupBy({
    by: ["projectId"],
    where: { status: { isDone: true } },
    _count: { id: true },
  });
  const doneMap = Object.fromEntries(projectDoneStats.map((p) => [p.projectId, p._count.id]));
  const totalMap = Object.fromEntries(projectTaskStats.map((p) => [p.projectId, p._count.id]));
  const projectProgress = projects.map((p) => {
    const total = totalMap[p.id] || 0;
    const done = doneMap[p.id] || 0;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      totalTasks: total,
      completedTasks: done,
      progressPct: total ? Math.round((done / total) * 100) : 0,
    };
  });

  // 3. Employee performance leaderboard: completion rate + on-time rate
  const performance = allActiveUsers
    .map((u) => {
      const tasks = u.assignedTasks;
      const completed = tasks.filter((t) => t.status.isDone).length;
      const withDueDate = tasks.filter((t) => t.dueDate);
      const onTime = withDueDate.filter((t) => t.status.isDone && new Date(t.updatedAt) <= new Date(t.dueDate)).length;
      const overdue = tasks.filter((t) => !t.status.isDone && t.dueDate && new Date(t.dueDate) < now).length;
      const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
      const onTimeRate = withDueDate.length ? Math.round((onTime / withDueDate.length) * 100) : null;
      // Simple composite score used for ranking: completion rate is the main
      // signal, on-time rate is a bonus/penalty, overdue tasks pull it down.
      const score = Math.max(0, Math.round(completionRate * 0.6 + (onTimeRate ?? completionRate) * 0.4 - overdue * 3));
      return {
        id: u.id,
        name: u.name,
        role: u.role?.name,
        totalTasks: tasks.length,
        completed,
        pending: tasks.length - completed,
        overdue,
        completionRate,
        onTimeRate,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  // 4. Workload distribution: open (non-done) tasks per member
  const workload = performance
    .map((p) => ({ name: p.name, value: p.pending }))
    .filter((w) => w.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // 5. Overdue heatmap by employee (who's carrying the most overdue work)
  const overdueByEmployee = performance
    .filter((p) => p.overdue > 0)
    .map((p) => ({ name: p.name, overdue: p.overdue }))
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 10);

  // 6. Client-wise project status breakdown
  const statusByClient = {};
  for (const p of projects) {
    const clientName = p.client?.name || "No client";
    statusByClient[clientName] = statusByClient[clientName] || {};
    statusByClient[clientName][p.status] = (statusByClient[clientName][p.status] || 0) + 1;
  }
  const clientBreakdown = Object.entries(statusByClient).map(([client, statuses]) => ({ client, ...statuses }));

  // Overall status distribution (for a simple pie)
  const statusCounts = {};
  for (const p of projects) statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  const projectStatusPie = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // 7. Attendance / work-hours trend (team-wide average hours per day)
  const hoursByDay = Object.fromEntries(days.map((d) => [d, { totalHours: 0, count: 0 }]));
  for (const a of attendanceInRange) {
    const key = dayKey(a.date);
    if (!(key in hoursByDay)) continue;
    if (a.checkIn && a.checkOut) {
      const hrs = (new Date(a.checkOut) - new Date(a.checkIn)) / 3600000;
      if (hrs > 0 && hrs < 24) {
        hoursByDay[key].totalHours += hrs;
        hoursByDay[key].count += 1;
      }
    }
  }
  const attendanceTrend = days.map((d) => ({
    date: d,
    avgHours: hoursByDay[d].count ? +(hoursByDay[d].totalHours / hoursByDay[d].count).toFixed(1) : 0,
    checkins: hoursByDay[d].count,
  }));

  // 8. Complaints by status (small extra chart, cheap to include)
  const complaintsByStatus = complaints.map((c) => ({ name: c.status, value: c._count.status }));

  return ok(res, {
    rangeDays,
    taskTrend,
    projectProgress,
    performance,
    workload,
    overdueByEmployee,
    clientBreakdown,
    projectStatusPie,
    attendanceTrend,
    complaintsByStatus,
    totals: { clients, projects: projects.length, activeEmployees: allActiveUsers.length },
  });
}

module.exports = { getOverview, getAnalytics };
