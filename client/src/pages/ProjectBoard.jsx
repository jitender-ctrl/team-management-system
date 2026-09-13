import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { MessageCircle, Link2, Trash2, X, Check, Paperclip, Pencil, Timer, Play, Square } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { fileUrl, formatBytes } from "../utils/files";
import { toast } from "../utils/toast";

function formatDuration(totalSeconds) {
  if (!totalSeconds) return "0m";
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.round((totalSeconds % 3600) / 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

const PRIORITY_COLORS = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

const EMPTY_TASK_FORM = { title: "", description: "", assigneeId: "", priority: "MEDIUM", dueDate: "" };

export default function ProjectBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [project, setProject] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnIsDone, setNewColumnIsDone] = useState(false);
  const [openFormStatusId, setOpenFormStatusId] = useState(null); // which column's "add task" form is expanded
  const [taskForms, setTaskForms] = useState({}); // { [statusId]: { title, assigneeId, priority } }
  const [activeTask, setActiveTask] = useState(null); // task detail modal
  const [attachments, setAttachments] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [runningTimer, setRunningTimer] = useState(null);
  const [portalInfo, setPortalInfo] = useState(null);
  const [showPortalPanel, setShowPortalPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", status: "PLANNED", startDate: "", endDate: "" });

  const canManage = hasPermission("projects.manage");
  const canAssign = hasPermission("tasks.manage"); // only Team Lead/Manager/Admin can create/assign tasks now

  function loadAll() {
    api.get(`/projects/${id}`).then(({ data }) => {
      setProject(data.data);
      setStatuses(data.data.statuses);
      setEditForm({
        name: data.data.name || "",
        description: data.data.description || "",
        status: data.data.status || "PLANNED",
        startDate: data.data.startDate ? data.data.startDate.slice(0, 10) : "",
        endDate: data.data.endDate ? data.data.endDate.slice(0, 10) : "",
      });
    });
    api.get(`/tasks/project/${id}`).then(({ data }) => setTasks(data.data));
  }

  async function handleUpdateProject(e) {
    e.preventDefault();
    await api.put(`/projects/${id}`, editForm);
    toast.success("Project updated");
    setShowEditPanel(false);
    loadAll();
  }

  useEffect(() => {
    loadAll();
    api.get("/users/assignable").then(({ data }) => setUsers(data.data)).catch(() => {});
  }, [id]);

  function tasksForStatus(statusId) {
    // Plain Employees (no tasks.manage) only see their own cards on the
    // board — everyone else (Team Lead/Manager/Admin) sees the full board.
    const scoped = canAssign ? tasks : tasks.filter((t) => t.assigneeId === user?.id);
    return scoped.filter((t) => t.statusId === statusId).sort((a, b) => a.order - b.order);
  }

  async function handleAddColumn(e) {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    await api.post(`/task-statuses/project/${id}`, { name: newColumnName, isDone: newColumnIsDone });
    setNewColumnName("");
    setNewColumnIsDone(false);
    loadAll();
  }

  async function handleToggleDoneColumn(status) {
    await api.put(`/task-statuses/${status.id}`, { isDone: !status.isDone });
    loadAll();
  }

  async function handleDeleteColumn(statusId) {
    const target = statuses.find((s) => s.id !== statusId);
    if (!confirm("Delete this column? Any tasks in it will move to another column.")) return;
    await api.delete(`/task-statuses/${statusId}`, { data: { moveTasksToStatusId: target?.id } });
    loadAll();
  }

  function getForm(statusId) {
    return taskForms[statusId] || EMPTY_TASK_FORM;
  }

  function setForm(statusId, patch) {
    setTaskForms({ ...taskForms, [statusId]: { ...getForm(statusId), ...patch } });
  }

  async function handleCreateTask(statusId) {
    const form = getForm(statusId);
    if (!form.title?.trim()) return;
    const { data } = await api.post(`/tasks/project/${id}`, {
      title: form.title,
      description: form.description || undefined,
      statusId,
      assigneeId: form.assigneeId || null,
      priority: form.priority || "MEDIUM",
      dueDate: form.dueDate || undefined,
    });

    if (form.file) {
      const uploadForm = new FormData();
      uploadForm.append("file", form.file);
      await api.post(`/tasks/${data.data.id}/attachments`, uploadForm, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }

    setTaskForms({ ...taskForms, [statusId]: EMPTY_TASK_FORM });
    setOpenFormStatusId(null);
    toast.success("Task added");
    loadAll();
  }

  async function handleDragEnd(result) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatusId = Number(destination.droppableId);
    // optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === Number(draggableId) ? { ...t, statusId: newStatusId, order: destination.index } : t))
    );
    await api.put(`/tasks/${draggableId}/move`, { statusId: newStatusId, order: destination.index });
    loadAll();
  }

  async function handleReassign(taskId, assigneeId) {
    const { data } = await api.put(`/tasks/${taskId}`, { assigneeId: assigneeId || null });
    setActiveTask(data.data);
    loadAll();
  }

  async function openTeamChat() {
    await api.post(`/chat/conversations/project/${id}`); // ensures it exists for older projects
    navigate(`/chat?project=${id}`);
  }

  function openTask(taskId) {
    api.get(`/tasks/${taskId}`).then(({ data }) => setActiveTask(data.data));
    api.get(`/tasks/${taskId}/attachments`).then(({ data }) => setAttachments(data.data)).catch(() => setAttachments([]));
    loadTimeEntries(taskId);
    api.get("/time-entries/running").then(({ data }) => setRunningTimer(data.data)).catch(() => {});
  }

  function loadTimeEntries(taskId) {
    api.get(`/time-entries/tasks/${taskId}`).then(({ data }) => {
      setTimeEntries(data.data.entries);
      setTotalSeconds(data.data.totalSeconds);
    });
  }

  async function handleStartTimer() {
    await api.post(`/time-entries/tasks/${activeTask.id}/start`);
    const { data } = await api.get("/time-entries/running");
    setRunningTimer(data.data);
    loadTimeEntries(activeTask.id);
  }

  async function handleStopTimer() {
    await api.post(`/time-entries/tasks/${activeTask.id}/stop`);
    setRunningTimer(null);
    loadTimeEntries(activeTask.id);
  }

  async function handleLogManualTime(minutes, note) {
    await api.post(`/time-entries/tasks/${activeTask.id}/manual`, { durationMinutes: minutes, note });
    loadTimeEntries(activeTask.id);
  }

  async function handleDeleteTimeEntry(entryId) {
    await api.delete(`/time-entries/${entryId}`);
    loadTimeEntries(activeTask.id);
  }

  async function handleAttachmentUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !activeTask) return;
    const form = new FormData();
    form.append("file", file);
    await api.post(`/tasks/${activeTask.id}/attachments`, form, { headers: { "Content-Type": "multipart/form-data" } });
    api.get(`/tasks/${activeTask.id}/attachments`).then(({ data }) => setAttachments(data.data));
    e.target.value = "";
  }

  async function handleDeleteAttachment(attachmentId) {
    await api.delete(`/tasks/${activeTask.id}/attachments/${attachmentId}`);
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }

  async function handleDeleteProject() {
    if (
      !confirm(
        `Delete "${project.name}"? This permanently removes the project, its board, tasks, and comments. This cannot be undone.`
      )
    )
      return;
    await api.delete(`/projects/${id}`);
    toast.success(`${project.name} deleted`);
    navigate("/projects");
  }

  async function handleGeneratePortalLink() {
    const { data } = await api.post(`/projects/${id}/portal-link`);
    setPortalInfo(data.data);
    setShowPortalPanel(true);
  }

  async function handleRevokePortalLink() {
    await api.delete(`/projects/${id}/portal-link`);
    setPortalInfo((prev) => (prev ? { ...prev, portalEnabled: false } : null));
  }

  function copyPortalLink() {
    const url = `${window.location.origin}/portal/${portalInfo.portalToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Portal link copied to clipboard");
  }

  if (!project) return <p className="text-slate-400">Loading project...</p>;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-start gap-2">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-slate-500">{project.description}</p>
          </div>
          {canManage && (
            <button onClick={() => setShowEditPanel(!showEditPanel)} className="text-sm text-slate-500 hover:text-brand-600 flex items-center gap-1 shrink-0">
              <Pencil size={14} /> Edit
            </button>
          )}
        </div>

        {showEditPanel && (
          <form onSubmit={handleUpdateProject} className="mt-3 bg-white border rounded-xl shadow p-4 max-w-lg space-y-2">
            <input
              className="w-full border rounded-md p-2 text-sm"
              placeholder="Project name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <textarea
              className="w-full border rounded-md p-2 text-sm"
              placeholder="Description"
              rows={2}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
            <select
              className="w-full border rounded-md p-2 text-sm"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              {["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">Start date</label>
                <input type="date" className="w-full border rounded-md p-2 text-sm" value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400">End date</label>
                <input type="date" className="w-full border rounded-md p-2 text-sm" value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="bg-brand-600 text-white text-xs px-3 py-1.5 rounded-md">Save changes</button>
              <button type="button" onClick={() => setShowEditPanel(false)} className="text-xs px-3 py-1.5">Cancel</button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          <button onClick={openTeamChat} className="text-sm text-brand-600 border border-brand-600 rounded-md px-3 py-1 flex items-center gap-1.5">
            <MessageCircle size={14} /> Team Chat
          </button>
          {canManage && (
            <button
              onClick={() => (portalInfo ? setShowPortalPanel(!showPortalPanel) : handleGeneratePortalLink())}
              className="text-sm text-brand-600 border border-brand-600 rounded-md px-3 py-1 flex items-center gap-1.5"
            >
              <Link2 size={14} /> Client Portal
            </button>
          )}
          {canManage && (
            <button onClick={handleDeleteProject} className="text-sm text-red-600 border border-red-600 rounded-md px-3 py-1 flex items-center gap-1.5">
              <Trash2 size={14} /> Delete Project
            </button>
          )}
        </div>

        {showPortalPanel && portalInfo && (
          <div className="mt-3 bg-white border rounded-xl shadow p-4 max-w-lg space-y-2">
            <p className="text-sm font-semibold">Client Portal Link</p>
            <p className="text-xs text-slate-500">
              Anyone with this link can view a read-only summary of this project's status and progress — no login
              required, no internal comments or team details shown.
            </p>
            {portalInfo.portalEnabled ? (
              <>
                <div className="flex gap-2">
                  <input
                    readOnly
                    className="flex-1 border rounded-md p-2 text-xs bg-slate-50"
                    value={`${window.location.origin}/portal/${portalInfo.portalToken}`}
                  />
                  <button onClick={copyPortalLink} className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-md">
                    Copy
                  </button>
                </div>
                <button onClick={handleRevokePortalLink} className="text-xs text-red-600">Disable link</button>
              </>
            ) : (
              <button onClick={handleGeneratePortalLink} className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-md">
                Re-enable & generate new link
              </button>
            )}
          </div>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((status) => (
              <div key={status.id} className="bg-slate-100 rounded-xl w-72 flex-shrink-0 flex flex-col">
                <div className="flex justify-between items-center p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: status.color }} />
                    <span className="font-semibold text-sm">{status.name}</span>
                    <span className="text-xs text-slate-400">({tasksForStatus(status.id).length})</span>
                    {status.isDone && (
                      <span className="text-[10px] uppercase tracking-wide bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Done column
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        title={status.isDone ? "Unmark as a completed column" : "Mark tasks here as completed"}
                        onClick={() => handleToggleDoneColumn(status)}
                        className="text-slate-400 hover:text-green-600"
                      >
                        <Check size={14} />
                      </button>
                      <button onClick={() => handleDeleteColumn(status.id)} className="text-slate-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <Droppable droppableId={String(status.id)}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 px-2 space-y-2 min-h-[40px]">
                      {tasksForStatus(status.id).map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={String(task.id)}
                          index={index}
                          isDragDisabled={!canAssign && task.assigneeId !== user?.id}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => openTask(task.id)}
                              className={`bg-white rounded-lg shadow-sm p-3 text-sm cursor-pointer hover:shadow-md transition-shadow ${
                                !canAssign && task.assigneeId !== user?.id ? "opacity-60" : ""
                              }`}
                            >
                              <p className="font-medium">{task.title}</p>
                              <div className="flex justify-between items-center mt-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                                  {task.priority}
                                </span>
                                {task.assignee && (
                                  <span className="text-xs text-slate-400">{task.assignee.name}</span>
                                )}
                              </div>
                              {task.assignedBy && (
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Assigned by {task.assignedBy.id === user?.id ? "you" : task.assignedBy.name}
                                </p>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                <div className="p-2">
                  {!canAssign ? null : openFormStatusId === status.id ? (
                    <div className="bg-white rounded-md p-2 space-y-2 border">
                      <input
                        autoFocus
                        placeholder="Task title"
                        className="w-full text-sm border rounded-md p-2"
                        value={getForm(status.id).title}
                        onChange={(e) => setForm(status.id, { title: e.target.value })}
                      />
                      <textarea
                        placeholder="Detailed description (what needs to be done, requirements, links...)"
                        rows={3}
                        className="w-full text-xs border rounded-md p-2"
                        value={getForm(status.id).description}
                        onChange={(e) => setForm(status.id, { description: e.target.value })}
                      />
                      {canAssign && (
                        <select
                          className="w-full text-xs border rounded-md p-1.5"
                          value={getForm(status.id).assigneeId}
                          onChange={(e) => setForm(status.id, { assigneeId: e.target.value })}
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="w-full text-xs border rounded-md p-1.5"
                          value={getForm(status.id).priority}
                          onChange={(e) => setForm(status.id, { priority: e.target.value })}
                        >
                          {Object.keys(PRIORITY_COLORS).map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          className="w-full text-xs border rounded-md p-1.5"
                          value={getForm(status.id).dueDate}
                          onChange={(e) => setForm(status.id, { dueDate: e.target.value })}
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                        <Paperclip size={12} />
                        {getForm(status.id).file ? getForm(status.id).file.name : "Attach a file/asset for this task"}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => setForm(status.id, { file: e.target.files?.[0] || null })}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCreateTask(status.id)}
                          className="flex-1 bg-brand-600 text-white text-xs py-1.5 rounded-md"
                        >
                          Add task
                        </button>
                        <button
                          onClick={() => { setOpenFormStatusId(null); setTaskForms({ ...taskForms, [status.id]: EMPTY_TASK_FORM }); }}
                          className="text-xs text-slate-400 px-2"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setOpenFormStatusId(status.id)}
                      className="w-full text-left text-sm border rounded-md p-2 bg-white text-slate-400"
                    >
                      + Add task
                    </button>
                  )}
                </div>
              </div>
            ))}

          {canManage && (
            <form onSubmit={handleAddColumn} className="w-64 flex-shrink-0 space-y-1">
              <input
                placeholder="+ Add column"
                className="w-full border rounded-md p-2 text-sm bg-white"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" checked={newColumnIsDone} onChange={(e) => setNewColumnIsDone(e.target.checked)} />
                Tasks here count as completed
              </label>
            </form>
          )}
        </div>
      </DragDropContext>

      {activeTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setActiveTask(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h2 className="text-lg font-semibold">{activeTask.title}</h2>
              <button onClick={() => setActiveTask(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {activeTask.description && <p className="text-sm text-slate-600">{activeTask.description}</p>}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-1">Status</p>
                <p>{activeTask.status?.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Priority</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[activeTask.priority]}`}>
                  {activeTask.priority}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Created by</p>
                <p>{activeTask.createdBy?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Assigned by</p>
                <p>
                  {activeTask.assignedBy ? activeTask.assignedBy.name : "—"}
                  {activeTask.assignedAt && (
                    <span className="text-xs text-slate-400"> · {new Date(activeTask.assignedAt).toLocaleString()}</span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">Assigned to</p>
              {canAssign ? (
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={activeTask.assigneeId || ""}
                  onChange={(e) => handleReassign(activeTask.id, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm">{activeTask.assignee?.name || "Unassigned"}</p>
              )}
            </div>

            {activeTask.comments?.length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Comments</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto text-sm">
                  {activeTask.comments.map((c) => (
                    <li key={c.id} className="border-b pb-1">
                      <span className="font-medium">{c.user?.name}: </span>
                      {c.comment}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs text-slate-400">Attachments</p>
                <label className="text-xs text-brand-600 cursor-pointer">
                  + Add file
                  <input type="file" onChange={handleAttachmentUpload} className="hidden" />
                </label>
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-slate-400">No files attached.</p>
              ) : (
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex justify-between items-center text-xs border-b pb-1">
                      <a href={fileUrl(a.fileUrl)} target="_blank" rel="noreferrer" className="text-brand-600 truncate flex-1 flex items-center gap-1">
                        <Paperclip size={12} /> {a.fileName} <span className="text-slate-400">({formatBytes(a.fileSize)})</span>
                      </a>
                      <button onClick={() => handleDeleteAttachment(a.id)} className="text-red-500 ml-2 shrink-0"><X size={12} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-slate-400 flex items-center gap-1"><Timer size={12} /> Time Tracked</p>
                <span className="text-xs font-semibold">{formatDuration(totalSeconds)} total</span>
              </div>

              {runningTimer && runningTimer.taskId === activeTask.id ? (
                <button onClick={handleStopTimer} className="w-full flex items-center justify-center gap-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md py-1.5 text-xs font-medium mb-2">
                  <Square size={12} /> Stop timer
                </button>
              ) : (
                <button
                  onClick={handleStartTimer}
                  disabled={!!runningTimer}
                  className="w-full flex items-center justify-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md py-1.5 text-xs font-medium mb-2 disabled:opacity-40"
                  title={runningTimer ? "Stop your other running timer first" : ""}
                >
                  <Play size={12} /> Start timer
                </button>
              )}

              <ManualTimeForm onSubmit={handleLogManualTime} />

              {timeEntries.length > 0 && (
                <ul className="space-y-1 max-h-32 overflow-y-auto mt-2">
                  {timeEntries.map((e) => (
                    <li key={e.id} className="flex justify-between items-center text-xs border-b pb-1">
                      <span>
                        {e.user?.name} · {e.durationSeconds ? formatDuration(e.durationSeconds) : "running…"}
                        {e.note && <span className="text-slate-400"> — {e.note}</span>}
                      </span>
                      <button onClick={() => handleDeleteTimeEntry(e.id)} className="text-red-500 ml-2 shrink-0"><X size={12} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ManualTimeForm({ onSubmit }) {
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!minutes) return;
    onSubmit(Number(minutes), note);
    setMinutes("");
    setNote("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-1">
      <input
        type="number"
        min="1"
        placeholder="Minutes"
        className="w-20 border rounded-md p-1.5 text-xs"
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
      />
      <input
        placeholder="Note (optional)"
        className="flex-1 border rounded-md p-1.5 text-xs"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="bg-slate-100 hover:bg-slate-200 text-xs px-2 rounded-md">Log</button>
    </form>
  );
}
