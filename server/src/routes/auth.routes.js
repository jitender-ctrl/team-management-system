const router = require("express").Router();
const {
  register,
  login,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  verifyOtp,
  resendOtp,
  confirmEmailChangeOtp,
  resendVerification,
  requestEmailChange,
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Legacy link-based verification (kept for backward compatibility) —
// OTP is now the primary mechanism, see /verify-otp below.
router.get("/verify-email/:token", verifyEmail);

// OTP-based email verification — used for new accounts (including team
// members an Admin creates) and confirming an email change.
router.post("/verify-otp", verifyOtp); // public, by email — for a brand-new/unverified account
router.post("/resend-otp", resendOtp); // public, by email
router.post("/confirm-email-otp", requireAuth, confirmEmailChangeOtp); // authed — confirms a pending email change

router.put("/change-password", requireAuth, changePassword);
router.post("/resend-verification", requireAuth, resendVerification);
router.post("/change-email", requireAuth, requestEmailChange);

module.exports = router;
