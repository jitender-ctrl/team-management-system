const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { listNotifications, markRead, markAllRead } = require("../controllers/notification.controller");

router.use(requireAuth);
router.get("/", listNotifications);
router.put("/:id/read", markRead);
router.put("/read-all", markAllRead);

module.exports = router;
