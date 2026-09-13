const router = require("express").Router();
const { requireAuth } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { uploadTaskFile } = require("../middleware/upload.middleware");
const {
  listTasksByProject,
  listTasksForCalendar,
  listMyTasks,
  getTask,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  addComment,
  listAttachments,
  addAttachment,
  deleteAttachment,
} = require("../controllers/task.controller");

router.use(requireAuth);
router.get("/my-tasks", listMyTasks);
router.get("/calendar", listTasksForCalendar); // ?start=&end= (ISO dates), defaults to current month
router.get("/project/:projectId", requirePermission(["tasks.view", "tasks.manage"]), listTasksByProject);
router.post("/project/:projectId", requirePermission("tasks.manage"), createTask);
router.get("/:id", requirePermission(["tasks.view", "tasks.manage"]), getTask);
router.put("/:id", requirePermission("tasks.manage"), updateTask);
router.put("/:id/move", requirePermission(["tasks.manage", "tasks.update_own"]), moveTask);
router.delete("/:id", requirePermission("tasks.manage"), deleteTask);
router.post("/:id/comments", addComment);
router.get("/:id/attachments", listAttachments);
router.post("/:id/attachments", uploadTaskFile.single("file"), addAttachment);
router.delete("/:id/attachments/:attachmentId", deleteAttachment);

module.exports = router;
