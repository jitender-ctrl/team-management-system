const { fail } = require("../utils/response");

/**
 * Dynamic permission check.
 * Usage: requirePermission("projects.manage")
 * Looks up req.user.role.permissions (a JSON map) at request time —
 * so permissions can change per-role in the DB without redeploying code.
 * Pass multiple keys to require ANY of them: requirePermission(["tasks.manage","tasks.assign"])
 */
function requirePermission(permissionKeys) {
  const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];

  return (req, res, next) => {
    const perms = (req.user && req.user.role && req.user.role.permissions) || {};

    // A role can also carry a top-level "*": true to act as super-admin
    if (perms["*"] === true) return next();

    const allowed = keys.some((key) => perms[key] === true);
    if (!allowed) return fail(res, 403, `Missing permission: ${keys.join(" or ")}`);
    next();
  };
}

module.exports = { requirePermission };
