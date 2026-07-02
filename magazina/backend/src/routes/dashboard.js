import { Router } from "express";
import { q } from "../config/db.js";
import { asyncHandler } from "../middleware/auth.js";

const router = Router();

// GET /api/dashboard — statistikat kryesore
router.get("/", asyncHandler(async (_req, res) => {
  const [totals, lowStock, recent, chart] = await Promise.all([
    q(`SELECT COUNT(*)::int AS total_products,
              COALESCE(SUM(quantity), 0) AS total_quantity,
              COALESCE(SUM(quantity * COALESCE(purchase_price, 0)), 0) AS stock_value,
              COUNT(*) FILTER (WHERE quantity <= min_stock)::int AS low_stock_count
       FROM products`),
    q(`SELECT id, code, name, quantity, min_stock, unit, category_name
       FROM v_low_stock ORDER BY (quantity - min_stock) ASC LIMIT 8`),
    q(`SELECT p.id, p.code, p.name, p.quantity, p.unit, p.created_at, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.created_at DESC LIMIT 6`),
    // Hyrjet dhe daljet e 30 ditëve të fundit, të grupuara sipas ditës
    q(`SELECT d::date AS day,
              COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'in'), 0)  AS total_in,
              COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'out'), 0) AS total_out
       FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day') AS d
       LEFT JOIN movements m ON m.created_at::date = d::date
       GROUP BY d ORDER BY d`)
  ]);

  res.json({
    totals: totals.rows[0],
    lowStock: lowStock.rows,
    recentProducts: recent.rows,
    chart: chart.rows
  });
}));

export default router;
