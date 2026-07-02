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
   Ndihmës: ndërton WHERE-in e përbashkët të filtrave për lëvizjet
   (periudha, kategoria, produkti, lokacioni, lloji)
------------------------------------------------------------------- */
function buildMovementFilters(query, { typesOnly } = {}) {
  const where = [];
  const params = [];
  const add = (clause, value) => { params.push(value); where.push(clause.replace("?", `$${params.length}`)); };

  if (typesOnly) where.push(`m.type IN ('in', 'out')`);
  if (query.type && ["in", "out", "transfer"].includes(query.type)) add("m.type = ?", query.type);
  if (query.date_from) add("m.created_at >= ?", query.date_from);
  if (query.date_to) add("m.created_at < (?::date + 1)", query.date_to);
  if (query.category_id) add("p.category_id = ?", query.category_id);
  if (query.product_id) add("m.product_id = ?", query.product_id);
  if (query.location_id) {
    params.push(query.location_id);
    where.push(`(m.from_location_id = $${params.length} OR m.to_location_id = $${params.length})`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

function periodText(query) {
  return query.date_from || query.date_to
    ? ` (${query.date_from || "…"} – ${query.date_to || "…"})`
    : "";
}

/* ------------------------------------------------------------------
   GET /api/reports/summary — përmbledhja e hyrje-daljeve me totale.
   Query: date_from, date_to, group=day|week|month|year,
          category_id, product_id, location_id, format=xlsx|pdf
------------------------------------------------------------------- */
const GROUPS = {
  day:   { trunc: "day",   label: "TO_CHAR(period, 'DD.MM.YYYY')" },
  week:  { trunc: "week",  label: "'Java ' || TO_CHAR(period, 'IW, IYYY')" },
  month: { trunc: "month", label: "TO_CHAR(period, 'MM.YYYY')" },
  year:  { trunc: "year",  label: "TO_CHAR(period, 'YYYY')" }
};

router.get("/summary", asyncHandler(async (req, res) => {
  const group = GROUPS[req.query.group] ? req.query.group : "day";
  const { whereSql, params } = buildMovementFilters(req.query, { typesOnly: true });

  const { rows } = await q(`
    WITH grouped AS (
      SELECT DATE_TRUNC('${GROUPS[group].trunc}', m.created_at) AS period,
             COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'in'), 0)  AS total_in,
             COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'out'), 0) AS total_out,
             COUNT(*) FILTER (WHERE m.type = 'in')::int  AS in_count,
             COUNT(*) FILTER (WHERE m.type = 'out')::int AS out_count
      FROM movements m
      JOIN products p ON p.id = m.product_id
      ${whereSql}
      GROUP BY 1
    )
    SELECT ${GROUPS[group].label} AS period_label,
           total_in, total_out, in_count, out_count,
           (total_in - total_out) AS balance
    FROM grouped
    ORDER BY period DESC
  `, params);

  const totals = rows.reduce(
    (t, r) => ({
      total_in: t.total_in + Number(r.total_in),
      total_out: t.total_out + Number(r.total_out),
      in_count: t.in_count + Number(r.in_count),
      out_count: t.out_count + Number(r.out_count)
    }),
    { total_in: 0, total_out: 0, in_count: 0, out_count: 0 }
  );
  totals.balance = totals.total_in - totals.total_out;

  if (req.query.format === "xlsx" || req.query.format === "pdf") {
    const exportRows = [
      ...rows,
      { period_label: "TOTALI", ...totals }
    ];
    return sendReport(res, {
      format: req.query.format,
      filename: "raporti-permbledhja-hyrje-dalje",
      title: `Përmbledhja Hyrje-Dalje${periodText(req.query)}`,
      columns: [
        { header: "Periudha", key: "period_label", width: 18 },
        { header: "Hyrje (sasi)", key: "total_in", width: 14 },
        { header: "Dalje (sasi)", key: "total_out", width: 14 },
        { header: "Bilanci", key: "balance", width: 14 },
        { header: "Nr. hyrjesh", key: "in_count", width: 12 },
        { header: "Nr. daljesh", key: "out_count", width: 12 }
      ],
      rows: exportRows
    });
  }

  res.json({ totals, rows, group });
}));

/* ------------------------------------------------------------------
   GET /api/reports/locations — gjendja aktuale sipas lokacioneve
   (kate / dhoma / zyra) me produktet dhe vlerat brenda secilit
------------------------------------------------------------------- */
router.get("/locations", asyncHandler(async (req, res) => {
  const { rows } = await q(`
    SELECT location_name AS location,
           CASE location_type
             WHEN 'kat' THEN 'Kat' WHEN 'dhome' THEN 'Dhomë' WHEN 'zyre' THEN 'Zyrë'
             WHEN 'zone' THEN 'Zonë' ELSE 'Tjetër'
           END AS type,
           code, product_name AS name, COALESCE(category_name, '—') AS category,
           unit, quantity, stock_value
    FROM v_location_stock
    ORDER BY location_name, product_name
  `);
  await sendReport(res, {
    format: req.query.format,
    filename: "raporti-gjendja-sipas-lokacioneve",
    title: "Gjendja e Stokut sipas Lokacioneve",
    columns: [
      { header: "Lokacioni", key: "location", width: 22 },
      { header: "Lloji", key: "type", width: 10 },
      { header: "Kodi", key: "code", width: 14 },
      { header: "Produkti", key: "name", width: 30 },
      { header: "Kategoria", key: "category" },
      { header: "Njësia", key: "unit", width: 10 },
      { header: "Sasia", key: "quantity", width: 12 },
      { header: "Vlera e stokut", key: "stock_value" }
    ],
    rows
  });
}));

/* ------------------------------------------------------------------
   GET /api/reports/inventory — raporti i inventarit aktual
------------------------------------------------------------------- */
router.get("/inventory", asyncHandler(async (req, res) => {
  const { rows } = await q(`
    SELECT p.code, p.name, COALESCE(c.name, '—') AS category, p.unit,
           p.quantity, p.min_stock, p.purchase_price, p.sale_price,
           COALESCE(
             (SELECT STRING_AGG(l.name || ': ' || TO_CHAR(sl.quantity, 'FM999999990.###'), ', ' ORDER BY l.name)
              FROM stock_levels sl JOIN locations l ON l.id = sl.location_id
              WHERE sl.product_id = p.id AND sl.quantity > 0),
             p.location, '—'
           ) AS location,
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
      { header: "Vendndodhja", key: "location", width: 28 },
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
   GET /api/reports/movements — hyrje-daljet e periudhës.
   Query: date_from, date_to, type, category_id, product_id, location_id
------------------------------------------------------------------- */
router.get("/movements", asyncHandler(async (req, res) => {
  const { whereSql, params } = buildMovementFilters(req.query);

  const { rows } = await q(`
    SELECT TO_CHAR(m.created_at, 'DD.MM.YYYY HH24:MI') AS date,
           CASE m.type WHEN 'in' THEN 'Hyrje' WHEN 'out' THEN 'Dalje' ELSE 'Transferim' END AS type,
           p.code, p.name, m.quantity, p.unit,
           COALESCE(lf.name, m.from_location, '—') AS from_location,
           COALESCE(lt.name, m.to_location, '—') AS to_location,
           COALESCE(u.name, '—') AS user_name,
           COALESCE(m.note, '') AS note
    FROM movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN locations lf ON lf.id = m.from_location_id
    LEFT JOIN locations lt ON lt.id = m.to_location_id
    ${whereSql}
    ORDER BY m.created_at DESC
  `, params);

  await sendReport(res, {
    format: req.query.format,
    filename: "raporti-levizjeve",
    title: `Raporti i Hyrje-Daljeve${periodText(req.query)}`,
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
