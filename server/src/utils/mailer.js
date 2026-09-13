const nodemailer = require("nodemailer");

// Reads SMTP config from env. For the free/easy path: a Gmail account with
// 2-Step Verification on, and an "App Password" generated at
// https://myaccount.google.com/apppasswords — that App Password goes in
// SMTP_PASS (NOT the regular Gmail password, which Google blocks for this).
//
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=youraddress@gmail.com
//   SMTP_PASS=<16-character app password>
//   SMTP_FROM="TeamFlow <youraddress@gmail.com>"
//
// Any other SMTP provider (SendGrid, Mailgun, Brevo, etc.) works the same
// way — just point SMTP_HOST/PORT/USER/PASS at their credentials.
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT) !== 587, // 465 = implicit TLS, 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

// Sends an email if SMTP is configured; otherwise logs to the console so
// local development still works end-to-end (you can copy the link from the
// server log) without requiring real credentials.
async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n📧 [EMAIL NOT SENT — no SMTP configured] To: ${to}\nSubject: ${subject}\n${text || html}\n`);
    return { sent: false };
  }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, text });
    return { sent: true };
  } catch (err) {
    console.error("Failed to send email:", err.message);
    return { sent: false, error: err.message };
  }
}

const APP_URL = process.env.CLIENT_ORIGIN || "http://localhost:5173";

async function sendVerificationEmail(to, token) {
  const link = `${APP_URL}/verify-email/${token}`;
  return sendMail({
    to,
    subject: "Verify your TeamFlow email",
    html: `<p>Confirm this email address to finish setting it up on your TeamFlow account.</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
    text: `Confirm your email: ${link} (expires in 24 hours)`,
  });
}

// The OTP-based alternative to the link above — used for new-account
// verification (including accounts an Admin creates for a team member) and
// for confirming an email change. Short, easy to read aloud/type, and
// expires quickly since it's meant to be entered right after it's sent.
async function sendOtpEmail(to, { code, name }) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return sendMail({
    to,
    subject: `Your TeamFlow verification code: ${code}`,
    html: `
      <p>${greeting}</p>
      <p>Your email verification code is:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0;">${code}</p>
      <p>Enter this code in TeamFlow to verify this email address. It expires in 10 minutes.</p>
      <p style="margin-top:20px;color:#888;font-size:12px">If you didn't request this, you can ignore this email.</p>
    `,
    text: `${greeting}\n\nYour TeamFlow verification code is: ${code}\nIt expires in 10 minutes.`,
  });
}

async function sendPasswordResetEmail(to, token) {
  const link = `${APP_URL}/reset-password/${token}`;
  return sendMail({
    to,
    subject: "Reset your TeamFlow password",
    html: `<p>Someone requested a password reset for this account. If that was you, click below:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    text: `Reset your password: ${link} (expires in 1 hour)`,
  });
}

// Sent to external guests (typically clients) invited to a meeting — they
// have no TeamFlow login, so this email itself carries every detail they
// need: when, where/link, what it's about, and who's hosting.
async function sendMeetingInviteEmail(to, { title, description, startTime, endTime, location, organizerName, guestName }) {
  const dateStr = new Date(startTime).toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const endStr = new Date(endTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const greeting = guestName ? `Hi ${guestName},` : "Hi,";

  const html = `
    <p>${greeting}</p>
    <p><strong>${organizerName}</strong> has invited you to a meeting:</p>
    <h2 style="margin:16px 0 4px">${title}</h2>
    <p style="margin:4px 0"><strong>When:</strong> ${dateStr} – ${endStr}</p>
    ${location ? `<p style="margin:4px 0"><strong>Where:</strong> ${location.startsWith("http") ? `<a href="${location}">${location}</a>` : location}</p>` : ""}
    ${description ? `<p style="margin:12px 0">${description}</p>` : ""}
    <p style="margin-top:20px;color:#888;font-size:12px">Sent via TeamFlow on behalf of ${organizerName}.</p>
  `;
  const text = `${greeting}\n\n${organizerName} has invited you to a meeting: ${title}\nWhen: ${dateStr} – ${endStr}\n${location ? `Where: ${location}\n` : ""}${description ? `\n${description}\n` : ""}`;

  return sendMail({ to, subject: `Meeting invite: ${title}`, html, text });
}

module.exports = { sendMail, sendVerificationEmail, sendOtpEmail, sendPasswordResetEmail, sendMeetingInviteEmail };
