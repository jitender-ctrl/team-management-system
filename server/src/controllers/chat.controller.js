const prisma = require("../config/prisma");
const { ok, created, fail } = require("../utils/response");
const { notify } = require("../utils/notify");

// In-memory "typing" presence. Ephemeral by nature (a stale entry just means
// the indicator disappears a few seconds late), so it doesn't need to be a
// DB table — this keeps it cheap and avoids write load from every keystroke.
// Shape: Map<conversationId, Map<userId, { name: string, at: number }>>
const typingState = new Map();
const TYPING_TTL_MS = 5000;

function setTyping(conversationId, userId, name) {
  if (!typingState.has(conversationId)) typingState.set(conversationId, new Map());
  typingState.get(conversationId).set(userId, { name, at: Date.now() });
}

function getTypingUsers(conversationId, excludeUserId) {
  const entries = typingState.get(conversationId);
  if (!entries) return [];
  const now = Date.now();
  const active = [];
  for (const [userId, { name, at }] of entries) {
    if (now - at > TYPING_TTL_MS) {
      entries.delete(userId);
      continue;
    }
    if (userId !== excludeUserId) active.push({ userId, name });
  }
  return active;
}

// List every conversation the current user is part of: direct chats,
// project group chats, and custom user-created groups — with the other
// participant's name (for DIRECT), member list (for GROUP), and last
// message preview.
async function listConversations(req, res) {
  const userId = req.user.id;

  const direct = await prisma.conversation.findMany({
    where: { type: "DIRECT", participants: { some: { userId } } },
    include: {
      participants: { include: { user: { select: { id: true, name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const projectChats = await prisma.conversation.findMany({
    where: { type: "PROJECT", project: { members: { some: { userId } } } },
    include: {
      project: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const groups = await prisma.conversation.findMany({
    where: { type: "GROUP", participants: { some: { userId } } },
    include: {
      participants: { include: { user: { select: { id: true, name: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { id: "desc" },
  });

  const directFormatted = direct.map((c) => ({
    id: c.id,
    type: "DIRECT",
    with: c.participants.map((p) => p.user).find((u) => u.id !== userId) || null,
    lastMessage: c.messages[0] || null,
  }));

  const projectFormatted = projectChats.map((c) => ({
    id: c.id,
    type: "PROJECT",
    project: c.project,
    lastMessage: c.messages[0] || null,
  }));

  const groupFormatted = groups.map((c) => ({
    id: c.id,
    type: "GROUP",
    name: c.name,
    members: c.participants.map((p) => p.user),
    createdById: c.createdById,
    lastMessage: c.messages[0] || null,
  }));

  return ok(res, { direct: directFormatted, projects: projectFormatted, groups: groupFormatted });
}

// Create a custom group chat with any set of members (not tied to a project).
async function createGroup(req, res) {
  try {
    const { name, memberIds } = req.body;
    if (!name?.trim()) return fail(res, 400, "Group name is required");
    const ids = Array.from(new Set([req.user.id, ...(memberIds || []).map(Number)]));
    if (ids.length < 2) return fail(res, 400, "Pick at least one other member");

    const conversation = await prisma.conversation.create({
      data: {
        type: "GROUP",
        name: name.trim(),
        createdById: req.user.id,
        participants: { create: ids.map((userId) => ({ userId })) },
      },
      include: { participants: { include: { user: { select: { id: true, name: true } } } } },
    });

    for (const userId of ids.filter((id) => id !== req.user.id)) {
      await notify({
        userId,
        type: "chat_message",
        message: `${req.user.name} added you to the group "${conversation.name}"`,
        link: `/chat?group=${conversation.id}`,
        refType: "conversation",
        refId: conversation.id,
      });
    }

    return created(res, {
      id: conversation.id,
      type: "GROUP",
      name: conversation.name,
      members: conversation.participants.map((p) => p.user),
      createdById: conversation.createdById,
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function requireGroupAdmin(conversationId, userId) {
  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!convo || convo.type !== "GROUP") return null;
  if (convo.createdById !== userId) return false;
  return convo;
}

async function renameGroup(req, res) {
  try {
    const conversationId = Number(req.params.id);
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, "Group name is required");
    const isAdmin = await requireGroupAdmin(conversationId, req.user.id);
    if (isAdmin === null) return fail(res, 404, "Group not found");
    if (isAdmin === false) return fail(res, 403, "Only the group creator can rename it");
    const updated = await prisma.conversation.update({ where: { id: conversationId }, data: { name: name.trim() } });
    return ok(res, updated, "Group renamed");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function addGroupMembers(req, res) {
  try {
    const conversationId = Number(req.params.id);
    const { memberIds } = req.body;
    const isAdmin = await requireGroupAdmin(conversationId, req.user.id);
    if (isAdmin === null) return fail(res, 404, "Group not found");
    if (isAdmin === false) return fail(res, 403, "Only the group creator can add members");

    for (const userId of (memberIds || []).map(Number)) {
      await prisma.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        create: { conversationId, userId },
        update: {},
      });
      if (userId !== req.user.id) {
        await notify({
          userId,
          type: "chat_message",
          message: `${req.user.name} added you to a group chat`,
          link: `/chat?group=${conversationId}`,
          refType: "conversation",
          refId: conversationId,
        });
      }
    }
    return ok(res, null, "Members added");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function removeGroupMember(req, res) {
  try {
    const conversationId = Number(req.params.id);
    const memberId = Number(req.params.memberId);
    const isAdmin = await requireGroupAdmin(conversationId, req.user.id);
    if (isAdmin === null) return fail(res, 404, "Group not found");
    if (isAdmin === false) return fail(res, 403, "Only the group creator can remove members");
    if (memberId === req.user.id) return fail(res, 400, "Use 'leave group' to remove yourself");

    await prisma.conversationParticipant.deleteMany({ where: { conversationId, userId: memberId } });
    return ok(res, null, "Member removed");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function leaveGroup(req, res) {
  try {
    const conversationId = Number(req.params.id);
    const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!convo || convo.type !== "GROUP") return fail(res, 404, "Group not found");
    await prisma.conversationParticipant.deleteMany({ where: { conversationId, userId: req.user.id } });
    return ok(res, null, "Left group");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Finds or creates the 1-on-1 conversation between the current user and
// another user, and returns its id (used before opening a direct chat).
async function openDirectConversation(req, res) {
  try {
    const otherUserId = Number(req.params.userId);
    if (otherUserId === req.user.id) return fail(res, 400, "Cannot message yourself");

    const existing = await prisma.conversation.findFirst({
      where: {
        type: "DIRECT",
        AND: [
          { participants: { some: { userId: req.user.id } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
    });
    if (existing) return ok(res, existing);

    const conversation = await prisma.conversation.create({
      data: {
        type: "DIRECT",
        participants: { create: [{ userId: req.user.id }, { userId: otherUserId }] },
      },
    });
    return created(res, conversation);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// A project's group chat is created alongside the project (see
// project.controller.js), but this fills in the gap for projects that
// existed before chat was added.
async function openProjectConversation(req, res) {
  try {
    const projectId = Number(req.params.projectId);
    const existing = await prisma.conversation.findUnique({ where: { projectId } });
    if (existing) return ok(res, existing);
    const conversation = await prisma.conversation.create({ data: { type: "PROJECT", projectId } });
    return created(res, conversation);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function isParticipant(conversationId, userId) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { project: { include: { members: true } } },
  });
  if (!convo) return false;
  if (convo.type === "PROJECT") {
    return convo.project?.members.some((m) => m.userId === userId) || false;
  }
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return !!participant;
}

// Client polls this on an interval while a chat window is open — simple and
// reliable without adding a websocket server. `after` lets it fetch only
// new messages since the last poll.
async function listMessages(req, res) {
  const conversationId = Number(req.params.id);
  if (!(await isParticipant(conversationId, req.user.id))) return fail(res, 403, "Not part of this conversation");

  const { after } = req.query;
  const [messages, participants] = await Promise.all([
    prisma.message.findMany({
      where: {
        conversationId,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      include: {
        sender: { select: { id: true, name: true } },
        reactions: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    // Read receipts: rows only exist for people who have opened this
    // conversation at least once (see markConversationRead), so absence
    // just means "hasn't read it yet" rather than an error.
    prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true, lastReadAt: true },
    }),
  ]);

  const shaped = messages.map((m) => {
    const grouped = {};
    for (const r of m.reactions) {
      grouped[r.emoji] = grouped[r.emoji] || { emoji: r.emoji, count: 0, userIds: [], reactedByMe: false };
      grouped[r.emoji].count++;
      grouped[r.emoji].userIds.push(r.userId);
      if (r.userId === req.user.id) grouped[r.emoji].reactedByMe = true;
    }
    const { reactions, ...rest } = m;
    return { ...rest, reactions: Object.values(grouped) };
  });

  return ok(res, { messages: shaped, readReceipts: participants });
}

// Search message bodies within one conversation (case-insensitive substring).
async function searchMessages(req, res) {
  const conversationId = Number(req.params.id);
  const { q } = req.query;
  if (!(await isParticipant(conversationId, req.user.id))) return fail(res, 403, "Not part of this conversation");
  if (!q?.trim()) return ok(res, []);

  const matches = await prisma.message.findMany({
    where: { conversationId, body: { contains: q.trim(), mode: "insensitive" } },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok(res, matches);
}

// Marks the conversation as read up to now for the current user. Creates
// the participant row on first read for conversation types (PROJECT) that
// don't pre-populate ConversationParticipant.
async function markConversationRead(req, res) {
  try {
    const conversationId = Number(req.params.id);
    if (!(await isParticipant(conversationId, req.user.id))) return fail(res, 403, "Not part of this conversation");
    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId: req.user.id } },
      create: { conversationId, userId: req.user.id, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return ok(res, null);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Called (throttled client-side) while someone has text in the composer.
async function sendTypingSignal(req, res) {
  const conversationId = Number(req.params.id);
  if (!(await isParticipant(conversationId, req.user.id))) return fail(res, 403, "Not part of this conversation");
  setTyping(conversationId, req.user.id, req.user.name);
  return ok(res, null);
}

async function getTypingSignal(req, res) {
  const conversationId = Number(req.params.id);
  if (!(await isParticipant(conversationId, req.user.id))) return fail(res, 403, "Not part of this conversation");
  return ok(res, getTypingUsers(conversationId, req.user.id));
}

async function togglePinMessage(req, res) {
  try {
    const messageId = Number(req.params.id);
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return fail(res, 404, "Message not found");
    if (!(await isParticipant(message.conversationId, req.user.id))) return fail(res, 403, "Not part of this conversation");

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { pinned: !message.pinned, pinnedAt: !message.pinned ? new Date() : null },
    });
    return ok(res, updated, updated.pinned ? "Message pinned" : "Message unpinned");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function listPinnedMessages(req, res) {
  const conversationId = Number(req.params.id);
  if (!(await isParticipant(conversationId, req.user.id))) return fail(res, 403, "Not part of this conversation");
  const pinned = await prisma.message.findMany({
    where: { conversationId, pinned: true },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { pinnedAt: "desc" },
  });
  return ok(res, pinned);
}

// Toggle: reacting again with the same emoji removes it.
async function toggleReaction(req, res) {
  try {
    const messageId = Number(req.params.id);
    const { emoji } = req.body;
    if (!emoji) return fail(res, 400, "emoji is required");

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return fail(res, 404, "Message not found");
    if (!(await isParticipant(message.conversationId, req.user.id))) return fail(res, 403, "Not part of this conversation");

    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId: req.user.id, emoji } },
    });

    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
      return ok(res, null, "Reaction removed");
    }
    await prisma.messageReaction.create({ data: { messageId, userId: req.user.id, emoji } });
    return created(res, null, "Reaction added");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function sendMessage(req, res) {
  try {
    const conversationId = Number(req.params.id);
    const { body } = req.body;
    const file = req.file; // set by multer when a file is attached (see chat.routes.js)

    if (!body?.trim() && !file) return fail(res, 400, "Message needs text or a file");
    if (!(await isParticipant(conversationId, req.user.id))) return fail(res, 403, "Not part of this conversation");

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user.id,
        body: body?.trim() || null,
        ...(file && {
          fileUrl: `/uploads/chat/${file.filename}`,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
        }),
      },
      include: { sender: { select: { id: true, name: true } } },
    });

    // Notify the other participant(s), skipping the sender.
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
        project: { select: { id: true, name: true, members: true } },
      },
    });
    const recipientIds =
      convo.type === "PROJECT"
        ? convo.project.members.map((m) => m.userId).filter((id) => id !== req.user.id)
        : convo.participants.map((p) => p.userId).filter((id) => id !== req.user.id);

    const label = convo.type === "PROJECT" ? `in ${convo.project.name}` : convo.type === "GROUP" ? `in ${convo.name}` : "";
    const preview = file ? "sent a file" : "sent a message";
    for (const userId of recipientIds) {
      await notify({
        userId,
        type: "chat_message",
        message: `${req.user.name} ${preview} ${label}`.trim(),
        link:
          convo.type === "PROJECT"
            ? `/chat/project/${convo.projectId}`
            : convo.type === "GROUP"
            ? `/chat?group=${conversationId}`
            : `/chat/direct/${conversationId}`,
        refType: "conversation",
        refId: conversationId,
      });
    }

    return created(res, message);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = {
  listConversations,
  openDirectConversation,
  openProjectConversation,
  listMessages,
  sendMessage,
  createGroup,
  renameGroup,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  searchMessages,
  markConversationRead,
  sendTypingSignal,
  getTypingSignal,
  togglePinMessage,
  listPinnedMessages,
  toggleReaction,
};
