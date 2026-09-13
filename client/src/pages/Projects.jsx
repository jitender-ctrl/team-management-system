import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Plus } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "../utils/toast";

export default function Projects() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", clientId: "" });
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get("/projects").then(({ data }) => setProjects(data.data));
  }

  useEffect(() => {
    load();
    api.get("/clients").then(({ data }) => setClients(data.data)).catch(() => {});
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    await api.post("/projects", { ...form, clientId: form.clientId || null });
    setForm({ name: "", description: "", clientId: "" });
    setShowForm(false);
    load();
  }

  async function handleDelete(e, project) {
    e.preventDefault(); // stop the Link navigation
    e.stopPropagation();
    if (
      !confirm(
        `Delete "${project.name}"? This permanently removes the project, its board, tasks, and comments. This cannot be undone.`
      )
    )
      return;
    await api.delete(`/projects/${project.id}`);
    toast.success(`${project.name} deleted`);
    load();
  }

  const canManage = hasPermission("projects.manage");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Projects</h1>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm">
            {showForm ? "Cancel" : "+ New Project"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-5 rounded-xl shadow space-y-3">
          <input required placeholder="Project name" className="w-full border rounded-md p-2" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <textarea placeholder="Description" className="w-full border rounded-md p-2" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="w-full border rounded-md p-2" value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="bg-brand-600 text-white py-2 px-4 rounded-md">Create Project</button>
          <p className="text-xs text-slate-400">
            A default board (To Do / In Progress / Review / Done) is created automatically — you can fully customize the columns once inside the project.
          </p>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Link to={`/projects/${p.id}`} key={p.id} className="relative bg-white rounded-xl shadow p-5 hover:shadow-md transition group">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold">{p.name}</h3>
              <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{p.status}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{p.client?.name || "No client"}</p>
            <div className="flex justify-between mt-4 text-xs text-slate-400">
              <span>{p._count?.tasks ?? 0} tasks</span>
              <span>{p.members?.length ?? 0} members</span>
            </div>
            {canManage && (
              <button
                onClick={(e) => handleDelete(e, p)}
                className="absolute bottom-3 right-3 text-xs text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1.5 py-0.5 rounded flex items-center gap-1"
                title="Delete project"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </Link>
        ))}
      </div>
      {projects.length === 0 && <p className="text-slate-400 text-sm">No projects yet.</p>}
    </div>
  );
}
