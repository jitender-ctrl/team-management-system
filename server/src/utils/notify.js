const prisma = require("../config/prisma");

// Central place to create a notification so every trigger point (task
// assignment, mentions, complaints, etc.) stays consistent. Checks the
// recipient's notification preferences first — a missing/undefined key
// defaults to "on" so existing users don't silently stop getting alerts
// just because they've never touched the preferences UI.
async function notify({ userId, type, message, link = null, refType = null, refId = null }) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
  const prefs = user?.notificationPrefs || {};
  if (prefs[type] === false) return null; // user has explicitly turned this type off

  return prisma.notification.create({
    data: { userId, type, message, link, refType, refId },
  });
}

// Avoids creating the same alert twice for the same user + thing,
// e.g. "task overdue" for the same task shouldn't repeat every time it's checked.
async function notifyOnce({ userId, type, message, link = null, refType, refId }) {
  if (!userId) return null;
  const existing = await prisma.notification.findFirst({
    where: { userId, type, refType, refId },
  });
  if (existing) return existing;
  return notify({ userId, type, message, link, refType, refId });
}

// Parses "@Name" mentions out of a comment body against a list of candidate
// users (e.g. project members) and returns the matched User records.
function extractMentionedUsers(text, candidateUsers) {
  if (!text) return [];
  const mentioned = [];
  for (const u of candidateUsers) {
    const firstName = u.name.split(" ")[0];
    const pattern = new RegExp(`@${firstName}\\b`, "i");
    if (pattern.test(text)) mentioned.push(u);
  }
  return mentioned;
}

module.exports = { notify, notifyOnce, extractMentionedUsers };
