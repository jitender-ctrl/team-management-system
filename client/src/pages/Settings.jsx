import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Mail, Phone, ShieldCheck, ShieldAlert } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "../utils/toast";

function SectionCard({ icon: Icon, title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-brand-600" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();

  // Change password
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  // Change email
  const [emailForm, setEmailForm] = useState({ newEmail: "", currentPassword: "" });
  const [emailSaving, setEmailSaving] = useState(false);

  // Phone / mobile number
  const [phone, setPhone] = useState(user?.phone || "");
  const [phoneSaving, setPhoneSaving] = useState(false);

  const [resending, setResending] = useState(false);
  const [ownOtp, setOwnOtp] = useState("");
  const [verifyingOwn, setVerifyingOwn] = useState(false);
  const [changeEmailOtp, setChangeEmailOtp] = useState("");
  const [confirmingEmailChange, setConfirmingEmailChange] = useState(false);
  const [emailChangeRequested, setEmailChangeRequested] = useState(!!user?.pendingEmail);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return toast.error("New passwords don't match");
    setPwSaving(true);
    try {
      await api.put("/auth/change-password", {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success("Password changed");
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
    } finally {
      setPwSaving(false);
    }
  }

  async function handleChangeEmail(e) {
    e.preventDefault();
    setEmailSaving(true);
    try {
      const { data } = await api.post("/auth/change-email", emailForm);
      toast.success(data.message);
      setEmailChangeRequested(true);
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleConfirmEmailChange(e) {
    e.preventDefault();
    setConfirmingEmailChange(true);
    try {
      await api.post("/auth/confirm-email-otp", { otp: changeEmailOtp });
      toast.success("Email updated");
      setEmailForm({ newEmail: "", currentPassword: "" });
      setChangeEmailOtp("");
      setEmailChangeRequested(false);
      refreshUser?.();
    } finally {
      setConfirmingEmailChange(false);
    }
  }

  async function handleSavePhone(e) {
    e.preventDefault();
    setPhoneSaving(true);
    try {
      await api.put(`/users/${user.id}`, { phone });
      toast.success("Mobile number updated");
      refreshUser?.();
    } finally {
      setPhoneSaving(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      const { data } = await api.post("/auth/resend-verification");
      toast.success(data.message);
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyOwnEmail(e) {
    e.preventDefault();
    setVerifyingOwn(true);
    try {
      await api.post("/auth/verify-otp", { email: user.email, otp: ownOtp });
      toast.success("Email verified");
      setOwnOtp("");
      refreshUser?.();
    } finally {
      setVerifyingOwn(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Account Settings</h1>

      <SectionCard icon={user?.emailVerified ? ShieldCheck : ShieldAlert} title="Email Verification">
        {user?.emailVerified ? (
          <p className="text-sm text-green-600">Your email address is verified.</p>
        ) : (
          <div className="text-sm space-y-2">
            <p className="text-amber-600">Your email address hasn't been verified yet.</p>
            <button onClick={handleResendVerification} disabled={resending} className="text-brand-600 text-xs underline disabled:opacity-50">
              {resending ? "Sending…" : "Send verification code"}
            </button>
            <form onSubmit={handleVerifyOwnEmail} className="flex gap-2">
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                className="border rounded-md p-2 text-sm text-center font-mono tracking-widest w-32"
                value={ownOtp}
                onChange={(e) => setOwnOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button disabled={verifyingOwn || ownOtp.length < 6} className="bg-brand-600 text-white text-xs px-3 py-2 rounded-md disabled:opacity-50">
                {verifyingOwn ? "Verifying…" : "Verify"}
              </button>
            </form>
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Mail} title="Change Email">
        {emailChangeRequested ? (
          <form onSubmit={handleConfirmEmailChange} className="space-y-3">
            <p className="text-xs text-slate-400">
              A 6-digit code was sent to <strong>{emailForm.newEmail || "your new email"}</strong>. Enter it below to
              confirm the change — your login email stays the same until you do.
            </p>
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                className="border rounded-md p-2 text-sm text-center font-mono tracking-widest w-32"
                value={changeEmailOtp}
                onChange={(e) => setChangeEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button disabled={confirmingEmailChange || changeEmailOtp.length < 6} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50">
                {confirmingEmailChange ? "Confirming…" : "Confirm"}
              </button>
            </div>
            <button type="button" onClick={() => setEmailChangeRequested(false)} className="text-xs text-slate-400">
              Cancel / start over
            </button>
          </form>
        ) : (
          <form onSubmit={handleChangeEmail} className="space-y-3">
            <p className="text-xs text-slate-400">
              Current email: <strong>{user?.email}</strong>. Changing it sends a 6-digit code to the new address —
              your login email won't change until you confirm it.
            </p>
            <input
              type="email"
              required
              placeholder="New email address"
              className="w-full border rounded-md p-2 text-sm"
              value={emailForm.newEmail}
              onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
            />
            <input
              type="password"
              required
              placeholder="Current password (to confirm it's you)"
              className="w-full border rounded-md p-2 text-sm"
              value={emailForm.currentPassword}
              onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
            />
            <button disabled={emailSaving} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50">
              {emailSaving ? "Sending…" : "Send verification code"}
            </button>
          </form>
        )}
      </SectionCard>

      <SectionCard icon={Phone} title="Mobile Number">
        <form onSubmit={handleSavePhone} className="flex gap-2">
          <input
            type="tel"
            placeholder="Mobile number"
            className="flex-1 border rounded-md p-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button disabled={phoneSaving} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50">
            {phoneSaving ? "Saving…" : "Save"}
          </button>
        </form>
      </SectionCard>

      <SectionCard icon={Lock} title="Change Password">
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            required
            placeholder="Current password"
            className="w-full border rounded-md p-2 text-sm"
            value={pwForm.currentPassword}
            onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
          />
          <input
            type="password"
            required
            placeholder="New password (min. 8 characters)"
            className="w-full border rounded-md p-2 text-sm"
            value={pwForm.newPassword}
            onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
          />
          <input
            type="password"
            required
            placeholder="Confirm new password"
            className="w-full border rounded-md p-2 text-sm"
            value={pwForm.confirm}
            onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
          />
          <button disabled={pwSaving} className="bg-brand-600 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50">
            {pwSaving ? "Saving…" : "Change password"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
