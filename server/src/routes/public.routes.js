const router = require("express").Router();
const { getPortalProject } = require("../controllers/public.controller");

// Deliberately NOT behind requireAuth — this is the client-facing portal.
// Mounted at /api/portal in index.js, so this resolves to GET /api/portal/:token
router.get("/:token", getPortalProject);

module.exports = router;
