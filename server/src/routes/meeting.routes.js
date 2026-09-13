const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { listMeetings, createMeeting, updateMeeting, deleteMeeting, respondToMeeting } = require("../controllers/meeting.controller");

router.use(requireAuth);
router.get("/", listMeetings); // ?start=&end=
router.post("/", createMeeting);
router.put("/:id", updateMeeting);
router.delete("/:id", deleteMeeting);
router.post("/:id/rsvp", respondToMeeting);

module.exports = router;
