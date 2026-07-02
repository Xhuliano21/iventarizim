import { withTransaction } from "../config/db.js";

/**
 * Regjistron një lëvizje inventari brenda një transaksioni:
 *  - 'in'       → shton sasinë
 *  - 'out'      → zbret sasinë (kontrollon që të ketë stok të mjaftueshëm)
 *  - 'transfer' → ndryshon vendndodhjen, sasia mbetet e njëjtë
 * Pas çdo lëvizjeje kontrollon stokun minimal dhe krijon njoftim nëse duhet.
 */
export async function recordMovement({ productId, type, quantity, fromLocation, toLocation, note, userId }) {
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
      "SELECT id, name, code, quantity, min_stock, location FROM products WHERE id = $1 FOR UPDATE",
      [productId]
    );
    const product = rows[0];
    if (!product) throw Object.assign(new Error("Produkti nuk u gjet"), { status: 404 });

    let newQty = Number(product.quantity);
    let newLocation = product.location;

    if (type === "in") {
      newQty += qty;
      if (toLocation) newLocation = toLocation;
    } else if (type === "out") {
      if (qty > newQty) {
        throw Object.assign(
          new Error(`Stok i pamjaftueshëm: në magazinë ka vetëm ${newQty}`),
          { status: 400 }
        );
      }
      newQty -= qty;
    } else if (type === "transfer") {
      if (!toLocation) {
        throw Object.assign(new Error("Transferimi kërkon vendndodhjen e re"), { status: 400 });
      }
      newLocation = toLocation;
    }

    await client.query(
      "UPDATE products SET quantity = $1, location = $2 WHERE id = $3",
      [newQty, newLocation, productId]
    );

    const { rows: mv } = await client.query(
      `INSERT INTO movements (product_id, type, quantity, from_location, to_location, note, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        productId,
        type,
        qty,
        fromLocation || (type !== "in" ? product.location : null),
        toLocation || null,
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
