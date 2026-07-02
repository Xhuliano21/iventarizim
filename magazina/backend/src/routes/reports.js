import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { q } from "../config/db.js";
import { asyncHandler } from "../middleware/auth.js";

const router = Router();

/* ------------------------------------------------------------------
   Ndihmës: dërgon një raport si JSON, Excel ose PDF sipas ?format=
------------------------------------------------------------------- */
async function sendReport(res, { format, filename, title, columns, rows }) {
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(title.slice(0, 31));
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 18 }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }

  if (format === "pdf") {
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
    doc.pipe(res);

    doc.fontSize(15).font("Helvetica-Bold").text(title);
    doc.fontSize(8).font("Helvetica")
       .text(`Gjeneruar më: ${new Date().toLocaleString("sq-AL")}`, { align: "right" });
    doc.moveDown(0.8);

    const startX = doc.page.margins.left;
    const usable = doc.page.width - startX - doc.page.margins.right;
    const colW = usable / columns.length;
    let y = doc.y;

    const drawRow = (values, bold = false) => {
      if (y > doc.page.height - 50) { doc.addPage(); y = doc.page.margins.top; }
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      values.forEach((v, i) => {
        doc.text(String(v ?? ""), startX + i * colW, y, { width: colW - 6, ellipsis: true });
      });
      y += 16;
      doc.moveTo(startX, y - 4).lineTo(startX + usable, y - 4)
         .strokeColor("#DDDDDD").lineWidth(0.5).stroke();
    };

    drawRow(columns.map((c) => c.header), true);
    rows.forEach((r) => drawRow(columns.map((c) => r[c.key])));
    doc.end();
    return;
  }

  res.json({ title, columns, rows });
}

/* ------------------------------------------------------------------
   GET /api/reports/inventory — raporti i inventarit aktual
------------------------------------------------------------------- */
router.get("/inventory", asyncHandler(async (req, res) => {
  const { rows } = await q(`
    SELECT p.code, p.name, COALESCE(c.name, '—') AS category, p.unit,
           p.quantity, p.min_stock, p.purchase_price, p.sale_price, p.location,
           ROUND(p.quantity * COALESCE(p.purchase_price, 0), 2) AS stock_value
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY p.name
  `);
  await sendReport(res, {
    format: req.query.format,
    filename: "raporti-inventarit",
    title: "Raporti i Inventarit Aktual",
    columns: [
      { header: "Kodi", key: "code", width: 14 },
      { header: "Emërtimi", key: "name", width: 30 },
      { header: "Kategoria", key: "category" },
      { header: "Njësia", key: "unit", width: 10 },
      { header: "Sasia", key: "quantity", width: 12 },
      { header: "Stoku min.", key: "min_stock", width: 12 },
      { header: "Çmimi blerjes", key: "purchase_price" },
      { header: "Çmimi shitjes", key: "sale_price" },
      { header: "Vendndodhja", key: "location" },
      { header: "Vlera e stokut", key: "stock_value" }
    ],
    rows
  });
}));

/* ------------------------------------------------------------------
   GET /api/reports/low-stock — produktet me stok të ulët
------------------------------------------------------------------- */
router.get("/low-stock", asyncHandler(async (req, res) => {
  const { rows } = await q(`
    SELECT code, name, COALESCE(category_name, '—') AS category, unit,
           quantity, min_stock, (min_stock - quantity) AS deficit, location
    FROM v_low_stock ORDER BY (quantity - min_stock) ASC
  `);
  await sendReport(res, {
    format: req.query.format,
    filename: "raporti-stok-i-ulet",
    title: "Raporti i Produkteve me Stok të Ulët",
    columns: [
      { header: "Kodi", key: "code", width: 14 },
      { header: "Emërtimi", key: "name", width: 32 },
      { header: "Kategoria", key: "category" },
      { header: "Njësia", key: "unit", width: 10 },
      { header: "Sasia", key: "quantity", width: 12 },
      { header: "Stoku min.", key: "min_stock", width: 12 },
      { header: "Mungesa", key: "deficit", width: 12 },
      { header: "Vendndodhja", key: "location" }
    ],
    rows
  });
}));

/* ------------------------------------------------------------------
   GET /api/reports/movements?date_from=&date_to= — hyrje-daljet e periudhës
------------------------------------------------------------------- */
router.get("/movements", asyncHandler(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.date_from) { params.push(req.query.date_from); where.push(`m.created_at >= $${params.length}`); }
  if (req.query.date_to) { params.push(req.query.date_to); where.push(`m.created_at < ($${params.length}::date + 1)`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await q(`
    SELECT TO_CHAR(m.created_at, 'DD.MM.YYYY HH24:MI') AS date,
           CASE m.type WHEN 'in' THEN 'Hyrje' WHEN 'out' THEN 'Dalje' ELSE 'Transferim' END AS type,
           p.code, p.name, m.quantity, p.unit,
           COALESCE(m.from_location, '—') AS from_location,
           COALESCE(m.to_location, '—') AS to_location,
           COALESCE(u.name, '—') AS user_name,
           COALESCE(m.note, '') AS note
    FROM movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.user_id
    ${whereSql}
    ORDER BY m.created_at DESC
  `, params);

  const period =
    req.query.date_from || req.query.date_to
      ? ` (${req.query.date_from || "…"} – ${req.query.date_to || "…"})`
      : "";

  await sendReport(res, {
    format: req.query.format,
    filename: "raporti-levizjeve",
    title: `Raporti i Hyrje-Daljeve${period}`,
    columns: [
      { header: "Data", key: "date", width: 18 },
      { header: "Lloji", key: "type", width: 12 },
      { header: "Kodi", key: "code", width: 14 },
      { header: "Produkti", key: "name", width: 30 },
      { header: "Sasia", key: "quantity", width: 10 },
      { header: "Njësia", key: "unit", width: 10 },
      { header: "Nga", key: "from_location" },
      { header: "Te", key: "to_location" },
      { header: "Përdoruesi", key: "user_name" },
      { header: "Koment", key: "note", width: 28 }
    ],
    rows
  });
}));

export default router;
