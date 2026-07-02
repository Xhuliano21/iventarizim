import bcrypt from "bcryptjs";
import { q } from "./config/db.js";

export async function initDb() {
  // USERS
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      password_hash VARCHAR(200) NOT NULL,
      role VARCHAR(10) NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin', 'user')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // CATEGORIES
  await q(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // PRODUCTS
  await q(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      code VARCHAR(40) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT,
      unit VARCHAR(20) NOT NULL DEFAULT 'copë',
      quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      min_stock NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
      purchase_price NUMERIC(14,2) CHECK (purchase_price >= 0),
      sale_price NUMERIC(14,2) CHECK (sale_price >= 0),
      location VARCHAR(80),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // LOCATIONS — katet / dhomat / zyrat / zonat e magazinës
  await q(`
    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      type VARCHAR(10) NOT NULL DEFAULT 'dhome'
        CHECK (type IN ('kat', 'dhome', 'zyre', 'zone', 'tjeter')),
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // STOCK_LEVELS — stoku i çdo produkti në çdo lokacion
  await q(`
    CREATE TABLE IF NOT EXISTS stock_levels (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (product_id, location_id)
    )
  `);

  // MOVEMENTS
  await q(`
    CREATE TABLE IF NOT EXISTS movements (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out', 'transfer')),
      quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
      from_location VARCHAR(80),
      to_location VARCHAR(80),
      note TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Kolonat e reja te movements — lidhja me lokacionet (migrim i sigurt, idempotent)
  await q(`
    ALTER TABLE movements
    ADD COLUMN IF NOT EXISTS from_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL
  `);
  await q(`
    ALTER TABLE movements
    ADD COLUMN IF NOT EXISTS to_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL
  `);

  // NOTIFICATIONS
  await q(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // INDEXES
  await q(`CREATE INDEX IF NOT EXISTS idx_products_name ON products (LOWER(name))`);
  await q(`CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_products_lowstock ON products (quantity, min_stock)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_movements_product ON movements (product_id)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_movements_date ON movements (created_at)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_movements_type ON movements (type)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_movements_from_loc ON movements (from_location_id)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_movements_to_loc ON movements (to_location_id)`);
  await q(`CREATE INDEX IF NOT EXISTS idx_stock_levels_location ON stock_levels (location_id)`);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications (is_read)
    WHERE is_read = FALSE
  `);

  // FUNCTION për updated_at
  await q(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  // TRIGGERS
  await q(`DROP TRIGGER IF EXISTS trg_products_updated ON products`);
  await q(`
    CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at()
  `);

  await q(`DROP TRIGGER IF EXISTS trg_stock_levels_updated ON stock_levels`);
  await q(`
    CREATE TRIGGER trg_stock_levels_updated
    BEFORE UPDATE ON stock_levels
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at()
  `);

  // VIEW për stokun e ulët
  await q(`
    CREATE OR REPLACE VIEW v_low_stock AS
    SELECT
      p.*,
      c.name AS category_name
    FROM products p
    LEFT JOIN categories c
      ON c.id = p.category_id
    WHERE p.quantity <= p.min_stock
  `);

  // VIEW: gjendja aktive e stokut për çdo lokacion
  await q(`
    CREATE OR REPLACE VIEW v_location_stock AS
    SELECT
      l.id   AS location_id,
      l.name AS location_name,
      l.type AS location_type,
      l.is_active,
      p.id   AS product_id,
      p.code,
      p.name AS product_name,
      p.unit,
      c.name AS category_name,
      sl.quantity,
      ROUND(sl.quantity * COALESCE(p.purchase_price, 0), 2) AS stock_value
    FROM stock_levels sl
    JOIN locations l ON l.id = sl.location_id
    JOIN products p ON p.id = sl.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE sl.quantity > 0
  `);

  // Lokacioni bazë — sigurohu që ekziston gjithmonë
  await q(`
    INSERT INTO locations (name, type, description)
    VALUES ('Magazina kryesore', 'zone', 'Lokacioni bazë i krijuar automatikisht')
    ON CONFLICT (name) DO NOTHING
  `);

  // ------------------------------------------------------------------
  // MIGRIM NJË-HERËSH: shpërnda stokun ekzistues të produkteve nëpër
  // lokacione. Ekzekutohet vetëm nëse stock_levels është bosh dhe ka
  // produkte me sasi — pra vetëm në kalimin e parë pas përditësimit.
  // ------------------------------------------------------------------
  const { rows: [{ n: stockRows }] } = await q("SELECT COUNT(*)::int AS n FROM stock_levels");
  const { rows: [{ n: productsWithQty }] } = await q("SELECT COUNT(*)::int AS n FROM products WHERE quantity > 0");

  if (stockRows === 0 && productsWithQty > 0) {
    // 1) krijo lokacione nga vendndodhjet tekstuale ekzistuese të produkteve
    await q(`
      INSERT INTO locations (name, type, description)
      SELECT DISTINCT TRIM(location), 'tjeter', 'Krijuar automatikisht nga vendndodhja e produktit'
      FROM products
      WHERE location IS NOT NULL AND TRIM(location) <> ''
      ON CONFLICT (name) DO NOTHING
    `);

    // 2) vendos sasinë aktuale të çdo produkti në lokacionin e tij (ose në atë bazë)
    await q(`
      INSERT INTO stock_levels (product_id, location_id, quantity)
      SELECT p.id,
             COALESCE(l.id, (SELECT id FROM locations WHERE name = 'Magazina kryesore')),
             p.quantity
      FROM products p
      LEFT JOIN locations l ON l.name = TRIM(p.location)
      WHERE p.quantity > 0
      ON CONFLICT (product_id, location_id) DO NOTHING
    `);

    console.log("✔ Migrimi: stoku ekzistues u shpërnda nëpër lokacione");
  }

  // Krijo admin nëse nuk ekziston
  const { rows } = await q(
    `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
    ["admin@magazina.al"]
  );

  if (!rows.length) {
    const hash = await bcrypt.hash("Admin123!", 10);

    await q(
      `
      INSERT INTO users
        (name, email, password_hash, role)
      VALUES
        ($1, $2, $3, $4)
      `,
      [
        "Administrator",
        "admin@magazina.al",
        hash,
        "admin"
      ]
    );

    console.log("✔ Admin user u krijua");
  }

  console.log("✔ Databaza u inicializua");
}
