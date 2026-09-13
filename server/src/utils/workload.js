const prisma = require("../config/prisma");

// A simple weighted points system so priority mixes can be compared on one
// scale, matching the intent "3 HIGH tasks = full; 1 HIGH leaves room for
// ~2 MEDIUM/LOW" rather than a rigid per-priority count table.
const PRIORITY_WEIGHTS = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };
const MAX_WORKLOAD_POINTS = 9; // == exactly 3 HIGH-priority tasks' worth

// Sum of priority-weighted points across a user's currently open
// (not-done) tasks, optionally excluding one task (e.g. the task being
// edited, so it doesn't count against its own new priority).
async function getOpenWorkloadPoints(userId, excludeTaskId) {
  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { isDone: false },
      ...(excludeTaskId && { id: { not: excludeTaskId } }),
    },
    select: { priority: true },
  });
  return tasks.reduce((sum, t) => sum + (PRIORITY_WEIGHTS[t.priority] || 0), 0);
}

// Hard cap check: would assigning a task of `priority` push this person
// over MAX_WORKLOAD_POINTS? Returns enough detail to build a clear error
// message (current load, what the new task would add, the cap).
async function checkWorkloadCapacity(userId, priority, excludeTaskId) {
  const current = await getOpenWorkloadPoints(userId, excludeTaskId);
  const addition = PRIORITY_WEIGHTS[priority] || PRIORITY_WEIGHTS.MEDIUM;
  const projected = current + addition;
  return {
    allowed: projected <= MAX_WORKLOAD_POINTS,
    current,
    addition,
    projected,
    max: MAX_WORKLOAD_POINTS,
  };
}

module.exports = { PRIORITY_WEIGHTS, MAX_WORKLOAD_POINTS, getOpenWorkloadPoints, checkWorkloadCapacity };
