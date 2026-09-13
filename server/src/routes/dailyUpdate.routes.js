const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { upsertToday, listUpdates, deleteUpdate } = require("../controllers/dailyUpdate.controller");

router.use(requireAuth);
router.get("/", listUpdates); // ?userId=&limit=
router.post("/", upsertToday);
router.delete("/:id", deleteUpdate);

module.exports = router;
