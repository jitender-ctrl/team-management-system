import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, CheckCircle2 } from "lucide-react";
import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api");

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords don't match");
    if (password.length < 8) return setError("Password must be at least 8 characters");

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, { token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "This link is invalid or has expired");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm"
      >
        {done ? (
          <div className="text-center py-4">
            <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
            <h1 className="text-lg font-bold">Password reset</h1>
            <p className="text-sm text-slate-500 mt-2">Taking you to login…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-xl font-bold">Set a new password</h1>
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full border rounded-md p-2 pl-9"
                type="password"
                required
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full border rounded-md p-2 pl-9"
                type="password"
                required
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <button disabled={loading} className="w-full bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 disabled:opacity-50">
              {loading ? "Saving…" : "Reset password"}
            </button>
            <Link to="/login" className="block text-center text-xs text-slate-400 hover:text-slate-600">Back to login</Link>
          </form>
        )}
      </motion.div>
    </div>
  );
}
