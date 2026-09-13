const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  listStatuses,
  createStatus,
  updateStatus,
  reorderStatuses,
  deleteStatus,
} = require("../controllers/taskStatus.controller");

router.use(requireAuth);
router.get("/project/:projectId", requirePermission(["projects.view", "projects.manage"]), listStatuses);
router.post("/project/:projectId", requirePermission("projects.manage"), createStatus);
router.put("/reorder", requirePermission("projects.manage"), reorderStatuses);
router.put("/:statusId", requirePermission("projects.manage"), updateStatus);
router.delete("/:statusId", requirePermission("projects.manage"), deleteStatus);

module.exports = router;
