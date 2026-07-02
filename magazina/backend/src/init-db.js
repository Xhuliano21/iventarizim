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
      quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
      min_stock NUMERIC(14,3) NOT NULL DEFAULT 0,
      purchase_price NUMERIC(14,2),
      sale_price NUMERIC(14,2),
      location VARCHAR(80),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // MOVEMENTS
  await q(`
    CREATE TABLE IF NOT EXISTS movements (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL CHECK (type IN ('in','out','transfer')),
      quantity NUMERIC(14,3) NOT NULL,
      from_location VARCHAR(80),
      to_location VARCHAR(80),
      note TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
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

  // Krijo admin nëse nuk ekziston
  const { rows } = await q(
    `SELECT id FROM users WHERE email = $1`,
    ["admin@magazina.al"]
  );

  if (!rows.length) {
    const hash = await bcrypt.hash("Admin123!", 10);

    await q(
      `INSERT INTO users(name,email,password_hash,role)
       VALUES ($1,$2,$3,$4)`,
      ["Administrator", "admin@magazina.al", hash, "admin"]
    );

    console.log("✔ Admin user u krijua");
  }
}
