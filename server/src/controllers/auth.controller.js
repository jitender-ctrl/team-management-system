const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const { signToken } = require("../utils/jwt");
const { ok, created, fail } = require("../utils/response");
const { sendVerificationEmail, sendOtpEmail, sendPasswordResetEmail } = require("../utils/mailer");
const { generateOtp } = require("../utils/otp");

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Registration is left open here for setup convenience; in production, gate this
// behind requireAuth + requirePermission("users.manage") once your first admin exists.
async function register(req, res) {
  try {
    const { name, email, password, roleId } = req.body;
    if (!name || !email || !password || !roleId) {
      return fail(res, 400, "name, email, password, roleId are required");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail(res, 409, "Email already registered");

    const hashed = await bcrypt.hash(password, 10);
    const { code, expiry } = generateOtp();

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        roleId: Number(roleId),
        otpCode: code,
        otpExpiry: expiry,
      },
      include: { role: true },
    });

    await sendOtpEmail(user.email, { code, name: user.name });

    const token = signToken({ userId: user.id });
    const { password: _pw, ...safeUser } = user;
    return created(res, { user: safeUser, token }, "Registered successfully — check your email for a verification code");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 400, "email and password are required");

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user || !user.isActive) return fail(res, 401, "Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return fail(res, 401, "Invalid credentials");

    const token = signToken({ userId: user.id });
    const { password: _pw, ...safeUser } = user;
    return ok(res, { user: safeUser, token }, "Logged in");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function me(req, res) {
  const { password, ...safeUser } = req.user;
  return ok(res, safeUser);
}

// Always responds success regardless of whether the email exists — so this
// endpoint can't be used to enumerate which addresses are registered.
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return fail(res, 400, "email is required");

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const resetToken = makeToken();
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000) },
      });
      await sendPasswordResetEmail(user.email, resetToken);
    }
    return ok(res, null, "If that email is registered, a reset link has been sent");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return fail(res, 400, "token and password are required");
    if (password.length < 8) return fail(res, 400, "Password must be at least 8 characters");

    const user = await prisma.user.findUnique({ where: { resetToken: token } });
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return fail(res, 400, "This reset link is invalid or has expired");
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });
    return ok(res, null, "Password reset — you can log in now");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Self-service password change while logged in (requires the current password).
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return fail(res, 400, "currentPassword and newPassword are required");
    if (newPassword.length < 8) return fail(res, 400, "New password must be at least 8 characters");

    const match = await bcrypt.compare(currentPassword, req.user.password);
    if (!match) return fail(res, 401, "Current password is incorrect");

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    return ok(res, null, "Password changed");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Public: verifies a brand-new account's primary email via the 6-digit
// code sent at signup/creation. Keyed by email since the person may not
// have a session yet (e.g. a team member an Admin just created). Only
// applies to the primary email — an in-progress email *change* is
// confirmed via confirmEmailChangeOtp instead, since that requires being
// logged in as the account making the change.
async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return fail(res, 400, "email and otp are required");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.otpCode || !user.otpExpiry || user.otpExpiry < new Date() || user.otpCode !== otp) {
      return fail(res, 400, "That code is invalid or has expired");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, otpCode: null, otpExpiry: null },
    });
    return ok(res, null, "Email verified");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Public: resend a fresh code to an unverified account, by email.
// Always responds the same way regardless of whether the email exists or
// is already verified, so it can't be used to probe which accounts exist.
async function resendOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email) return fail(res, 400, "email is required");

    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified) {
      const { code, expiry } = generateOtp();
      await prisma.user.update({ where: { id: user.id }, data: { otpCode: code, otpExpiry: expiry } });
      await sendOtpEmail(user.email, { code, name: user.name });
    }
    return ok(res, null, "If that email needs verification, a new code has been sent");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Authed: confirms an in-progress email change with the code sent to the
// *new* address. Only the account making the change can call this (it
// reads req.user, not an email from the request body).
async function confirmEmailChangeOtp(req, res) {
  try {
    const { otp } = req.body;
    if (!otp) return fail(res, 400, "otp is required");
    if (!req.user.pendingEmail) return fail(res, 400, "No email change is pending");
    if (!req.user.otpCode || !req.user.otpExpiry || req.user.otpExpiry < new Date() || req.user.otpCode !== otp) {
      return fail(res, 400, "That code is invalid or has expired");
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { email: req.user.pendingEmail, pendingEmail: null, emailVerified: true, otpCode: null, otpExpiry: null },
      include: { role: true },
    });
    const { password: _pw, ...safeUser } = user;
    return ok(res, safeUser, "Email updated");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function verifyEmail(req, res) {
  try {
    const { token } = req.params;
    const user = await prisma.user.findUnique({ where: { verifyToken: token } });
    if (!user || !user.verifyTokenExpiry || user.verifyTokenExpiry < new Date()) {
      return fail(res, 400, "This verification link is invalid or has expired");
    }

    // If this token was for an email change, swap pendingEmail into email now.
    const newEmail = user.pendingEmail || user.email;
    await prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail, pendingEmail: null, emailVerified: true, verifyToken: null, verifyTokenExpiry: null },
    });
    return ok(res, null, "Email verified");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

async function resendVerification(req, res) {
  try {
    if (req.user.emailVerified) return ok(res, null, "Your email is already verified");
    const { code, expiry } = generateOtp();
    await prisma.user.update({
      where: { id: req.user.id },
      data: { otpCode: code, otpExpiry: expiry },
    });
    await sendOtpEmail(req.user.pendingEmail || req.user.email, { code, name: req.user.name });
    return ok(res, null, "Verification code sent");
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

// Changing your email doesn't take effect immediately — it's staged in
// pendingEmail until the new address is verified via a code sent to it,
// so you can't lock yourself out by mistyping it (or lose the ability to
// reset your password if the new address was wrong).
async function requestEmailChange(req, res) {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !currentPassword) return fail(res, 400, "newEmail and currentPassword are required");

    const match = await bcrypt.compare(currentPassword, req.user.password);
    if (!match) return fail(res, 401, "Current password is incorrect");

    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== req.user.id) return fail(res, 409, "That email is already in use");

    const { code, expiry } = generateOtp();
    await prisma.user.update({
      where: { id: req.user.id },
      data: { pendingEmail: newEmail, otpCode: code, otpExpiry: expiry },
    });
    await sendOtpEmail(newEmail, { code, name: req.user.name });
    return ok(res, null, `A verification code was sent to ${newEmail} — enter it below to confirm the change`);
  } catch (err) {
    return fail(res, 500, err.message);
  }
}

module.exports = {
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
};
