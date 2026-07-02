import jwt from "jsonwebtoken";

// Verifikon token-in JWT dhe vendos req.user
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Kërkohet autentikim" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sesioni ka skaduar, hyni përsëri" });
  }
}

// Lejon vetëm administratorët (fshirje, përdorues, backup, etj.)
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Veprim i lejuar vetëm për administratorët" });
  }
  next();
}

// Mbështjellës për funksione async në rrugë
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
