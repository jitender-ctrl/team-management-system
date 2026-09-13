import { useEffect, useState } from "react";
import { PlusCircle, Pencil, Trash2, PauseCircle, Circle } from "lucide-react";
import api from "../api/axios";
import Avatar from "../components/Avatar";

const ACTION_ICONS = {
  created: { icon: PlusCircle, color: "text-green-600" },
  updated: { icon: Pencil, color: "text-blue-600" },
  deleted: { icon: Trash2, color: "text-red-600" },
  deactivated: { icon: PauseCircle, color: "text-amber-600" },
};

const ENTITY_FILTERS = ["", "Project", "Task", "User", "Client"];

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (entityType) params.set("entityType", entityType);
    api.get(`/activity-log?${params}`).then(({ data }) => setLogs(data.data)).finally(() => setLoading(false));
  }, [entityType]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="border rounded-md p-2 text-sm bg-white">
          {ENTITY_FILTERS.map((f) => (
            <option key={f} value={f}>{f || "All types"}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow divide-y">
        {loading && <p className="p-4 text-sm text-slate-400">Loading…</p>}
        {!loading && logs.length === 0 && <p className="p-4 text-sm text-slate-400">No activity recorded yet.</p>}
        {logs.map((log) => {
          const actionMeta = ACTION_ICONS[log.action] || { icon: Circle, color: "text-slate-400" };
          const ActionIcon = actionMeta.icon;
          return (
            <div key={log.id} className="p-3 flex items-start gap-3">
              <ActionIcon size={18} className={`${actionMeta.color} shrink-0 mt-0.5`} title={log.action} />
              {log.user ? (
                <Avatar url={log.user.avatarUrl} name={log.user.name} size="sm" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-100 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">{log.user?.name || "Someone"}</span> {log.description}
                </p>
                <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
              <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">{log.entityType}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
