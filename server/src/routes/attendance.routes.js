const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  checkIn,
  checkOut,
  startBreak,
  endBreak,
  myAttendanceToday,
  teamAttendance,
} = require("../controllers/attendance.controller");

router.use(requireAuth);
router.get("/me/today", myAttendanceToday);
router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.post("/break/start", startBreak);
router.put("/break/:breakId/end", endBreak);
router.get("/team", requirePermission("attendance.view_all"), teamAttendance);

module.exports = router;
