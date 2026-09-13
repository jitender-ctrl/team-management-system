import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Avatar from "../components/Avatar";
import { toast } from "../utils/toast";
import { SkeletonTableRows } from "../components/Skeleton";
import { exportToCsv } from "../utils/csv";

// Grouped by resource so the permission editor reads like a matrix
// (resource rows x action columns) instead of a flat checkbox list.
const PERMISSION_MATRIX = [
  { resource: "Clients", keys: [{ key: "clients.view", label: "View" }, { key: "clients.manage", label: "Manage" }] },
  { resource: "Projects", keys: [{ key: "projects.view", label: "View" }, { key: "projects.manage", label: "Manage" }] },
  {
    resource: "Tasks",
    keys: [
      { key: "tasks.view", label: "View" },
      { key: "tasks.manage", label: "Manage" },
      { key: "tasks.assign", label: "Assign" },
    ],
  },
  { resource: "Team", keys: [{ key: "users.manage", label: "Manage" }] },
  {
    resource: "Attendance",
    keys: [
      { key: "attendance.manage_own", label: "Manage own" },
      { key: "attendance.view_all", label: "View all" },
    ],
  },
  { resource: "Complaints", keys: [{ key: "complaints.manage", label: "Manage" }] },
];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", roleId: "" });
  const [roleForm, setRoleForm] = useState({ name: "", permissions: {} });
  const [showUserForm, setShowUserForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter) params.set("roleId", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (projectFilter) params.set("projectId", projectFilter);
    setLoading(true);
    api.get(`/users?${params.toString()}`).then(({ data }) => setUsers(data.data)).finally(() => setLoading(false));
    api.get("/roles").then(({ data }) => setRoles(data.data));
    api.get("/projects").then(({ data }) => setProjects(data.data)).catch(() => {});
  }

  useEffect(load, [search, roleFilter, statusFilter, projectFilter]);

  async function handleCreateUser(e) {
    e.preventDefault();
    const { data } = await api.post("/users", userForm);
    toast.success(data.message || "Team member added");
    setUserForm({ name: "", email: "", password: "", roleId: "" });
    setShowUserForm(false);
    load();
  }

  async function handleCreateRole(e) {
    e.preventDefault();
    await api.post("/roles", roleForm);
    setRoleForm({ name: "", permissions: {} });
    setShowRoleForm(false);
    load();
  }

  function togglePerm(key) {
    setRoleForm((prev) => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));
  }

  async function handleRoleChange(userId, roleId) {
    await api.put(`/users/${userId}`, { roleId });
    load();
  }

  async function handleManagerChange(userId, managerId) {
    await api.put(`/users/${userId}`, { managerId: managerId || null });
    toast.success("Reporting manager updated");
    load();
  }

  async function handleDeactivate(u) {
    if (!confirm(`Deactivate ${u.name}? They won't be able to log in, but their history is kept.`)) return;
    await api.delete(`/users/${u.id}`);
    load();
  }

  async function handleReactivate(u) {
    await api.put(`/users/${u.id}/reactivate`);
    load();
  }

  async function handlePermanentDelete(u) {
    if (
      !confirm(
        `Permanently delete ${u.name}? This cannot be undone. Anything they created (projects, tasks, clients, chat messages) will be transferred to your account so nothing is lost.`
      )
    )
      return;
    try {
      await api.delete(`/users/${u.id}/permanent`);
      toast.success(`${u.name} deleted`);
      load();
    } catch (err) {
      // axios interceptor already surfaced the error as a toast
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.length === users.length ? [] : users.map((u) => u.id)));
  }

  async function handleBulk(action) {
    if (selected.length === 0) return;
    const verb = { deactivate: "deactivate", reactivate: "reactivate", delete: "permanently delete" }[action];
    if (!confirm(`${verb[0].toUpperCase() + verb.slice(1)} ${selected.length} selected user(s)?`)) return;
    const { data } = await api.post("/users/bulk", { ids: selected, action });
    if (data.message) toast.info(data.message);
    setSelected([]);
    load();
  }

  function handleExport() {
    const rows = users.map((u) => ({
      Name: u.name,
      Email: u.email,
      Role: roles.find((r) => r.id === u.roleId)?.name || "",
      Status: u.isActive ? "Active" : "Inactive",
      "Tasks Completed": u.taskCounts?.completed ?? "",
      "Tasks Pending": u.taskCounts?.pending ?? "",
      "Joined": u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
    }));
    exportToCsv("team-members", rows);
  }

  const hasFilters = search || roleFilter || statusFilter || projectFilter;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold">Team Members</h1>
          <div className="flex gap-2">
            <button onClick={handleExport} className="border px-4 py-2 rounded-md text-sm bg-white">
              ⬇ Export CSV
            </button>
            <button onClick={() => setShowUserForm(!showUserForm)} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm">
              {showUserForm ? "Cancel" : "+ Add Member"}
            </button>
          </div>
        </div>

        {showUserForm && (
          <form onSubmit={handleCreateUser} className="bg-white p-5 rounded-xl shadow grid grid-cols-2 gap-3 mb-4">
            <input required placeholder="Name" className="border rounded-md p-2" value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            <input required type="email" placeholder="Email (this is their login username)" className="border rounded-md p-2" value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            <input required type="password" placeholder="Password" className="border rounded-md p-2" value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            <select required className="border rounded-md p-2" value={userForm.roleId}
              onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}>
              <option value="">Select role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button className="col-span-2 bg-brand-600 text-white py-2 rounded-md">Create Member</button>
          </form>
        )}

        {/* Search & filters */}
        <div className="bg-white p-3 rounded-xl shadow mb-3 flex flex-wrap gap-2 items-center">
          <input
            placeholder="Search name or email…"
            className="border rounded-md p-2 text-sm flex-1 min-w-[180px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="border rounded-md p-2 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select className="border rounded-md p-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select className="border rounded-md p-2 text-sm" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearch(""); setRoleFilter(""); setStatusFilter(""); setProjectFilter(""); }}
              className="text-xs text-brand-600"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Bulk action bar */}
        {selected.length > 0 && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 mb-3 flex justify-between items-center text-sm">
            <span>{selected.length} selected</span>
            <div className="flex gap-3">
              <button onClick={() => handleBulk("deactivate")} className="text-amber-600 font-medium">Deactivate</button>
              <button onClick={() => handleBulk("reactivate")} className="text-green-600 font-medium">Reactivate</button>
              <button onClick={() => handleBulk("delete")} className="text-red-600 font-medium">Delete</button>
              <button onClick={() => setSelected([])} className="text-slate-400">Clear</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3 w-8">
                  <input type="checkbox" checked={selected.length > 0 && selected.length === users.length} onChange={toggleSelectAll} />
                </th>
                <th className="p-3">Name</th>
                <th className="p-3">Email (Username)</th>
                <th className="p-3">Role</th>
                <th className="p-3">Reports To</th>
                <th className="p-3">Tasks</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows rows={5} cols={8} />
              ) : (
                users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleSelect(u.id)} />
                  </td>
                  <td className="p-3">
                    <Link to={`/users/${u.id}`} className="flex items-center gap-2 hover:underline">
                      <Avatar url={u.avatarUrl} name={u.name} />
                      <span>{u.name}</span>
                    </Link>
                  </td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">
                    <select value={u.roleId} onChange={(e) => handleRoleChange(u.id, e.target.value)} className="border rounded-md p-1 text-xs">
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={u.managerId || ""}
                      onChange={(e) => handleManagerChange(u.id, e.target.value)}
                      className="border rounded-md p-1 text-xs"
                    >
                      <option value="">No manager</option>
                      {users.filter((other) => other.id !== u.id).map((other) => (
                        <option key={other.id} value={other.id}>{other.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    {u.taskCounts ? (
                      <span className="text-xs">
                        <span className="text-green-600 font-medium">{u.taskCounts.completed} completed</span>
                        {" · "}
                        <span className="text-amber-600 font-medium">{u.taskCounts.pending} pending</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                    {!u.emailVerified && (
                      <span className="block text-[10px] text-amber-600 mt-0.5">Email not verified</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 text-xs">
                      <Link to={`/users/${u.id}`} className="text-brand-600 hover:underline">View</Link>
                      {u.isActive ? (
                        <button onClick={() => handleDeactivate(u)} className="text-amber-600 hover:underline">
                          Deactivate
                        </button>
                      ) : (
                        <button onClick={() => handleReactivate(u)} className="text-green-600 hover:underline">
                          Reactivate
                        </button>
                      )}
                      <button onClick={() => handlePermanentDelete(u)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-slate-400 text-sm">No members match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold">Roles & Permissions</h1>
          <button onClick={() => setShowRoleForm(!showRoleForm)} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm">
            {showRoleForm ? "Cancel" : "+ New Role"}
          </button>
        </div>

        {showRoleForm && (
          <form onSubmit={handleCreateRole} className="bg-white p-5 rounded-xl shadow space-y-3 mb-4">
            <input required placeholder="Role name (e.g. Sales, HR)" className="w-full border rounded-md p-2"
              value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} />

            {/* Visual permission matrix: resource rows x action columns */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="p-2">Resource</th>
                    <th className="p-2">Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MATRIX.map((row) => (
                    <tr key={row.resource} className="border-t">
                      <td className="p-2 font-medium align-top">{row.resource}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-3">
                          {row.keys.map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-1.5 text-xs bg-slate-50 px-2 py-1 rounded-md border">
                              <input type="checkbox" checked={!!roleForm.permissions[key]} onChange={() => togglePerm(key)} />
                              {label}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-amber-50">
                    <td className="p-2 font-medium align-top">Super Admin</td>
                    <td className="p-2">
                      <label className="flex items-center gap-1.5 text-xs px-2 py-1">
                        <input type="checkbox" checked={!!roleForm.permissions["*"]} onChange={() => togglePerm("*")} />
                        Bypass all permission checks (use with care)
                      </label>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button className="bg-brand-600 text-white py-2 px-4 rounded-md">Create Role</button>
            <p className="text-xs text-slate-400">
              This matrix is just what the UI knows how to toggle — the backend accepts any permission key you send, so new features can introduce new keys any time.
            </p>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roles.map((r) => (
            <div key={r.id} className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold">{r.name}</h3>
              <ul className="text-xs text-slate-500 mt-2 space-y-0.5">
                {Object.entries(r.permissions)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <li key={k}>✓ {k === "*" ? "All permissions (Super Admin)" : k}</li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
