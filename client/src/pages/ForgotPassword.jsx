import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api");

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
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
        <Link to="/login" className="text-xs text-slate-400 flex items-center gap-1 mb-4 hover:text-slate-600">
          <ArrowLeft size={14} /> Back to login
        </Link>

        {sent ? (
          <div className="text-center py-4">
            <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
            <h1 className="text-lg font-bold">Check your email</h1>
            <p className="text-sm text-slate-500 mt-2">
              If <strong>{email}</strong> is registered, we've sent a link to reset your password. It expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-xl font-bold">Forgot your password?</h1>
            <p className="text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full border rounded-md p-2 pl-9"
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button disabled={loading} className="w-full bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 disabled:opacity-50">
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
