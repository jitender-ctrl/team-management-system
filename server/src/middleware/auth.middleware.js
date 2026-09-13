const { verifyToken } = require("../utils/jwt");
const prisma = require("../config/prisma");
const { fail } = require("../utils/response");

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;
    if (!token) return fail(res, 401, "No token provided");

    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user || !user.isActive) return fail(res, 401, "User not found or inactive");

    req.user = user; // includes user.role.permissions (JSON)
    next();
  } catch (err) {
    return fail(res, 401, "Invalid or expired token");
  }
}

module.exports = { requireAuth };
