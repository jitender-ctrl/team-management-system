const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
  generatePortalLink,
  revokePortalLink,
} = require("../controllers/project.controller");

router.use(requireAuth);
router.get("/", requirePermission(["projects.view", "projects.manage"]), listProjects);
router.get("/:id", requirePermission(["projects.view", "projects.manage"]), getProject);
router.post("/", requirePermission("projects.manage"), createProject);
router.put("/:id", requirePermission("projects.manage"), updateProject);
router.delete("/:id", requirePermission("projects.manage"), deleteProject);
router.post("/:id/members", requirePermission("projects.manage"), addMember);
router.delete("/:id/members/:userId", requirePermission("projects.manage"), removeMember);
router.post("/:id/portal-link", requirePermission("projects.manage"), generatePortalLink);
router.delete("/:id/portal-link", requirePermission("projects.manage"), revokePortalLink);

module.exports = router;
