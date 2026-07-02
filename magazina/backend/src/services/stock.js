import { withTransaction } from "../config/db.js";

/**
 * Merr (dhe kyç me FOR UPDATE) rreshtin e stokut për një produkt në një
 * lokacion; e krijon me sasi 0 nëse nuk ekziston ende.
 */
async function lockStockRow(client, productId, locationId) {
  await client.query(
    `INSERT INTO stock_levels (product_id, location_id, quantity)
     VALUES ($1, $2, 0)
     ON CONFLICT (product_id, location_id) DO NOTHING`,
    [productId, locationId]
  );
  const { rows } = await client.query(
    "SELECT * FROM stock_levels WHERE product_id = $1 AND location_id = $2 FOR UPDATE",
    [productId, locationId]
  );
  return rows[0];
}

async function getLocation(client, id, label) {
  const { rows } = await client.query(
    "SELECT id, name, is_active FROM locations WHERE id = $1",
    [id]
  );
  if (!rows[0]) {
    throw Object.assign(new Error(`${label} nuk u gjet`), { status: 400 });
  }
  return rows[0];
}

/**
 * Kur lokacioni nuk është specifikuar: nëse produkti ka stok në një lokacion
 * të vetëm, e përdor atë; përndryshe kërkon që të zgjidhet lokacioni.
 */
async function resolveSingleStockLocation(client, productId) {
  const { rows } = await client.query(
    "SELECT location_id FROM stock_levels WHERE product_id = $1 AND quantity > 0",
    [productId]
  );
  if (rows.length === 1) return rows[0].location_id;
  if (rows.length === 0) {
    throw Object.assign(new Error("Produkti nuk ka stok në asnjë lokacion"), { status: 400 });
  }
  throw Object.assign(
    new Error("Produkti ndodhet në disa lokacione — zgjidhni lokacionin"),
    { status: 400 }
  );
}

/**
 * Regjistron një lëvizje inventari brenda një transaksioni:
 *  - 'in'       → shton sasinë në lokacionin e zgjedhur
 *  - 'out'      → zbret sasinë nga lokacioni i zgjedhur (kontrollon stokun e atij lokacioni)
 *  - 'transfer' → zhvendos një sasi nga një lokacion në një tjetër (totali s'ndryshon)
 * Totali te products.quantity mbahet gjithmonë i sinkronizuar me shumën e
 * stock_levels. Pas çdo lëvizjeje kontrollohet stoku minimal për njoftim.
 */
