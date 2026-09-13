import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000/api");

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    axios
      .get(`${API_BASE}/auth/verify-email/${token}`)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || "This verification link is invalid or has expired.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm text-center"
      >
        {status === "loading" && (
          <>
            <Loader2 size={40} className="mx-auto text-brand-500 mb-3 animate-spin" />
            <p className="text-sm text-slate-500">Verifying…</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 size={40} className="mx-auto text-green-500 mb-3" />
            <h1 className="text-lg font-bold">Email verified</h1>
            <p className="text-sm text-slate-500 mt-2">You're all set.</p>
            <Link to="/login" className="inline-block mt-4 text-brand-600 text-sm hover:underline">Continue to login →</Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={40} className="mx-auto text-red-500 mb-3" />
            <h1 className="text-lg font-bold">Verification failed</h1>
            <p className="text-sm text-slate-500 mt-2">{message}</p>
            <Link to="/login" className="inline-block mt-4 text-brand-600 text-sm hover:underline">Back to login</Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
