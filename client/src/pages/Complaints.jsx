import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const STATUS_COLORS = {
  OPEN: "bg-amber-100 text-amber-700",
  IN_REVIEW: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

export default function Complaints() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("complaints.manage");

  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);
  const [form, setForm] = useState({ subject: "", description: "" });
  const [showForm, setShowForm] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState({}); // { [complaintId]: text }

  function load() {
    api.get("/complaints/my").then(({ data }) => setMine(data.data));
    if (canManage) api.get("/complaints").then(({ data }) => setAll(data.data));
  }
  useEffect(load, [canManage]);

  async function handleSubmit(e) {
    e.preventDefault();
    await api.post("/complaints", form);
    setForm({ subject: "", description: "" });
    setShowForm(false);
    load();
  }

  async function handleStatusChange(id, status) {
    await api.put(`/complaints/${id}`, { status, resolutionNote: noteDrafts[id] });
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold">Complaints</h1>
          <button onClick={() => setShowForm(!showForm)} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm">
            {showForm ? "Cancel" : "+ Raise a Complaint"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl shadow space-y-3 mb-4">
            <input
              required
              placeholder="Subject"
              className="w-full border rounded-md p-2"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <textarea
              required
              placeholder="Describe what happened..."
              rows={4}
              className="w-full border rounded-md p-2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <p className="text-xs text-slate-400">This goes to Admin and Managers only.</p>
            <button className="bg-brand-600 text-white py-2 px-4 rounded-md">Submit</button>
          </form>
        )}

        <h2 className="font-semibold mb-2">Your Complaints</h2>
        <div className="bg-white rounded-xl shadow divide-y">
          {mine.length === 0 && <p className="p-4 text-sm text-slate-400">You haven't raised any complaints.</p>}
          {mine.map((c) => (
            <div key={c.id} className="p-4">
              <div className="flex justify-between items-start">
                <p className="font-medium text-sm">{c.subject}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>{c.status.replace("_", " ")}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{c.description}</p>
              {c.resolutionNote && <p className="text-xs text-slate-500 mt-2">Response: {c.resolutionNote}</p>}
              <p className="text-xs text-slate-400 mt-1">{new Date(c.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>

      {canManage && (
        <div>
          <h2 className="text-lg font-semibold mb-3">All Complaints (Admin/Manager)</h2>
          <div className="bg-white rounded-xl shadow divide-y">
            {all.length === 0 && <p className="p-4 text-sm text-slate-400">No complaints raised yet.</p>}
            {all.map((c) => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{c.subject}</p>
                    <p className="text-xs text-slate-400">by {c.raisedBy?.name} · {new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>{c.status.replace("_", " ")}</span>
                </div>
                <p className="text-sm text-slate-600">{c.description}</p>
                <textarea
                  placeholder="Resolution note (optional)"
                  className="w-full border rounded-md p-2 text-sm"
                  rows={2}
                  value={noteDrafts[c.id] ?? c.resolutionNote ?? ""}
                  onChange={(e) => setNoteDrafts({ ...noteDrafts, [c.id]: e.target.value })}
                />
                <div className="flex gap-2 flex-wrap">
                  {["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(c.id, s)}
                      className={`text-xs px-2 py-1 rounded-md border ${c.status === s ? "bg-brand-600 text-white border-brand-600" : "bg-white"}`}
                    >
                      {s.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
