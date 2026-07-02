import { Router } from "express";
import { q } from "../config/db.js";
import { asyncHandler, requireAdmin } from "../middleware/auth.js";

const router = Router();

const TYPES = ["kat", "dhome", "zyre", "zone", "tjeter"];

function readBody(body) {
  const { name, type, description, is_active } = body || {};
  if (!name?.trim()) {
    throw Object.assign(new Error("Emri i lokacionit është i detyrueshëm"), { status: 400 });
  }
  const t = TYPES.includes(type) ? type : "dhome";
  return {
    name: name.trim(),
    type: t,
    description: description || null,
    is_active: is_active === false || is_active === "false" ? false : true
  };
}

/**
 * GET /api/locations — lista e lokacioneve me gjendjen aktuale aktive:
 * sa produkte të ndryshme ka, sasia totale dhe vlera e stokut.
 * Query: active=1 → vetëm lokacionet aktive (për dropdown-e)
 */
router.get("/", asyncHandler(async (req, res) => {
  const onlyActive = req.query.active === "1";
  const { rows } = await q(`
    SELECT l.*,
           COUNT(sl.id) FILTER (WHERE sl.quantity > 0)::int AS product_count,
           COALESCE(SUM(sl.quantity), 0) AS total_quantity,
           COALESCE(SUM(sl.quantity * COALESCE(p.purchase_price, 0)), 0) AS stock_value
    FROM locations l
    LEFT JOIN stock_levels sl ON sl.location_id = l.id
    LEFT JOIN products p ON p.id = sl.product_id
    ${onlyActive ? "WHERE l.is_active = TRUE" : ""}
    GROUP BY l.id
    ORDER BY l.name
  `);
  res.json(rows);
}));

// GET /api/locations/:id/stock — produktet dhe sasitë brenda një lokacioni
router.get("/:id/stock", asyncHandler(async (req, res) => {
  const { rows } = await q(
    `SELECT p.id, p.code, p.name, p.unit, c.name AS category_name, sl.quantity,
            ROUND(sl.quantity * COALESCE(p.purchase_price, 0), 2) AS stock_value
     FROM stock_levels sl
     JOIN products p ON p.id = sl.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE sl.location_id = $1 AND sl.quantity > 0
     ORDER BY p.name`,
    [req.params.id]
  );
  res.json(rows);
}));

// POST /api/locations — krijo lokacion (kat / dhomë / zyrë / zonë)
router.post("/", asyncHandler(async (req, res) => {
  const b = readBody(req.body);
  const { rows } = await q(
    `INSERT INTO locations (name, type, description, is_active)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [b.name, b.type, b.description, b.is_active]
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/locations/:id — modifiko lokacion
router.put("/:id", asyncHandler(async (req, res) => {
  const b = readBody(req.body);
  const { rows } = await q(
    `UPDATE locations SET name = $1, type = $2, description = $3, is_active = $4
     WHERE id = $5 RETURNING *`,
    [b.name, b.type, b.description, b.is_active, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Lokacioni nuk u gjet" });

  // Mbaj të sinkronizuar emrat historikë te lëvizjet dhe produktet
  await q("UPDATE movements SET from_location = $1 WHERE from_location_id = $2", [b.name, req.params.id]);
  await q("UPDATE movements SET to_location = $1 WHERE to_location_id = $2", [b.name, req.params.id]);

  res.json(rows[0]);
}));

// DELETE /api/locations/:id — vetëm admin; lejohet vetëm nëse s'ka stok brenda
router.delete("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { rows: [{ total }] } = await q(
    "SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_levels WHERE location_id = $1",
    [req.params.id]
  );
  if (Number(total) > 0) {
    return res.status(400).json({
      error: `Lokacioni ka ${Number(total)} njësi stok — transferojini fillimisht në një lokacion tjetër.`
    });
  }
  const { rowCount } = await q("DELETE FROM locations WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Lokacioni nuk u gjet" });
  res.json({ ok: true });
}));

export default router;
