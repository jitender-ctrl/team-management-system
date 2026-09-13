const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { search } = require("../controllers/search.controller");

router.use(requireAuth);
router.get("/", search); // ?q=

module.exports = router;
