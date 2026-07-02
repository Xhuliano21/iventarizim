// Mbush databazën me të dhëna fillestare: përdorues, kategori dhe produkte shembull.
// Përdorimi:  npm run seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- Përdoruesit ---
    const adminHash = await bcrypt.hash("Admin123!", 10);
    const userHash = await bcrypt.hash("Perdorues1!", 10);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES
         ('Administratori', 'admin@magazina.al', $1, 'admin'),
         ('Punonjësi', 'punonjes@magazina.al', $2, 'user')
       ON CONFLICT (email) DO NOTHING`,
      [adminHash, userHash]
    );

    // --- Kategoritë ---
    await client.query(`
      INSERT INTO categories (name, description) VALUES
        ('Materiale ndërtimi', 'Çimento, hekur, tulla etj.'),
        ('Vegla pune', 'Vegla dore dhe elektrike'),
        ('Elektrike', 'Kabllo, çelësa, priza'),
        ('Hidraulike', 'Tuba, rakorderi, rubineta')
      ON CONFLICT (name) DO NOTHING
    `);

    // --- Produktet shembull ---
    await client.query(`
      INSERT INTO products (code, name, category_id, description, unit, quantity, min_stock, purchase_price, sale_price, location)
      VALUES
        ('PRD-001', 'Çimento 42.5R 25kg', (SELECT id FROM categories WHERE name='Materiale ndërtimi'), 'Thes çimentoje portland', 'thes', 120, 30, 450, 550, 'A-01-1'),
        ('PRD-002', 'Hekur betoni Ø12', (SELECT id FROM categories WHERE name='Materiale ndërtimi'), 'Shufra 12m', 'copë', 340, 100, 780, 920, 'A-02-3'),
        ('PRD-003', 'Trapan elektrik 750W', (SELECT id FROM categories WHERE name='Vegla pune'), NULL, 'copë', 8, 5, 6500, 8900, 'B-01-2'),
        ('PRD-004', 'Kabllo 3x2.5mm', (SELECT id FROM categories WHERE name='Elektrike'), 'Rrotull 100m', 'rrotull', 4, 6, 9800, 12500, 'C-03-1'),
        ('PRD-005', 'Tub PPR Ø25', (SELECT id FROM categories WHERE name='Hidraulike'), 'Shufra 4m', 'copë', 260, 80, 320, 450, 'D-01-4'),
        ('PRD-006', 'Bojë hidromat 15L', (SELECT id FROM categories WHERE name='Materiale ndërtimi'), 'E bardhë, për ambiente të brendshme', 'kovë', 15, 10, 2400, 3200, 'A-04-2')
      ON CONFLICT (code) DO NOTHING
    `);

    // --- Njoftim për produktin me stok të ulët (PRD-004: 4 < 6) ---
    await client.query(`
      INSERT INTO notifications (product_id, message)
      SELECT id, 'Stok i ulët: "' || name || '" (' || code || ') ka ' || quantity || ' njësi, minimumi është ' || min_stock || '.'
      FROM products
      WHERE quantity <= min_stock
        AND id NOT IN (SELECT product_id FROM notifications WHERE is_read = FALSE)
    `);

    await client.query("COMMIT");
    console.log("✔ Të dhënat fillestare u shtuan me sukses.");
    console.log("  Admin:      admin@magazina.al    / Admin123!");
    console.log("  Përdorues:  punonjes@magazina.al / Perdorues1!");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Gabim gjatë seed:", err.message);
  process.exit(1);
});
