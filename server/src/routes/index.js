const router = require("express").Router();

router.use("/auth", require("./auth.routes"));
router.use("/users", require("./user.routes"));
router.use("/roles", require("./role.routes"));
router.use("/clients", require("./client.routes"));
router.use("/projects", require("./project.routes"));
router.use("/task-statuses", require("./taskStatus.routes"));
router.use("/tasks", require("./task.routes"));
router.use("/attendance", require("./attendance.routes"));
router.use("/dashboard", require("./dashboard.routes"));
router.use("/notifications", require("./notification.routes"));
router.use("/chat", require("./chat.routes"));
router.use("/complaints", require("./complaint.routes"));
router.use("/work-updates", require("./dailyUpdate.routes"));
router.use("/search", require("./search.routes"));
router.use("/activity-log", require("./activityLog.routes"));
router.use("/meetings", require("./meeting.routes"));
router.use("/time-entries", require("./timeEntry.routes"));

module.exports = router;
