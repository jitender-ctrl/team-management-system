import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// A lightweight, purely decorative inline SVG scene — no external image
// fetch needed, animates gently on load and loops a few subtle elements.
function HeroIllustration() {
  return (
    <motion.svg viewBox="0 0 400 320" className="w-full max-w-md" initial="hidden" animate="visible">
      <defs>
        <linearGradient id="grad1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <motion.rect
        x="40" y="60" width="320" height="200" rx="16"
        fill="url(#grad1)" opacity="0.15"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.15 }}
        transition={{ duration: 0.6 }}
      />
      {[{ x: 70, y: 90, w: 120 }, { x: 70, y: 130, w: 90 }, { x: 70, y: 170, w: 150 }].map((bar, i) => (
        <motion.rect
          key={i}
          x={bar.x} y={bar.y} height="14" rx="7" fill="#4f46e5"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: bar.w, opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.15, duration: 0.5, ease: "easeOut" }}
        />
      ))}
      <motion.circle
        cx="300" cy="110" r="26" fill="#22c55e" opacity="0.9"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.15, 1] }}
        transition={{ delay: 0.5, duration: 0.6 }}
      />
      <motion.path
        d="M289 110 l8 8 l16 -16" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
      />
      <motion.g
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect x="230" y="190" width="90" height="55" rx="10" fill="white" stroke="#c7d2fe" strokeWidth="2" />
        <circle cx="250" cy="210" r="8" fill="#a5b4fc" />
        <rect x="265" y="205" width="40" height="6" rx="3" fill="#c7d2fe" />
        <rect x="265" y="216" width="28" height="6" rx="3" fill="#e0e7ff" />
      </motion.g>
    </motion.svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-700 to-indigo-900 items-center justify-center p-10 flex-col text-white">
        <div className="flex items-center gap-2 text-2xl font-bold mb-8">
          <Zap size={28} className="text-yellow-300" fill="currentColor" /> TeamFlow
        </div>
        <HeroIllustration />
        <p className="mt-8 text-brand-100 text-center max-w-sm">
          Projects, tasks, chat, and performance — all in one place for your whole team.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-4"
        >
          <div className="lg:hidden flex items-center gap-2 text-xl font-bold text-brand-700 mb-1">
            <Zap size={22} fill="currentColor" /> TeamFlow
          </div>
          <p className="text-sm text-slate-500">Sign in to your workspace</p>
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div>
            <label className="text-sm font-medium">Email</label>
            <div className="relative mt-1">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full border rounded-md p-2 pl-9"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Password</label>
              <Link to="/forgot-password" className="text-xs text-brand-600 hover:underline">Forgot password?</Link>
            </div>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full border rounded-md p-2 pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </div>
          </div>
          <button className="w-full bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 transition-colors flex items-center justify-center gap-1.5">
            Log in <ArrowRight size={16} />
          </button>

          <p className="text-xs text-center text-slate-400">
            Got a verification code? <Link to="/verify-otp" className="text-brand-600 hover:underline">Verify your email</Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
