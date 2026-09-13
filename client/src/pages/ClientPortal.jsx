import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Lock } from "lucide-react";
import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "/api");

const PRIORITY_COLORS = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

export default function ClientPortal() {
  const { token } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_BASE}/portal/${token}`)
      .then(({ data }) => setProject(data.data))
      .catch((err) => setError(err?.response?.data?.message || "This portal link is invalid or has been disabled."));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-xl shadow p-8 text-center max-w-md">
          <p className="text-4xl mb-3 flex justify-center"><Lock size={40} className="text-slate-400" /></p>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow p-6">
          <p className="text-xs text-brand-600 font-semibold uppercase tracking-wide">Project Status Portal</p>
          <h1 className="text-2xl font-bold mt-1">{project.name}</h1>
          {project.description && <p className="text-slate-500 mt-1">{project.description}</p>}
          {project.client && (
            <p className="text-sm text-slate-400 mt-2">
              For {project.client.name}{project.client.company ? ` · ${project.client.company}` : ""}
            </p>
          )}

          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Overall Progress</span>
                <span>{project.progressPct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-600" style={{ width: `${project.progressPct}%` }} />
              </div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{project.status}</span>
          </div>

          {(project.startDate || project.endDate) && (
            <p className="text-xs text-slate-400 mt-3">
              {project.startDate && `Started ${new Date(project.startDate).toLocaleDateString()}`}
              {project.startDate && project.endDate && " · "}
              {project.endDate && `Target ${new Date(project.endDate).toLocaleDateString()}`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.columns.map((col) => (
            <div key={col.name} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                <span className="font-semibold text-sm">{col.name}</span>
                <span className="text-xs text-slate-400">({col.tasks.length})</span>
              </div>
              {col.tasks.length === 0 ? (
                <p className="text-xs text-slate-400">Nothing here.</p>
              ) : (
                <ul className="space-y-2">
                  {col.tasks.map((t, i) => (
                    <li key={i} className="text-sm border-b pb-2 flex justify-between items-center gap-2">
                      <span>{t.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_COLORS[t.priority] || ""}`}>
                        {t.priority}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400">This is a read-only status view. Contact your project team for details.</p>
      </div>
    </div>
  );
}
