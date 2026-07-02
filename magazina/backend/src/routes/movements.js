import { Router } from "express";
import { q } from "../config/db.js";
import { asyncHandler } from "../middleware/auth.js";
import { recordMovement } from "../services/stock.js";

const router = Router();

/**
 * GET /api/movements — historiku i lëvizjeve
 * Query: page, limit, type, product_id, date_from, date_to, search
 */
router.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  const add = (clause, value) => { params.push(value); where.push(clause.replace("?", `$${params.length}`)); };

  if (req.query.type) add("m.type = ?", req.query.type);
  if (req.query.product_id) add("m.product_id = ?", req.query.product_id);
  if (req.query.date_from) add("m.created_at >= ?", req.query.date_from);
  if (req.query.date_to) add("m.created_at < (?::date + 1)", req.query.date_to);
  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    where.push(`(p.code ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countQ = q(
    `SELECT COUNT(*)::int AS total FROM movements m JOIN products p ON p.id = m.product_id ${whereSql}`,
    params
  );
  const dataQ = q(
    `SELECT m.*, p.code AS product_code, p.name AS product_name, p.unit,
            u.name AS user_name
     FROM movements m
     JOIN products p ON p.id = m.product_id
     LEFT JOIN users u ON u.id = m.user_id
     ${whereSql}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [{ rows: [{ total }] }, { rows }] = await Promise.all([countQ, dataQ]);

  res.json({ data: rows, total, page, pages: Math.ceil(total / limit) || 1 });
}));

// POST /api/movements — regjistro hyrje / dalje / transferim
router.post("/", asyncHandler(async (req, res) => {
  const { product_id, type, quantity, from_location, to_location, note } = req.body || {};
  const movement = await recordMovement({
    productId: product_id,
    type,
    quantity,
    fromLocation: from_location,
    toLocation: to_location,
    note,
    userId: req.user.id
  });
  res.status(201).json(movement);
}));

export default router;
