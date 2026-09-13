import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data.data);
        localStorage.setItem("user", JSON.stringify(data.data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.data.token);
    localStorage.setItem("user", JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  }

  async function refreshUser() {
    const { data } = await api.get("/auth/me");
    setUser(data.data);
    localStorage.setItem("user", JSON.stringify(data.data));
    return data.data;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  // Dynamic permission check mirrors the backend: reads user.role.permissions
  // at call time, so UI elements hide/show based on whatever the role's
  // permission map currently says — no hardcoded role-name checks.
  function hasPermission(keys) {
    if (!user?.role?.permissions) return false;
    const perms = user.role.permissions;
    if (perms["*"] === true) return true;
    const list = Array.isArray(keys) ? keys : [keys];
    return list.some((k) => perms[k] === true);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasPermission, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
