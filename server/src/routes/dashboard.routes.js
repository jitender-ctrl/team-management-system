const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { getOverview, getAnalytics } = require("../controllers/dashboard.controller");

router.use(requireAuth);
// Anyone who can manage users, projects, or clients gets the org-wide view —
// this covers Admin (via "*") and the seeded Manager role out of the box.
router.get("/overview", requirePermission(["users.manage", "projects.manage", "clients.manage"]), getOverview);
router.get("/analytics", requirePermission(["users.manage", "projects.manage", "clients.manage"]), getAnalytics);

module.exports = router;
