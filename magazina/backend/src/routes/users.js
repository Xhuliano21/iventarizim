import { Router } from "express";
import bcrypt from "bcryptjs";
import { q } from "../config/db.js";
import { asyncHandler, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Të gjitha rrugët e përdoruesve janë vetëm për administratorë
router.use(requireAdmin);

// GET /api/users
router.get("/", asyncHandler(async (_req, res) => {
  const { rows } = await q(
    "SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC"
  );
  res.json(rows);
}));

// POST /api/users — krijo përdorues
router.post("/", asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "Emri, email-i dhe fjalëkalimi janë të detyrueshëm" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Fjalëkalimi duhet të ketë të paktën 8 karaktere" });
  }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await q(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_active, created_at`,
    [name.trim(), email.trim().toLowerCase(), hash, role === "admin" ? "admin" : "user"]
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/users/:id — përditëso (emër, rol, status, fjalëkalim opsional)
router.put("/:id", asyncHandler(async (req, res) => {
  const { name, role, is_active, password } = req.body || {};
  const id = Number(req.params.id);

  if (id === req.user.id && (role !== "admin" || is_active === false)) {
    return res.status(400).json({ error: "Nuk mund të hiqni të drejtat e llogarisë suaj" });
  }

  const { rows } = await q(
    `UPDATE users SET name = COALESCE($1, name),
                      role = COALESCE($2, role),
                      is_active = COALESCE($3, is_active)
     WHERE id = $4 RETURNING id, name, email, role, is_active, created_at`,
    [name?.trim() || null, role || null, typeof is_active === "boolean" ? is_active : null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

  if (password) {
    if (password.length < 8) return res.status(400).json({ error: "Fjalëkalimi duhet të ketë të paktën 8 karaktere" });
    const hash = await bcrypt.hash(password, 10);
    await q("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, id]);
  }
  res.json(rows[0]);
}));

// DELETE /api/users/:id
router.delete("/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: "Nuk mund të fshini llogarinë tuaj" });
  const { rowCount } = await q("DELETE FROM users WHERE id = $1", [id]);
  if (!rowCount) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
  res.json({ ok: true });
}));

export default router;
