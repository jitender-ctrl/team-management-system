const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const {
  startTimer,
  stopTimer,
  getRunningTimer,
  logManualEntry,
  listTaskEntries,
  deleteEntry,
  myTimeSummary,
} = require("../controllers/timeEntry.controller");

router.use(requireAuth);
router.get("/running", getRunningTimer);
router.get("/my-summary", myTimeSummary); // ?start=&end=
router.post("/tasks/:taskId/start", startTimer);
router.post("/tasks/:taskId/stop", stopTimer);
router.post("/tasks/:taskId/manual", logManualEntry);
router.get("/tasks/:taskId", listTaskEntries);
router.delete("/:id", deleteEntry);

module.exports = router;
