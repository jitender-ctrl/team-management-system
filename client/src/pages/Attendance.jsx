import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "../utils/toast";

export default function Attendance() {
  const { hasPermission } = useAuth();
  const [today, setToday] = useState(null);
  const [team, setTeam] = useState([]);
  const [breakType, setBreakType] = useState("Break");

  function load() {
    api.get("/attendance/me/today").then(({ data }) => setToday(data.data)).catch(() => setToday(null));
  }

  useEffect(() => {
    load();
    if (hasPermission("attendance.view_all")) {
      api.get("/attendance/team").then(({ data }) => setTeam(data.data));
    }
  }, []);

  const openBreak = today?.breaks?.find((b) => !b.endTime);

  async function checkIn() {
    await api.post("/attendance/check-in");
    load();
  }
  async function checkOut() {
    await api.post("/attendance/check-out");
    load();
  }
  async function startBreak() {
    await api.post("/attendance/break/start", { type: breakType });
    load();
  }
  async function endBreak(breakId) {
    const { data } = await api.put(`/attendance/break/${breakId}/end`);
    if (data.data?.breakAlertTriggered) {
      toast.error(`You've exceeded the 1-hour daily break limit — your Team Lead and Manager have been notified.`);
    }
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Attendance & Breaks</h1>

      <div className="bg-white rounded-xl shadow p-5 max-w-lg space-y-4">
        <div className="flex gap-3">
          <button onClick={checkIn} disabled={!!today?.checkIn} className="bg-brand-600 disabled:opacity-40 text-white px-4 py-2 rounded-md text-sm">
            Check In
          </button>
          <button onClick={checkOut} disabled={!today?.checkIn || !!today?.checkOut} className="bg-slate-700 disabled:opacity-40 text-white px-4 py-2 rounded-md text-sm">
            Check Out
          </button>
        </div>

        {today?.checkIn && !today?.checkOut && (
          <div className="border-t pt-4 space-y-2">
            {today?.overBreakLimit && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 text-xs font-medium rounded-md p-2">
                <AlertTriangle size={14} />
                You've exceeded the 1-hour daily break limit ({today.totalBreakMinutesToday} min today). Your Team
                Lead and Manager have been notified.
              </div>
            )}
            <div className="flex gap-2">
              <select value={breakType} onChange={(e) => setBreakType(e.target.value)} className="border rounded-md p-2 text-sm">
                <option>Break</option>
                <option>Lunch</option>
                <option>Tea Break</option>
              </select>
              <button onClick={startBreak} disabled={!!openBreak} className="bg-amber-500 disabled:opacity-40 text-white px-4 py-2 rounded-md text-sm">
                Start Break
              </button>
              {openBreak && (
                <button onClick={() => endBreak(openBreak.id)} className="bg-amber-700 text-white px-4 py-2 rounded-md text-sm">
                  End Break
                </button>
              )}
            </div>
            <ul className="text-xs text-slate-500 space-y-1">
              {today?.breaks?.map((b) => (
                <li key={b.id}>
                  {b.type}: {new Date(b.startTime).toLocaleTimeString()} —{" "}
                  {b.endTime ? new Date(b.endTime).toLocaleTimeString() : "ongoing"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {hasPermission("attendance.view_all") && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <h2 className="p-4 font-semibold border-b">Team Attendance</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Date</th>
                <th className="p-3">Check In</th>
                <th className="p-3">Check Out</th>
                <th className="p-3">Breaks</th>
                <th className="p-3">Break Time Today</th>
              </tr>
            </thead>
            <tbody>
              {team.map((r) => (
                <tr key={r.id} className={`border-t ${r.overBreakLimit ? "bg-red-50" : ""}`}>
                  <td className="p-3">{r.user.name}</td>
                  <td className="p-3">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="p-3">{r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "—"}</td>
                  <td className="p-3">{r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "—"}</td>
                  <td className="p-3">{r.breaks.length}</td>
                  <td className="p-3">
                    {r.overBreakLimit ? (
                      <span className="flex items-center gap-1 text-red-600 font-medium text-xs">
                        <AlertTriangle size={12} /> {r.totalBreakMinutesToday} min (over limit)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">{r.totalBreakMinutesToday} min</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
