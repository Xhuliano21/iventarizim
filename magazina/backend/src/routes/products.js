import { Router } from "express";
import { q } from "../config/db.js";
import { asyncHandler, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Kolonat e lejuara për sortim (mbrojtje nga SQL injection)
const SORTABLE = {
  code: "p.code",
  name: "p.name",
  quantity: "p.quantity",
  min_stock: "p.min_stock",
  purchase_price: "p.purchase_price",
  sale_price: "p.sale_price",
  created_at: "p.created_at",
  category: "c.name"
};

/**
 * GET /api/products
 * Query: page, limit, search, category_id, stock=low|ok, date_from, date_to, sort, order
 */
router.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  const add = (clause, value) => { params.push(value); where.push(clause.replace("?", `$${params.length}`)); };

  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    where.push(`(p.code ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
  }
  if (req.query.category_id) add("p.category_id = ?", req.query.category_id);
  if (req.query.stock === "low") where.push("p.quantity <= p.min_stock");
  if (req.query.stock === "ok") where.push("p.quantity > p.min_stock");
  if (req.query.date_from) add("p.created_at >= ?", req.query.date_from);
  if (req.query.date_to) add("p.created_at < (?::date + 1)", req.query.date_to);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sortCol = SORTABLE[req.query.sort] || "p.created_at";
  const order = req.query.order === "asc" ? "ASC" : "DESC";

  const countQ = q(`SELECT COUNT(*)::int AS total FROM products p ${whereSql}`, params);
  const dataQ = q(
    `SELECT p.*, c.name AS category_name,
            (p.quantity <= p.min_stock) AS is_low_stock
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY ${sortCol} ${order}, p.id
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [{ rows: [{ total }] }, { rows }] = await Promise.all([countQ, dataQ]);

  res.json({ data: rows, total, page, pages: Math.ceil(total / limit) || 1 });
}));

// GET /api/products/all — listë e shkurtër për dropdown-e
router.get("/all", asyncHandler(async (_req, res) => {
  const { rows } = await q(
    "SELECT id, code, name, unit, quantity, location FROM products ORDER BY name"
  );
  res.json(rows);
}));

// GET /api/products/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const { rows } = await q(
    `SELECT p.*, c.name AS category_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Produkti nuk u gjet" });
  res.json(rows[0]);
}));

function readBody(body) {
  const { code, name, category_id, description, unit, quantity, min_stock, purchase_price, sale_price, location } = body || {};
  if (!code?.trim()) throw Object.assign(new Error("Kodi i produktit është i detyrueshëm"), { status: 400 });
  if (!name?.trim()) throw Object.assign(new Error("Emërtimi është i detyrueshëm"), { status: 400 });
  return [
    code.trim(), name.trim(), category_id || null, description || null,
    unit?.trim() || "copë", Number(quantity) || 0, Number(min_stock) || 0,
    purchase_price === "" || purchase_price == null ? null : Number(purchase_price),
    sale_price === "" || sale_price == null ? null : Number(sale_price),
    location?.trim() || null
  ];
}

// POST /api/products — shto produkt
router.post("/", asyncHandler(async (req, res) => {
  const vals = readBody(req.body);
  const { rows } = await q(
    `INSERT INTO products (code, name, category_id, description, unit, quantity, min_stock, purchase_price, sale_price, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    vals
  );
  res.status(201).json(rows[0]);
}));

// PUT /api/products/:id — modifiko produkt
router.put("/:id", asyncHandler(async (req, res) => {
  const vals = readBody(req.body);
  const { rows } = await q(
    `UPDATE products SET code=$1, name=$2, category_id=$3, description=$4, unit=$5,
            quantity=$6, min_stock=$7, purchase_price=$8, sale_price=$9, location=$10
     WHERE id = $11 RETURNING *`,
    [...vals, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Produkti nuk u gjet" });
  res.json(rows[0]);
}));

// DELETE /api/products/:id — vetëm admin
router.delete("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { rowCount } = await q("DELETE FROM products WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Produkti nuk u gjet" });
  res.json({ ok: true });
}));

export default router;
