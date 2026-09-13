const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  listClients,
  getClient,
  createClient,
  updateClient,
  transferClientHandler,
  getClientHandlerHistory,
  deleteClient,
} = require("../controllers/client.controller");

router.use(requireAuth);
router.get("/", requirePermission(["clients.view", "clients.manage"]), listClients);
router.get("/:id", requirePermission(["clients.view", "clients.manage"]), getClient);
router.post("/", requirePermission("clients.manage"), createClient);
router.put("/:id", requirePermission("clients.manage"), updateClient);
router.get("/:id/handler-history", requirePermission(["clients.view", "clients.manage"]), getClientHandlerHistory);
router.put("/:id/handler", requirePermission("clients.manage"), transferClientHandler);
router.delete("/:id", requirePermission("clients.manage"), deleteClient);

module.exports = router;