export async function recordMovement({ productId, type, quantity, fromLocationId, toLocationId, note, userId }) {
  if (!["in", "out", "transfer"].includes(type)) {
    throw Object.assign(new Error("Lloj i pavlefshëm lëvizjeje"), { status: 400 });
  }
  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    throw Object.assign(new Error("Sasia duhet të jetë më e madhe se zero"), { status: 400 });
  }

  return withTransaction(async (client) => {
    // Kyç rreshtin e produktit që të shmangen kushtet e garës (race conditions)
    const { rows } = await client.query(
      "SELECT id, name, code, quantity, min_stock FROM products WHERE id = $1 FOR UPDATE",
      [productId]
    );
    const product = rows[0];
    if (!product) throw Object.assign(new Error("Produkti nuk u gjet"), { status: 404 });

    let newQty = Number(product.quantity);
    let fromLoc = null;
    let toLoc = null;

    if (type === "in") {
      if (!toLocationId) {
        // Nëse sistemi ka vetëm një lokacion aktiv, përdore atë
        const { rows: locs } = await client.query(
          "SELECT id FROM locations WHERE is_active = TRUE"
        );
        if (locs.length === 1) toLocationId = locs[0].id;
        else throw Object.assign(new Error("Hyrja kërkon lokacionin e vendosjes"), { status: 400 });
      }
      toLoc = await getLocation(client, toLocationId, "Lokacioni i vendosjes");
      const sl = await lockStockRow(client, productId, toLoc.id);
      await client.query(
        "UPDATE stock_levels SET quantity = quantity + $1 WHERE id = $2",
        [qty, sl.id]
      );
      newQty += qty;
    } else if (type === "out") {
      if (!fromLocationId) fromLocationId = await resolveSingleStockLocation(client, productId);
      fromLoc = await getLocation(client, fromLocationId, "Lokacioni i daljes");
      const sl = await lockStockRow(client, productId, fromLoc.id);
      if (qty > Number(sl.quantity)) {
        throw Object.assign(
          new Error(`Stok i pamjaftueshëm në "${fromLoc.name}": ka vetëm ${Number(sl.quantity)}`),
          { status: 400 }
        );
      }
      await client.query(
        "UPDATE stock_levels SET quantity = quantity - $1 WHERE id = $2",
        [qty, sl.id]
      );
      newQty -= qty;
    } else {
      // transfer
      if (!toLocationId) {
        throw Object.assign(new Error("Transferimi kërkon lokacionin e mbërritjes"), { status: 400 });
      }
      if (!fromLocationId) fromLocationId = await resolveSingleStockLocation(client, productId);
      if (String(fromLocationId) === String(toLocationId)) {
        throw Object.assign(
          new Error("Lokacioni i nisjes dhe i mbërritjes nuk mund të jenë i njëjti"),
          { status: 400 }
        );
      }
      fromLoc = await getLocation(client, fromLocationId, "Lokacioni i nisjes");
      toLoc = await getLocation(client, toLocationId, "Lokacioni i mbërritjes");

      // Kyçi gjithmonë në të njëjtën renditje (id më i vogël i pari) — shmang deadlock
      const firstId = Math.min(fromLoc.id, toLoc.id);
      const secondId = Math.max(fromLoc.id, toLoc.id);
      const slFirst = await lockStockRow(client, productId, firstId);
      const slSecond = await lockStockRow(client, productId, secondId);
      const slFrom = fromLoc.id === firstId ? slFirst : slSecond;
      const slTo = toLoc.id === firstId ? slFirst : slSecond;

      if (qty > Number(slFrom.quantity)) {
        throw Object.assign(
          new Error(`Stok i pamjaftueshëm në "${fromLoc.name}": ka vetëm ${Number(slFrom.quantity)}`),
          { status: 400 }
        );
      }
      await client.query("UPDATE stock_levels SET quantity = quantity - $1 WHERE id = $2", [qty, slFrom.id]);
      await client.query("UPDATE stock_levels SET quantity = quantity + $1 WHERE id = $2", [qty, slTo.id]);
      // totali i produktit nuk ndryshon
    }

    // Përditëso totalin dhe vendndodhjen përmbledhëse (lokacioni me stokun më të madh)
    await client.query(
      `UPDATE products
       SET quantity = $2,
           location = (
             SELECT l.name
             FROM stock_levels sl
             JOIN locations l ON l.id = sl.location_id
             WHERE sl.product_id = $1 AND sl.quantity > 0
             ORDER BY sl.quantity DESC, l.name
             LIMIT 1
           )
       WHERE id = $1`,
      [productId, newQty]
    );

    const { rows: mv } = await client.query(
      `INSERT INTO movements
         (product_id, type, quantity, from_location, to_location, from_location_id, to_location_id, note, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        productId,
        type,
        qty,
        fromLoc?.name || null,
        toLoc?.name || null,
        fromLoc?.id || null,
        toLoc?.id || null,
        note || null,
        userId
      ]
    );

    // Njoftim automatik kur produkti bie nën ose në stokun minimal
    if (newQty <= Number(product.min_stock)) {
      const { rows: existing } = await client.query(
        "SELECT id FROM notifications WHERE product_id = $1 AND is_read = FALSE LIMIT 1",
        [productId]
      );
      if (existing.length === 0) {
        await client.query(
          "INSERT INTO notifications (product_id, message) VALUES ($1, $2)",
          [
            productId,
            `Stok i ulët: "${product.name}" (${product.code}) ka ${newQty} njësi, minimumi është ${product.min_stock}.`
          ]
        );
      }
    }

    return mv[0];
  });
}
