const crypto = require("crypto");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes — short-lived by design

// A 6-digit numeric code, zero-padded (e.g. "042817"). Uses crypto for the
// random source rather than Math.random() since this gates account access.
function generateOtp() {
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
  return { code, expiry: new Date(Date.now() + OTP_TTL_MS) };
}

module.exports = { generateOtp, OTP_TTL_MS };
