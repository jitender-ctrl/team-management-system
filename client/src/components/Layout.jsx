import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Handshake,
  MessageCircle,
  Inbox,
  Clock,
  Users as UsersIcon,
  ScrollText,
  Search,
  Sun,
  Moon,
  Bell,
  Menu,
  X,
  Zap,
  LogOut,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Avatar from "./Avatar";
import CommandPalette from "./CommandPalette";
import api from "../api/axios";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, perm: null },
  { to: "/projects", label: "Projects", icon: FolderKanban, perm: ["projects.view", "projects.manage"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, perm: null },
  { to: "/clients", label: "Clients", icon: Handshake, perm: ["clients.view", "clients.manage"] },
  { to: "/chat", label: "Chat", icon: MessageCircle, perm: null },
  { to: "/complaints", label: "Complaints", icon: Inbox, perm: null },
  { to: "/attendance", label: "Attendance", icon: Clock, perm: null },
  { to: "/users", label: "Team & Roles", icon: UsersIcon, perm: "users.manage" },
  { to: "/activity-log", label: "Activity Log", icon: ScrollText, perm: ["users.manage", "projects.manage", "clients.manage"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, perm: null },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="text-brand-100 hover:text-white transition-colors"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  function load() {
    api.get("/notifications").then(({ data }) => {
      setNotifications(data.data.notifications);
      setUnreadCount(data.data.unreadCount);
    }).catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s for new alerts
    return () => clearInterval(interval);
  }, []);

  async function handleOpenNotification(n) {
    if (!n.isRead) await api.put(`/notifications/${n.id}/read`);
    setOpen(false);
    load();
    if (n.link) navigate(n.link);
  }

  async function handleMarkAllRead() {
    await api.put("/notifications/read-all");
    load();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative text-brand-100 hover:text-white transition-colors">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white text-slate-800 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto"
          >
            <div className="flex justify-between items-center p-3 border-b">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-brand-600">Mark all read</button>
              )}
            </div>
            {notifications.length === 0 && (
              <p className="p-4 text-sm text-slate-400">You're all caught up.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleOpenNotification(n)}
                className={`w-full text-left p-3 text-sm border-b hover:bg-slate-50 ${!n.isRead ? "bg-brand-50" : ""}`}
              >
                <p>{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  // Close the off-canvas sidebar whenever the route changes (mobile only).
  useEffect(() => setMobileOpen(false), [location.pathname]);

  // Global keyboard shortcut: Ctrl+K / Cmd+K opens the search & quick-nav palette.
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const sidebarContent = (
    <>
      <div className="p-5 text-xl font-bold border-b border-brand-600 dark:border-slate-800 flex justify-between items-center">
        <span className="flex items-center gap-2">
          <Zap size={22} className="text-yellow-300" fill="currentColor" /> TeamFlow
        </span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
      <div className="p-3">
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center justify-between text-xs bg-brand-800/60 dark:bg-slate-900 rounded-md px-3 py-2 text-brand-100 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Search size={14} /> Search…
          </span>
          <span className="border border-brand-500 dark:border-slate-700 rounded px-1">Ctrl K</span>
        </button>
      </div>
      <nav className="flex-1 p-3 pt-0 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => !item.perm || hasPermission(item.perm))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-600 dark:bg-brand-700" : "hover:bg-brand-600/60 dark:hover:bg-slate-800"
                }`
              }
            >
              <item.icon size={17} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
      </nav>
      <div className="p-3 border-t border-brand-600 dark:border-slate-800">
        <Link to={`/users/${user?.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Avatar url={user?.avatarUrl} name={user?.name} size="sm" />
          <div>
            <div className="text-sm font-medium">{user?.name}</div>
            <div className="text-xs text-brand-100">{user?.role?.name}</div>
          </div>
        </Link>
        <button onClick={logout} className="mt-2 flex items-center gap-1.5 text-xs text-brand-100 hover:text-white transition-colors">
          <LogOut size={12} /> Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-brand-700 dark:bg-slate-950 text-white flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-brand-700 dark:bg-slate-950 text-white flex items-center justify-between px-4 py-3">
        <button onClick={() => setMobileOpen(true)} className="text-xl" aria-label="Open menu">
          <Menu size={22} />
        </button>
        <span className="font-bold flex items-center gap-2">
          <Zap size={20} className="text-yellow-300" fill="currentColor" /> TeamFlow
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => setPaletteOpen(true)} aria-label="Search"><Search size={18} /></button>
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>

      {/* Mobile off-canvas sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "tween", duration: 0.2 }}
              className="w-64 bg-brand-700 dark:bg-slate-950 text-white flex flex-col"
            >
              <div className="flex justify-end p-2">
                <button onClick={() => setMobileOpen(false)} className="text-white px-2" aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto">{sidebarContent}</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 p-4 md:p-6 pt-20 md:pt-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
