import { Router } from "express";
import { q } from "../config/db.js";
import { asyncHandler } from "../middleware/auth.js";

const router = Router();

// GET /api/notifications — lista (të palexuarat të parat)
router.get("/", asyncHandler(async (_req, res) => {
  const { rows } = await q(`
    SELECT n.*, p.code AS product_code, p.name AS product_name
    FROM notifications n
    JOIN products p ON p.id = n.product_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 50
  `);
  res.json(rows);
}));

// GET /api/notifications/unread-count
router.get("/unread-count", asyncHandler(async (_req, res) => {
  const { rows } = await q("SELECT COUNT(*)::int AS count FROM notifications WHERE is_read = FALSE");
  res.json(rows[0]);
}));

// PUT /api/notifications/:id/read — shëno si të lexuar
router.put("/:id/read", asyncHandler(async (req, res) => {
  await q("UPDATE notifications SET is_read = TRUE WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

// PUT /api/notifications/read-all
router.put("/read-all", asyncHandler(async (_req, res) => {
  await q("UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE");
  res.json({ ok: true });
}));

export default router;
