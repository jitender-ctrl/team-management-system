const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { listRoles, createRole, updateRole, deleteRole } = require("../controllers/role.controller");

router.use(requireAuth);
router.get("/", listRoles); // anyone logged in can see role names (needed for dropdowns)
router.post("/", requirePermission("users.manage"), createRole);
router.put("/:id", requirePermission("users.manage"), updateRole);
router.delete("/:id", requirePermission("users.manage"), deleteRole);

module.exports = router;
