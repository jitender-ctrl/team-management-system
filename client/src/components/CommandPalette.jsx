import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Handshake,
  MessageCircle,
  CalendarDays,
  Inbox,
  Clock,
  Users as UsersIcon,
  ScrollText,
  Search as SearchIcon,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const NAV_COMMANDS = [
  { label: "Go to Dashboard", to: "/", perm: null, icon: LayoutDashboard },
  { label: "Go to Projects", to: "/projects", perm: ["projects.view", "projects.manage"], icon: FolderKanban },
  { label: "Go to Clients", to: "/clients", perm: ["clients.view", "clients.manage"], icon: Handshake },
  { label: "Go to Chat", to: "/chat", perm: null, icon: MessageCircle },
  { label: "Go to Calendar", to: "/calendar", perm: null, icon: CalendarDays },
  { label: "Go to Complaints", to: "/complaints", perm: null, icon: Inbox },
  { label: "Go to Attendance", to: "/attendance", perm: null, icon: Clock },
  { label: "Go to Team & Roles", to: "/users", perm: "users.manage", icon: UsersIcon },
  { label: "Go to Activity Log", to: "/activity-log", perm: ["users.manage", "projects.manage", "clients.manage"], icon: ScrollText },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], projects: [], tasks: [], clients: [] });
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults({ users: [], projects: [], tasks: [], clients: [] });
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults({ users: [], projects: [], tasks: [], clients: [] });
      return;
    }
    debounceRef.current = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(query)}`).then(({ data }) => setResults(data.data)).catch(() => {});
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function go(path) {
    navigate(path);
    onClose();
  }

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const filteredNav = NAV_COMMANDS.filter(
    (c) => (!c.perm || hasPermission(c.perm)) && (!query.trim() || c.label.toLowerCase().includes(query.toLowerCase()))
  );

  const hasResults =
    results.users.length || results.projects.length || results.tasks.length || results.clients.length || filteredNav.length;

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative border-b">
          <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to… (people, projects, tasks, clients)"
            className="w-full p-4 pl-11 text-sm outline-none"
          />
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!hasResults && <p className="p-4 text-sm text-slate-400">No matches.</p>}

          {filteredNav.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 px-2 pb-1">Navigate</p>
              {filteredNav.map((c) => (
                <button key={c.to} onClick={() => go(c.to)} className="w-full text-left px-2 py-2 rounded-md hover:bg-slate-50 text-sm flex items-center gap-2">
                  <c.icon size={15} /> {c.label}
                </button>
              ))}
            </div>
          )}

          {results.users.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 px-2 pb-1">People</p>
              {results.users.map((u) => (
                <button key={u.id} onClick={() => go(`/users/${u.id}`)} className="w-full text-left px-2 py-2 rounded-md hover:bg-slate-50 text-sm">
                  {u.name} <span className="text-xs text-slate-400">{u.email}</span>
                </button>
              ))}
            </div>
          )}

          {results.projects.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 px-2 pb-1">Projects</p>
              {results.projects.map((p) => (
                <button key={p.id} onClick={() => go(`/projects/${p.id}`)} className="w-full text-left px-2 py-2 rounded-md hover:bg-slate-50 text-sm">
                  {p.name} <span className="text-xs text-slate-400">{p.status}</span>
                </button>
              ))}
            </div>
          )}

          {results.tasks.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 px-2 pb-1">Tasks</p>
              {results.tasks.map((t) => (
                <button key={t.id} onClick={() => go(`/projects/${t.projectId}`)} className="w-full text-left px-2 py-2 rounded-md hover:bg-slate-50 text-sm">
                  {t.title} <span className="text-xs text-slate-400">{t.project?.name}</span>
                </button>
              ))}
            </div>
          )}

          {results.clients.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 px-2 pb-1">Clients</p>
              {results.clients.map((c) => (
                <button key={c.id} onClick={() => go(`/clients`)} className="w-full text-left px-2 py-2 rounded-md hover:bg-slate-50 text-sm">
                  {c.name} {c.company && <span className="text-xs text-slate-400">{c.company}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t px-4 py-2 text-[10px] text-slate-400 flex justify-between">
          <span>↵ to select</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
