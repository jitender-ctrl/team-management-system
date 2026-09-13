import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { Camera, Download, Briefcase } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/Avatar";
import { toast } from "../utils/toast";
import { exportToCsv } from "../utils/csv";

const NOTIFICATION_TYPES = [
  { key: "task_assigned", label: "Task assigned to you" },
  { key: "mention", label: "Someone @mentions you" },
  { key: "comment", label: "Comments on your tasks" },
  { key: "task_overdue", label: "Task overdue reminders" },
  { key: "chat_message", label: "New chat messages" },
  { key: "complaint_update", label: "Complaint updates" },
];

function StatCard({ label, value, tone }) {
  const toneClass = {
    default: "text-slate-800",
    green: "text-green-600",
    amber: "text-amber-600",
    red: "text-red-600",
  }[tone || "default"];
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}

function WorkUpdates({ userId, isSelf }) {
  const [updates, setUpdates] = useState([]);
  const [content, setContent] = useState("");
  const [hours, setHours] = useState("");

  function load() {
    api.get(`/work-updates?userId=${userId}&limit=14`).then(({ data }) => setUpdates(data.data)).catch(() => {});
  }
  useEffect(load, [userId]);

  async function handlePost(e) {
    e.preventDefault();
    if (!content.trim()) return;
    await api.post("/work-updates", { content, hoursSpent: hours || null });
    setContent("");
    setHours("");
    load();
  }

  async function handleDelete(id) {
    await api.delete(`/work-updates/${id}`);
    load();
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-sm mb-3">Daily Work Updates</h3>
      {isSelf && (
        <form onSubmit={handlePost} className="flex gap-2 mb-4">
          <input
            className="flex-1 border rounded-md p-2 text-sm"
            placeholder="What did you work on today?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <input
            type="number"
            step="0.5"
            min="0"
            className="w-20 border rounded-md p-2 text-sm"
            placeholder="Hrs"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <button className="bg-brand-600 text-white px-3 py-2 rounded-md text-sm">Post</button>
        </form>
      )}
      <ul className="space-y-2 max-h-72 overflow-y-auto">
        {updates.map((u) => (
          <li key={u.id} className="border-b pb-2 text-sm flex justify-between items-start">
            <div>
              <p>{u.content}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(u.date).toLocaleDateString()} {u.hoursSpent ? `· ${u.hoursSpent}h` : ""}
              </p>
            </div>
            {isSelf && (
              <button onClick={() => handleDelete(u.id)} className="text-xs text-red-500 shrink-0 ml-2">
                Delete
              </button>
            )}
          </li>
        ))}
        {updates.length === 0 && <p className="text-sm text-slate-400">No updates logged yet.</p>}
      </ul>
    </div>
  );
}

