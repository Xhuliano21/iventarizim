import { Router } from "express";
import { q } from "../config/db.js";
import { asyncHandler, requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/categories — lista me numër produktesh
router.get("/", asyncHandler(async (_req, res) => {
  const { rows } = await q(`
    SELECT c.*, COUNT(p.id)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `);
  res.json(rows);
}));

// POST /api/categories — krijo kategori
router.post("/", asyncHandler(async (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Emri i kategorisë është i detyrueshëm" });
  const { rows } = await q(
    "INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *",
    [name.trim(), description || null]
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/categories/:id — modifiko kategori
router.put("/:id", asyncHandler(async (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Emri i kategorisë është i detyrueshëm" });
  const { rows } = await q(
    "UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *",
    [name.trim(), description || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Kategoria nuk u gjet" });
  res.json(rows[0]);
}));

// DELETE /api/categories/:id — vetëm admin
router.delete("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { rowCount } = await q("DELETE FROM categories WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Kategoria nuk u gjet" });
  res.json({ ok: true });
}));

export default router;
