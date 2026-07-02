import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { q } from "../config/db.js";
import { asyncHandler, requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/login — hyrja në sistem
router.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email dhe fjalëkalimi janë të detyrueshëm" });
  }

  const { rows } = await q(
    "SELECT id, name, email, password_hash, role, is_active FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  const user = rows[0];

  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) return res.status(401).json({ error: "Email ose fjalëkalim i gabuar" });
  if (!user.is_active) return res.status(403).json({ error: "Llogaria është çaktivizuar" });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || "8h" }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
}));

// GET /api/auth/me — të dhënat e përdoruesit aktual
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await q(
    "SELECT id, name, email, role FROM users WHERE id = $1",
    [req.user.id]
  );
  res.json(rows[0] || null);
}));

// POST /api/auth/logout — me JWT dalja bëhet duke hedhur token-in në klient;
// endpoint-i ekziston për simetri dhe auditim të mundshëm në të ardhmen.
router.post("/logout", requireAuth, (_req, res) => res.json({ ok: true }));

export default router;
