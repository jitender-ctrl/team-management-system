const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const {
  createComplaint,
  listMyComplaints,
  listAllComplaints,
  updateComplaint,
} = require("../controllers/complaint.controller");

router.use(requireAuth);
router.post("/", createComplaint); // any authenticated user can raise one
router.get("/my", listMyComplaints);
router.get("/", requirePermission("complaints.manage"), listAllComplaints);
router.put("/:id", requirePermission("complaints.manage"), updateComplaint);

module.exports = router;
