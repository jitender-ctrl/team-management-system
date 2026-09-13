import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { SkeletonCard, SkeletonChart } from "../components/Skeleton";
import { exportToCsv } from "../utils/csv";

const PIE_COLORS = ["#4f46e5", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6"];

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, action }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        {action}
      </div>
      <div style={{ width: "100%", height: 260 }}>{children}</div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-slate-400">{label}</div>
  );
}

function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [rangeDays, setRangeDays] = useState(30);

  function load(days) {
    api.get(`/dashboard/analytics?days=${days}`).then(({ data }) => setData(data.data)).catch(() => {});
  }

  useEffect(() => load(rangeDays), [rangeDays]);

  if (!data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
        <SkeletonChart />
      </div>
    );
  }

  const {
    taskTrend,
    projectProgress,
    performance,
    workload,
    overdueByEmployee,
    projectStatusPie,
    attendanceTrend,
    complaintsByStatus,
  } = data;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Analytics Dashboard</h2>
        <div className="flex gap-1 bg-slate-100 rounded-md p-1 text-xs">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setRangeDays(d)}
              className={`px-3 py-1 rounded ${rangeDays === d ? "bg-white shadow font-medium" : "text-slate-500"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Task Completion Trend">
          {taskTrend.length ? (
            <ResponsiveContainer>
              <LineChart data={taskTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" name="Created" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No task activity in this range yet." />
          )}
        </ChartCard>

        <ChartCard title="Attendance & Work Hours Trend">
          {attendanceTrend.some((d) => d.checkins > 0) ? (
            <ResponsiveContainer>
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v, name) => (name === "avgHours" ? [`${v}h`, "Avg hours/day"] : [v, "Check-ins"])} />
                <Line type="monotone" dataKey="avgHours" name="Avg hours/day" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No completed check-in/check-out pairs in this range yet." />
          )}
        </ChartCard>

        <ChartCard title="Project Progress">
          {projectProgress.length ? (
            <ResponsiveContainer>
              <BarChart data={projectProgress} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="progressPct" name="Complete" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No projects yet." />
          )}
        </ChartCard>

        <ChartCard title="Project Status Breakdown">
          {projectStatusPie.length ? (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={projectStatusPie} dataKey="value" nameKey="name" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {projectStatusPie.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No projects yet." />
          )}
        </ChartCard>

        <ChartCard title="Workload Distribution (open tasks)">
          {workload.length ? (
            <ResponsiveContainer>
              <BarChart data={workload}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" name="Open tasks" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="Nobody has open tasks right now — nice." />
          )}
        </ChartCard>

        <ChartCard title="Overdue Tasks by Employee">
          {overdueByEmployee.length ? (
            <ResponsiveContainer>
              <BarChart data={overdueByEmployee}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState label="No overdue tasks — everything's on track." />
          )}
        </ChartCard>

        {complaintsByStatus.length > 0 && (
          <ChartCard title="Complaints by Status">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={complaintsByStatus} dataKey="value" nameKey="name" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {complaintsByStatus.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-3 border-b font-semibold text-sm flex justify-between items-center">
          <span>Employee Performance Leaderboard</span>
          <button
            onClick={() =>
              exportToCsv(
                "performance-leaderboard",
                performance.map((p) => ({
                  Name: p.name,
                  Role: p.role,
                  "Completion Rate": `${p.completionRate}%`,
                  "On-time Rate": p.onTimeRate === null ? "" : `${p.onTimeRate}%`,
                  Overdue: p.overdue,
                  Score: p.score,
                }))
              )
            }
            className="text-xs text-brand-600 font-normal"
          >
            ⬇ Export CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Name</th>
              <th className="p-3">Role</th>
              <th className="p-3">Completion Rate</th>
              <th className="p-3">On-time Rate</th>
              <th className="p-3">Overdue</th>
              <th className="p-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {performance.map((p, i) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 text-slate-400">{i + 1}</td>
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-slate-500">{p.role}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${p.completionRate}%` }} />
                    </div>
                    <span className="text-xs">{p.completionRate}%</span>
                  </div>
                </td>
                <td className="p-3 text-xs">{p.onTimeRate === null ? "—" : `${p.onTimeRate}%`}</td>
                <td className="p-3 text-xs">
                  {p.overdue > 0 ? <span className="text-red-600 font-medium">{p.overdue}</span> : "0"}
                </td>
                <td className="p-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">{p.score}</span>
                </td>
              </tr>
            ))}
            {performance.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-400 text-sm">
                  No active team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminOverview() {
  const [overview, setOverview] = useState(null);
  const [roles, setRoles] = useState([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "" });

  function load() {
    api.get("/dashboard/overview").then(({ data }) => setOverview(data.data)).catch(() => {});
    api.get("/roles").then(({ data }) => setRoles(data.data)).catch(() => {});
  }
  useEffect(load, []);

  async function handleQuickAdd(e) {
    e.preventDefault();
    await api.post("/users", form);
    setForm({ name: "", email: "", password: "", roleId: "" });
    setShowQuickAdd(false);
    load();
  }

  if (!overview) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    );
  }
  const { totals, team } = overview;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Organization Overview</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="bg-brand-600 text-white px-3 py-1.5 rounded-md text-sm"
          >
            {showQuickAdd ? "Cancel" : "+ Add Team Member"}
          </button>
          <Link to="/users" className="border px-3 py-1.5 rounded-md text-sm bg-white">
            Manage Team & Roles
          </Link>
        </div>
      </div>

      {showQuickAdd && (
        <form onSubmit={handleQuickAdd} className="bg-white p-4 rounded-xl shadow grid grid-cols-2 gap-3">
          <input required placeholder="Name" className="border rounded-md p-2" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="email" placeholder="Email (login username)" className="border rounded-md p-2" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required type="password" placeholder="Password" className="border rounded-md p-2" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select required className="border rounded-md p-2" value={form.roleId}
            onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            <option value="">Select role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button className="col-span-2 bg-brand-600 text-white py-2 rounded-md">Create Member</button>
        </form>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Team Members" value={totals.teamTotal} sub={`${totals.teamActive} active`} />
        <StatCard label="Clients" value={totals.clientsTotal} />
        <StatCard label="Projects" value={totals.projectsTotal} sub={`${totals.projectsActive} active`} />
        <StatCard label="Tasks" value={totals.tasksTotal} sub={`${totals.tasksCompleted} done · ${totals.tasksOverdue} overdue`} />
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-3 border-b font-semibold text-sm">Team Workload</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Role</th>
              <th className="p-3">Projects</th>
              <th className="p-3">Tasks</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-3">{m.name}</td>
                <td className="p-3 text-slate-500">{m.role}</td>
                <td className="p-3">{m.projectsCount}</td>
                <td className="p-3 text-xs">
                  <span className="text-green-600 font-medium">{m.tasksCompleted} done</span>
                  {" · "}
                  <span className="text-amber-600 font-medium">{m.tasksPending} pending</span>
                  {m.tasksOverdue > 0 && (
                    <>
                      {" · "}
                      <span className="text-red-600 font-medium">{m.tasksOverdue} overdue</span>
                    </>
                  )}
                </td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {m.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnalyticsDashboard />
    </div>
  );
}

export default function Dashboard() {
  const { user, hasPermission } = useAuth();
  const [myTasks, setMyTasks] = useState([]);
  const [today, setToday] = useState(null);

  const isAdminOrManager = hasPermission(["users.manage", "projects.manage", "clients.manage"]);

  useEffect(() => {
    api.get("/tasks/my-tasks").then(({ data }) => setMyTasks(data.data));
    api.get("/attendance/me/today").then(({ data }) => setToday(data.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user?.name}</h1>
        <p className="text-slate-500">Role: {user?.role?.name}</p>
      </div>

      {isAdminOrManager && <AdminOverview />}

      <div>
        {isAdminOrManager && <h2 className="text-lg font-semibold mb-3">Your Work</h2>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold mb-3">Today's Attendance</h2>
            {today ? (
              <div className="text-sm space-y-1">
                <p>Check-in: {today.checkIn ? new Date(today.checkIn).toLocaleTimeString() : "—"}</p>
                <p>Check-out: {today.checkOut ? new Date(today.checkOut).toLocaleTimeString() : "—"}</p>
                <p>Breaks taken: {today.breaks?.length || 0}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Not checked in yet.</p>
            )}
            <Link to="/attendance" className="text-brand-600 text-sm font-medium mt-3 inline-block">
              Go to Attendance →
            </Link>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold mb-3">My Tasks ({myTasks.length})</h2>
            <ul className="space-y-2 text-sm max-h-56 overflow-y-auto">
              {myTasks.slice(0, 6).map((t) => (
                <li key={t.id} className="flex justify-between border-b pb-1">
                  <span>{t.title}</span>
                  <span className="text-xs text-slate-400">{t.status?.name}</span>
                </li>
              ))}
              {myTasks.length === 0 && <p className="text-slate-400">No tasks assigned yet.</p>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