function NotificationPreferences({ userId, prefs }) {
  const [preferences, setPreferences] = useState(prefs || {});
  const [saving, setSaving] = useState(false);

  async function toggle(key) {
    const next = { ...preferences, [key]: preferences[key] === false ? true : false };
    setPreferences(next);
    setSaving(true);
    try {
      await api.put(`/users/${userId}/notification-preferences`, { preferences: next });
      toast.success("Notification preferences saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold text-sm mb-3">Notification Preferences</h3>
      <div className="space-y-2">
        {NOTIFICATION_TYPES.map((t) => {
          const enabled = preferences[t.key] !== false;
          return (
            <label key={t.key} className="flex items-center justify-between text-sm">
              <span>{t.label}</span>
              <input type="checkbox" checked={enabled} disabled={saving} onChange={() => toggle(t.key)} />
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function UserProfile() {
  const { id } = useParams();
  const { user: currentUser, hasPermission } = useAuth();
  const [profile, setProfile] = useState(null);
  const [report, setReport] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "", phone: "", jobTitle: "" });
  const fileInputRef = useRef(null);

  const isSelf = currentUser?.id === Number(id);
  const canManage = hasPermission("users.manage");

  function load() {
    api.get(`/users/${id}`).then(({ data }) => {
      setProfile(data.data);
      setForm({
        name: data.data.name,
        bio: data.data.bio || "",
        phone: data.data.phone || "",
        jobTitle: data.data.jobTitle || "",
      });
    });
    api.get(`/users/${id}/report`).then(({ data }) => setReport(data.data)).catch(() => setReport(null));
  }
  useEffect(load, [id]);

  function handleExportReport() {
    if (!report) return;
    const rows = [
      { Metric: "Total Tasks Assigned", Value: report.stats.totalAssigned },
      { Metric: "Total Tasks Completed", Value: report.stats.totalCompleted },
      { Metric: "Completion Rate", Value: `${report.stats.completionRate}%` },
      { Metric: "On-time Rate", Value: report.stats.onTimeRate === null ? "N/A" : `${report.stats.onTimeRate}%` },
      { Metric: "Avg. Completion Time (hours)", Value: report.stats.avgCompletionHours ?? "N/A" },
      { Metric: "Overdue Open Tasks", Value: report.stats.overdueOpen },
      { Metric: "Current Clients", Value: report.currentClients.map((c) => c.name).join("; ") || "None" },
      { Metric: "Previous Clients", Value: report.previousClients.map((c) => c.name).join("; ") || "None" },
    ];
    exportToCsv(`${report.user.name.replace(/\s+/g, "_")}_report`, rows);
  }

  async function handleSave(e) {
    e.preventDefault();
    await api.put(`/users/${id}`, form);
    setEditing(false);
    load();
  }

  async function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    await api.put(`/users/${id}/avatar`, formData, { headers: { "Content-Type": "multipart/form-data" } });
    load();
  }

  if (!profile) return null;
  const { stats, history, recentTasks, projects, role } = profile;

  return (
    <div className="space-y-6">
      <Link to="/users" className="text-sm text-brand-600">← Back to Team Members</Link>

      <div className="bg-white rounded-xl shadow p-6 flex flex-wrap gap-6 items-start">
        <div className="relative">
          <Avatar url={profile.avatarUrl} name={profile.name} size="lg" />
          {(isSelf || canManage) && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 bg-brand-600 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center"
                title="Change photo"
              >
                <Camera size={12} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarPick} className="hidden" />
            </>
          )}
        </div>

        <div className="flex-1 min-w-[240px]">
          {!editing ? (
            <>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{profile.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full ${profile.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {profile.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-slate-500 text-sm">{profile.jobTitle || role?.name} · {role?.name}</p>
              <p className="text-sm mt-2">{profile.bio || <span className="text-slate-400">No bio yet.</span>}</p>
              <div className="text-xs text-slate-400 mt-2 space-y-0.5">
                <p>Email: {profile.email}</p>
                {profile.phone && <p>Phone: {profile.phone}</p>}
                <p>Joined: {new Date(profile.createdAt).toLocaleDateString()}</p>
              </div>
              {(isSelf || canManage) && (
                <button onClick={() => setEditing(true)} className="mt-3 text-xs text-brand-600 border px-3 py-1.5 rounded-md">
                  Edit Profile
                </button>
              )}
            </>
          ) : (
            <form onSubmit={handleSave} className="space-y-2">
              <input className="w-full border rounded-md p-2 text-sm" placeholder="Name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="w-full border rounded-md p-2 text-sm" placeholder="Job title (e.g. Senior Developer)" value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              <input className="w-full border rounded-md p-2 text-sm" placeholder="Phone" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <textarea className="w-full border rounded-md p-2 text-sm" placeholder="Short bio" rows={3} value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              <div className="flex gap-2">
                <button className="bg-brand-600 text-white px-3 py-1.5 rounded-md text-xs">Save</button>
                <button type="button" onClick={() => setEditing(false)} className="text-xs px-3 py-1.5">Cancel</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Tasks" value={stats.totalTasks} />
        <StatCard label="Completed" value={stats.completedTasks} tone="green" />
        <StatCard label="Pending" value={stats.pendingTasks} tone="amber" />
        <StatCard label="Overdue" value={stats.overdueTasks} tone="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-sm mb-3">Completed Tasks — Last 12 Weeks</h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="completed" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-sm mb-3">Completion Rate</h3>
          <div className="flex items-center justify-center h-40">
            <div className="text-4xl font-bold text-brand-600">{stats.completionRate}%</div>
          </div>
          <p className="text-xs text-slate-400 text-center">{stats.projectsCount} project(s) assigned</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-sm mb-3">Recent Tasks</h3>
          <ul className="space-y-2 max-h-72 overflow-y-auto text-sm">
            {recentTasks.map((t) => (
              <li key={t.id} className="border-b pb-2 flex justify-between">
                <div>
                  <p>{t.title}</p>
                  <p className="text-xs text-slate-400">{t.project?.name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full h-fit ${t.status.isDone ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {t.status.name}
                </span>
              </li>
            ))}
            {recentTasks.length === 0 && <p className="text-slate-400 text-sm">No tasks yet.</p>}
          </ul>
        </div>

        <WorkUpdates userId={id} isSelf={isSelf} />
      </div>

      {isSelf && <NotificationPreferences userId={id} prefs={profile.notificationPrefs} />}

      {report && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-1.5">
              <Briefcase size={15} /> Client History & Performance Report
            </h3>
            <button onClick={handleExportReport} className="text-xs text-brand-600 flex items-center gap-1">
              <Download size={12} /> Export CSV
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] text-slate-400">Completion Rate</p>
              <p className="text-lg font-bold">{report.stats.completionRate}%</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] text-slate-400">On-time Rate</p>
              <p className="text-lg font-bold">{report.stats.onTimeRate === null ? "—" : `${report.stats.onTimeRate}%`}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] text-slate-400">Avg. Completion Time</p>
              <p className="text-lg font-bold">{report.stats.avgCompletionHours !== null ? `${report.stats.avgCompletionHours}h` : "—"}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] text-slate-400">Overdue Open Tasks</p>
              <p className={`text-lg font-bold ${report.stats.overdueOpen > 0 ? "text-red-600" : ""}`}>{report.stats.overdueOpen}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Currently working with</p>
              {report.currentClients.length === 0 ? (
                <p className="text-sm text-slate-400">No active client work.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {report.currentClients.map((c) => (
                    <span key={c.id} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">{c.name}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Previously worked with</p>
              {report.previousClients.length === 0 ? (
                <p className="text-sm text-slate-400">No past client work.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {report.previousClients.map((c) => (
                    <span key={c.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{c.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {report.clientHandlingChanges?.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-slate-400 mb-2">Client Handling Changes (transfers & terminations)</p>
              <ul className="space-y-2 max-h-56 overflow-y-auto">
                {report.clientHandlingChanges.map((h, i) => (
                  <li key={i} className="text-sm border-b pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-medium">
                        {h.client.name}
                        {h.type === "TERMINATED" ? (
                          <span className="text-xs text-red-600 ml-2">Engagement ended</span>
                        ) : (
                          <span className="text-xs text-amber-600 ml-2">Transferred to {h.transferredTo?.name || "—"}</span>
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{h.reason}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(h.changedAt).toLocaleDateString()} · by {h.changedBy?.name || "Unknown"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {projects.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-sm mb-3">Projects</h3>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="text-xs border px-3 py-1.5 rounded-full hover:bg-slate-50">
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
