import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, X, Users as UsersIcon, MapPin, Clock, Mail } from "lucide-react";
import api from "../api/axios";
import { toast } from "../utils/toast";

const PRIORITY_COLORS = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

function BookMeetingModal({ defaultDate, users, projects, clients, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: defaultDate,
    startTime: "10:00",
    endTime: "10:30",
    location: "",
    projectId: "",
    attendeeIds: [],
    clientIds: [],
  });
  const [extraGuestEmail, setExtraGuestEmail] = useState("");
  const [extraGuestName, setExtraGuestName] = useState("");
  const [extraGuests, setExtraGuests] = useState([]); // [{ email, name }] for people not in the Clients list
  const [submitting, setSubmitting] = useState(false);

  function toggleAttendee(id) {
    setForm((prev) => ({
      ...prev,
      attendeeIds: prev.attendeeIds.includes(id) ? prev.attendeeIds.filter((x) => x !== id) : [...prev.attendeeIds, id],
    }));
  }

  function toggleClient(id) {
    setForm((prev) => ({
      ...prev,
      clientIds: prev.clientIds.includes(id) ? prev.clientIds.filter((x) => x !== id) : [...prev.clientIds, id],
    }));
  }

  function addExtraGuest() {
    if (!extraGuestEmail.trim()) return;
    setExtraGuests((prev) => [...prev, { email: extraGuestEmail.trim(), name: extraGuestName.trim() || null }]);
    setExtraGuestEmail("");
    setExtraGuestName("");
  }

  function removeExtraGuest(email) {
    setExtraGuests((prev) => prev.filter((g) => g.email !== email));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const startTime = new Date(`${form.date}T${form.startTime}`).toISOString();
      const endTime = new Date(`${form.date}T${form.endTime}`).toISOString();
      await api.post("/meetings", {
        title: form.title,
        description: form.description,
        startTime,
        endTime,
        location: form.location,
        projectId: form.projectId || null,
        attendeeIds: form.attendeeIds,
        clientIds: form.clientIds,
        guestEmails: extraGuests,
      });
      const invitedCount = form.clientIds.length + extraGuests.length;
      toast.success(invitedCount ? `Meeting booked — invite emails sent to ${invitedCount} guest(s)` : "Meeting booked");
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  const clientsWithoutEmail = clients.filter((c) => form.clientIds.includes(c.id) && !c.email);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.form
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Book a Meeting</h3>
          <button type="button" onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <input
          required
          placeholder="Meeting title"
          className="w-full border rounded-md p-2 text-sm"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          placeholder="Description (optional) — shown in the invite email too"
          className="w-full border rounded-md p-2 text-sm"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="grid grid-cols-3 gap-2">
          <input type="date" required className="border rounded-md p-2 text-sm col-span-1" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input type="time" required className="border rounded-md p-2 text-sm" value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <input type="time" required className="border rounded-md p-2 text-sm" value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </div>
        <input
          placeholder="Location or video call link — included in the invite email"
          className="w-full border rounded-md p-2 text-sm"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <select className="w-full border rounded-md p-2 text-sm" value={form.projectId}
          onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
          <option value="">No linked project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div>
          <p className="text-xs text-slate-400 mb-1">Invite team members</p>
          <div className="max-h-28 overflow-y-auto border rounded-md p-2 space-y-1">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.attendeeIds.includes(u.id)} onChange={() => toggleAttendee(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-1">Invite clients (they'll get an email invite — no login needed)</p>
          <div className="max-h-28 overflow-y-auto border rounded-md p-2 space-y-1">
            {clients.length === 0 && <p className="text-xs text-slate-400">No clients yet.</p>}
            {clients.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.clientIds.includes(c.id)} onChange={() => toggleClient(c.id)} />
                {c.name} {!c.email && <span className="text-[10px] text-amber-600">(no email on file)</span>}
              </label>
            ))}
          </div>
          {clientsWithoutEmail.length > 0 && (
            <p className="text-[11px] text-amber-600 mt-1">
              {clientsWithoutEmail.map((c) => c.name).join(", ")} won't receive an invite — add an email to their client record first.
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-1">Or invite by email directly</p>
          <div className="flex gap-1">
            <input
              placeholder="Name (optional)"
              className="w-1/3 border rounded-md p-2 text-xs"
              value={extraGuestName}
              onChange={(e) => setExtraGuestName(e.target.value)}
            />
            <input
              type="email"
              placeholder="guest@email.com"
              className="flex-1 border rounded-md p-2 text-xs"
              value={extraGuestEmail}
              onChange={(e) => setExtraGuestEmail(e.target.value)}
            />
            <button type="button" onClick={addExtraGuest} className="bg-slate-100 hover:bg-slate-200 text-xs px-2 rounded-md">Add</button>
          </div>
          {extraGuests.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {extraGuests.map((g) => (
                <span key={g.email} className="text-xs bg-slate-100 rounded-full px-2 py-1 flex items-center gap-1">
                  {g.name ? `${g.name} <${g.email}>` : g.email}
                  <button type="button" onClick={() => removeExtraGuest(g.email)} className="text-slate-400 hover:text-red-500">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button disabled={submitting} className="w-full bg-brand-600 text-white py-2 rounded-md text-sm disabled:opacity-50">
          {submitting ? "Booking…" : "Book Meeting"}
        </button>
      </motion.form>
    </div>
  );
}

export default function Calendar() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showBookModal, setShowBookModal] = useState(false);

  function load() {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    api.get(`/tasks/calendar?start=${start.toISOString()}&end=${end.toISOString()}`).then(({ data }) => setTasks(data.data));
    api.get(`/meetings?start=${start.toISOString()}&end=${end.toISOString()}`).then(({ data }) => setMeetings(data.data));
  }

  useEffect(() => {
    load();
    setSelectedDay(null);
  }, [cursor]);

  useEffect(() => {
    api.get("/users").then(({ data }) => setUsers(data.data)).catch(() => {});
    api.get("/projects").then(({ data }) => setProjects(data.data)).catch(() => {});
    api.get("/clients").then(({ data }) => setClients(data.data)).catch(() => {});
  }, []);

  async function handleCancelMeeting(id) {
    if (!confirm("Cancel this meeting?")) return;
    await api.delete(`/meetings/${id}`);
    toast.success("Meeting cancelled");
    load();
  }

  const tasksByDay = {};
  for (const t of tasks) {
    const key = toDateKey(new Date(t.dueDate));
    tasksByDay[key] = tasksByDay[key] || [];
    tasksByDay[key].push(t);
  }

  const meetingsByDay = {};
  for (const m of meetings) {
    const key = toDateKey(new Date(m.startTime));
    meetingsByDay[key] = meetingsByDay[key] || [];
    meetingsByDay[key].push(m);
  }

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toDateKey(new Date());

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="border rounded-md p-1.5 bg-white">
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold text-sm w-32 text-center">
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="border rounded-md p-1.5 bg-white">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="text-xs text-brand-600 ml-2">
            Today
          </button>
          <button
            onClick={() => setShowBookModal(true)}
            className="bg-brand-600 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ml-2"
          >
            <Plus size={14} /> Book Meeting
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-100 text-xs font-semibold text-slate-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="border-t border-r p-2 min-h-[90px] bg-slate-50" />;
            const key = toDateKey(date);
            const dayTasks = tasksByDay[key] || [];
            const dayMeetings = meetingsByDay[key] || [];
            const isToday = key === today;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(key)}
                className={`text-left border-t border-r p-2 min-h-[90px] hover:bg-slate-50 ${selectedDay === key ? "bg-brand-50" : ""}`}
              >
                <span className={`text-xs ${isToday ? "bg-brand-600 text-white rounded-full px-1.5 py-0.5" : "text-slate-500"}`}>
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayMeetings.slice(0, 2).map((m) => (
                    <div key={`m${m.id}`} className="text-[10px] px-1 py-0.5 rounded truncate bg-purple-100 text-purple-700">
                      {m.title}
                    </div>
                  ))}
                  {dayTasks.slice(0, 2).map((t) => (
                    <div key={t.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${PRIORITY_COLORS[t.priority]}`}>
                      {t.title}
                    </div>
                  ))}
                  {dayTasks.length + dayMeetings.length > 4 && (
                    <div className="text-[10px] text-slate-400">+{dayTasks.length + dayMeetings.length - 4} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="bg-white rounded-xl shadow p-4 space-y-4">
          <h3 className="font-semibold text-sm">
            {new Date(selectedDay).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </h3>

          {(meetingsByDay[selectedDay] || []).length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Meetings</p>
              <ul className="space-y-2">
                {meetingsByDay[selectedDay].map((m) => (
                  <li key={m.id} className="border-b pb-2 text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(m.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" – "}
                            {new Date(m.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {m.location && <span className="flex items-center gap-1"><MapPin size={11} /> {m.location}</span>}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <UsersIcon size={11} /> {m.attendees.map((a) => a.user.name).join(", ")}
                        </p>
                        {m.guests?.length > 0 && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail size={11} /> {m.guests.map((g) => g.name || g.email).join(", ")}
                            {" "}
                            <span className="text-[10px]">
                              ({m.guests.filter((g) => g.emailSent).length}/{m.guests.length} emailed)
                            </span>
                          </p>
                        )}
                      </div>
                      <button onClick={() => handleCancelMeeting(m.id)} className="text-xs text-red-500 shrink-0">Cancel</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-400 mb-2">Tasks due</p>
            {(tasksByDay[selectedDay] || []).length === 0 ? (
              <p className="text-sm text-slate-400">Nothing due this day.</p>
            ) : (
              <ul className="space-y-2">
                {tasksByDay[selectedDay].map((t) => (
                  <li key={t.id} className="flex justify-between items-center border-b pb-2 text-sm">
                    <div>
                      <Link to={`/projects/${t.project.id}`} className="hover:underline font-medium">{t.title}</Link>
                      <p className="text-xs text-slate-400">{t.project.name} {t.assignee ? `· ${t.assignee.name}` : ""}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showBookModal && (
          <BookMeetingModal
            defaultDate={selectedDay || toDateKey(new Date())}
            users={users}
            projects={projects}
            clients={clients}
            onClose={() => setShowBookModal(false)}
            onCreated={() => {
              setShowBookModal(false);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
