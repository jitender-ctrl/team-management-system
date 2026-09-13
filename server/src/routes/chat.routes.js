const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload.middleware");
const {
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
} = require("../controllers/chat.controller");

router.use(requireAuth);
router.get("/conversations", listConversations);
router.post("/conversations/direct/:userId", openDirectConversation);
router.post("/conversations/project/:projectId", openProjectConversation);
router.post("/conversations/group", createGroup);
router.put("/conversations/:id/rename", renameGroup);
router.post("/conversations/:id/members", addGroupMembers);
router.delete("/conversations/:id/members/:memberId", removeGroupMember);
router.post("/conversations/:id/leave", leaveGroup);
router.get("/conversations/:id/messages", listMessages);
router.get("/conversations/:id/messages/search", searchMessages);
router.post("/conversations/:id/read", markConversationRead);
router.post("/conversations/:id/typing", sendTypingSignal);
router.get("/conversations/:id/typing", getTypingSignal);
router.get("/conversations/:id/pinned", listPinnedMessages);
// upload.single("file") parses multipart/form-data when a file is attached;
// if the client sends plain JSON instead (text-only message), multer passes
// the request through untouched and req.file is simply undefined.
router.post("/conversations/:id/messages", upload.single("file"), sendMessage);
router.put("/messages/:id/pin", togglePinMessage);
router.post("/messages/:id/reactions", toggleReaction);

module.exports = router;
