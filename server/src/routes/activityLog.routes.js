const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { listActivity } = require("../controllers/activityLog.controller");

router.use(requireAuth);
// Broadly visible to anyone who manages something, mirroring the dashboard overview's gate.
router.get("/", requirePermission(["users.manage", "projects.manage", "clients.manage"]), listActivity);

module.exports = router;
