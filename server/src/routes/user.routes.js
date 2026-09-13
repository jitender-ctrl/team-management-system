const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { uploadAvatar } = require("../middleware/upload.middleware");
const {
  listUsers,
  listAssignableUsers,
  getUserById,
  getUserReport,
  createUser,
  updateUser,
  updateAvatar,
  updateNotificationPreferences,
  deactivateUser,
  reactivateUser,
  permanentlyDeleteUser,
  bulkAction,
} = require("../controllers/user.controller");

router.use(requireAuth);
router.get("/", listUsers); // needed broadly for assignee dropdowns etc; supports ?search=&roleId=&status=&projectId=
router.get("/assignable", listAssignableUsers); // hierarchy-filtered list for task-assignment dropdowns
router.post("/bulk", requirePermission("users.manage"), bulkAction);
router.get("/:id", getUserById);
router.get("/:id/report", getUserReport);
router.post("/", requirePermission("users.manage"), createUser);
router.put("/:id", updateUser);
router.put("/:id/avatar", uploadAvatar.single("avatar"), updateAvatar);
router.put("/:id/notification-preferences", updateNotificationPreferences);
// Soft delete (deactivate) is the default/safe action.
router.delete("/:id", requirePermission("users.manage"), deactivateUser);
router.put("/:id/reactivate", requirePermission("users.manage"), reactivateUser);
// Hard delete is a separate, explicit endpoint so it can never be triggered
// by accident from the same button as deactivate.
router.delete("/:id/permanent", requirePermission("users.manage"), permanentlyDeleteUser);

module.exports = router;
