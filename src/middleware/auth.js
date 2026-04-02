const jwt = require("jsonwebtoken");

function ensureAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  return next();
}

function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).render("error", {
      title: "Forbidden",
      message: "Admin access required"
    });
  }
  return next();
}

function apiAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    req.apiUser = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function apiAdmin(req, res, next) {
  if (!req.apiUser || req.apiUser.role !== "admin") {
    return res.status(403).json({ message: "Admin role required" });
  }
  return next();
}

module.exports = {
  ensureAuth,
  ensureAdmin,
  apiAuth,
  apiAdmin
};
