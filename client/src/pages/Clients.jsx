import { useEffect, useState } from "react";
import { Trash2, Pencil, Clock, ArrowRightLeft, History, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Avatar from "../components/Avatar";
import { toast } from "../utils/toast";

const ENGAGEMENT_LABELS = {
  PART_TIME: "Part Time — 4h/day · 5 days/week (20 hrs/week)",
  FULL_TIME: "Full Time — 8h/day · 5 days/week (40 hrs/week)",
};

const ENGAGEMENT_BADGE = {
  PART_TIME: "bg-amber-100 text-amber-700",
  FULL_TIME: "bg-green-100 text-green-700",
};

const emptyForm = { name: "", company: "", email: "", phone: "", handledById: "", engagementType: "" };

function TransferModal({ client, users, onClose, onDone }) {
  const [newHandlerId, setNewHandlerId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const isTermination = newHandlerId === "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await api.put(`/clients/${client.id}/handler`, { newHandlerId: newHandlerId || null, reason });
      toast.success(isTermination ? "Client engagement ended" : "Client transferred");
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.form
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Transfer or End Engagement</h3>
          <button type="button" onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <p className="text-sm text-slate-500">
          Currently handled by <strong>{client.handledBy?.name || "no one"}</strong>.
        </p>
        <div>
          <label className="text-xs text-slate-400">New handler</label>
          <select className="w-full border rounded-md p-2 mt-1 text-sm" value={newHandlerId} onChange={(e) => setNewHandlerId(e.target.value)}>
            <option value="">— No one (end this engagement) —</option>
            {users.filter((u) => u.id !== client.handledById).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400">
            Reason {isTermination ? "for ending the engagement" : "for the transfer"} (required)
          </label>
          <textarea
            required
            rows={3}
            className="w-full border rounded-md p-2 mt-1 text-sm"
            placeholder={isTermination ? "e.g. Contract ended, client churned, budget cut..." : "e.g. Handler went on leave, workload rebalance, client requested a change..."}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <button disabled={saving} className={`w-full py-2 rounded-md text-sm text-white disabled:opacity-50 ${isTermination ? "bg-red-600" : "bg-brand-600"}`}>
          {saving ? "Saving…" : isTermination ? "End Engagement" : "Transfer Client"}
        </button>
      </motion.form>
    </div>
  );
}

function HistoryPanel({ client, onClose }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get(`/clients/${client.id}/handler-history`).then(({ data }) => setHistory(data.data)).catch(() => setHistory([]));
  }, [client.id]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 space-y-3 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Handler History — {client.name}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        {history === null && <p className="text-sm text-slate-400">Loading…</p>}
        {history?.length === 0 && <p className="text-sm text-slate-400">No handler changes recorded yet.</p>}
        <ul className="space-y-3">
          {history?.map((h) => (
            <li key={h.id} className="border-b pb-2 text-sm">
              <p className="font-medium">
                {h.previousHandler?.name || "Unassigned"} →{" "}
                {h.newHandler ? h.newHandler.name : <span className="text-red-600">Engagement ended</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{h.reason}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {new Date(h.changedAt).toLocaleString()} · by {h.changedBy?.name || "Unknown"}
              </p>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

export default function Clients() {
  const { hasPermission } = useAuth();
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [transferTarget, setTransferTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);

  function load() {
    api.get("/clients").then(({ data }) => setClients(data.data));
    api.get("/users").then(({ data }) => setUsers(data.data)).catch(() => {});
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (editingId) {
      // Handler assignment is NOT editable here once a client exists — use
      // the Transfer/End action so the change always carries a reason.
      const { handledById, ...rest } = form;
      await api.put(`/clients/${editingId}`, rest);
      toast.success("Client updated");
    } else {
      await api.post("/clients", { ...form, handledById: form.handledById || null, engagementType: form.engagementType || null });
      toast.success("Client added");
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    load();
  }

  function handleEdit(c) {
    setForm({
      name: c.name,
      company: c.company || "",
      email: c.email || "",
      phone: c.phone || "",
      handledById: c.handledById || "",
      engagementType: c.engagementType || "",
    });
    setEditingId(c.id);
    setShowForm(true);
  }

  function handleCancel() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this client? This removes the client record entirely (different from ending an engagement).")) return;
    await api.delete(`/clients/${id}`);
    toast.success("Client deleted");
    load();
  }

  const canManage = hasPermission("clients.manage");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Clients</h1>
        {canManage && (
          <button
            onClick={() => (showForm ? handleCancel() : setShowForm(true))}
            className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm"
          >
            {showForm ? "Cancel" : "+ New Client"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl shadow grid grid-cols-2 gap-3">
          <input required placeholder="Name" className="border rounded-md p-2" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Company" className="border rounded-md p-2" value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <input placeholder="Email" className="border rounded-md p-2" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Phone" className="border rounded-md p-2" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          {!editingId && (
            <div>
              <label className="text-xs text-slate-400">Handled by (team member facing this client)</label>
              <select className="w-full border rounded-md p-2 mt-1" value={form.handledById}
                onChange={(e) => setForm({ ...form, handledById: e.target.value })}>
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          {editingId && (
            <div>
              <label className="text-xs text-slate-400">Handled by</label>
              <p className="text-sm p-2 bg-slate-50 rounded-md mt-1">
                {users.find((u) => u.id === form.handledById)?.name || "Unassigned"}
                <span className="text-xs text-slate-400 block">Use the transfer action to change this, with a reason.</span>
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400">Engagement type</label>
            <select className="w-full border rounded-md p-2 mt-1" value={form.engagementType}
              onChange={(e) => setForm({ ...form, engagementType: e.target.value })}>
              <option value="">Not set</option>
              <option value="PART_TIME">Part Time — 4h/day, 5 days/week (20 hrs/week)</option>
              <option value="FULL_TIME">Full Time — 8h/day, 5 days/week (40 hrs/week)</option>
            </select>
          </div>

          <button className="col-span-2 bg-brand-600 text-white py-2 rounded-md">
            {editingId ? "Save Changes" : "Save Client"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Company</th>
              <th className="p-3">Email</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Handled By</th>
              <th className="p-3">Engagement</th>
              <th className="p-3">Projects</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.company || "—"}</td>
                <td className="p-3">{c.email || "—"}</td>
                <td className="p-3">{c.phone || "—"}</td>
                <td className="p-3">
                  {c.handledBy ? (
                    <span className="flex items-center gap-2">
                      <Avatar url={c.handledBy.avatarUrl} name={c.handledBy.name} size="sm" />
                      {c.handledBy.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">Unassigned</span>
                  )}
                </td>
                <td className="p-3">
                  {c.engagementType ? (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${ENGAGEMENT_BADGE[c.engagementType]}`}
                      title={ENGAGEMENT_LABELS[c.engagementType]}
                    >
                      <Clock size={11} /> {c.engagementType === "PART_TIME" ? "Part Time" : "Full Time"}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="p-3">{c._count?.projects ?? 0}</td>
                <td className="p-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setHistoryTarget(c)} className="text-slate-500 hover:text-brand-600" title="View handler history">
                      <History size={14} />
                    </button>
                    {canManage && (
                      <>
                        <button onClick={() => setTransferTarget(c)} className="text-slate-500 hover:text-brand-600" title="Transfer or end engagement">
                          <ArrowRightLeft size={14} />
                        </button>
                        <button onClick={() => handleEdit(c)} className="text-slate-500 hover:text-brand-600" title="Edit details"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-600" title="Delete client"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && <p className="p-5 text-slate-400 text-sm">No clients yet.</p>}
      </div>

      <AnimatePresence>
        {transferTarget && (
          <TransferModal
            client={transferTarget}
            users={users}
            onClose={() => setTransferTarget(null)}
            onDone={() => {
              setTransferTarget(null);
              load();
            }}
          />
        )}
        {historyTarget && <HistoryPanel client={historyTarget} onClose={() => setHistoryTarget(null)} />}
      </AnimatePresence>
    </div>
  );
}
