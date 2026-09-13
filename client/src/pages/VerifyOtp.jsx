import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api");

export default function VerifyOtp() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/verify-otp`, { email, otp });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || "That code is invalid or has expired");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return setError("Enter your email first");
    setError("");
    setResending(true);
    try {
      await axios.post(`${API_BASE}/auth/resend-otp`, { email });
      setError(""); // clear any previous error
    } finally {
      setResending(false);
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
            <h1 className="text-lg font-bold">Email verified</h1>
            <p className="text-sm text-slate-500 mt-2">You're all set.</p>
            <Link to="/login" className="inline-block mt-4 text-brand-600 text-sm hover:underline">Continue to login →</Link>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="flex items-center gap-2 text-brand-600">
              <ShieldCheck size={20} />
              <h1 className="text-xl font-bold text-slate-800">Verify your email</h1>
            </div>
            <p className="text-sm text-slate-500">Enter the 6-digit code we emailed you. It expires in 10 minutes.</p>
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            <input
              type="email"
              required
              placeholder="Your email"
              className="w-full border rounded-md p-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              required
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              className="w-full border rounded-md p-2 text-center text-2xl tracking-[0.5em] font-mono"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <button disabled={loading} className="w-full bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 disabled:opacity-50">
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button type="button" onClick={handleResend} disabled={resending} className="w-full text-xs text-brand-600 disabled:opacity-50">
              {resending ? "Sending…" : "Resend code"}
            </button>
            <Link to="/login" className="block text-center text-xs text-slate-400 hover:text-slate-600">Back to login</Link>
          </form>
        )}
      </motion.div>
    </div>
  );
}
