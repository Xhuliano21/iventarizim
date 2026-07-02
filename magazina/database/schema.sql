-- ============================================================
--  MAGAZINA — Skema e databazës (PostgreSQL 14+)
--  Sistemi i menaxhimit të magazinës dhe inventarit
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. USERS — Përdoruesit dhe rolet
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120)  NOT NULL,
    email         VARCHAR(160)  NOT NULL UNIQUE,
    password_hash VARCHAR(200)  NOT NULL,
    role          VARCHAR(10)   NOT NULL DEFAULT 'user'
                  CHECK (role IN ('admin', 'user')),
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. CATEGORIES — Kategoritë e produkteve
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. PRODUCTS — Produktet
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id             SERIAL PRIMARY KEY,
    code           VARCHAR(40)   NOT NULL UNIQUE,       -- Kodi unik i produktit
    name           VARCHAR(200)  NOT NULL,              -- Emërtimi
    category_id    INTEGER       REFERENCES categories(id) ON DELETE SET NULL,
    description    TEXT,                                -- Përshkrimi
    unit           VARCHAR(20)   NOT NULL DEFAULT 'copë', -- Njësia matëse
    quantity       NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_stock      NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    purchase_price NUMERIC(14,2) CHECK (purchase_price >= 0),
    sale_price     NUMERIC(14,2) CHECK (sale_price >= 0),
    location       VARCHAR(80),                         -- Vendndodhja në magazinë (p.sh. A-01-3)
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_name     ON products (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_lowstock ON products (quantity, min_stock);

-- ------------------------------------------------------------
-- 4. MOVEMENTS — Lëvizjet e inventarit (hyrje / dalje / transferime)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movements (
    id            SERIAL PRIMARY KEY,
    product_id    INTEGER       NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type          VARCHAR(10)   NOT NULL CHECK (type IN ('in', 'out', 'transfer')),
    quantity      NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    from_location VARCHAR(80),                       -- për dalje / transferime
    to_location   VARCHAR(80),                       -- për hyrje / transferime
    note          TEXT,                              -- komente
    user_id       INTEGER       REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON movements (product_id);
CREATE INDEX IF NOT EXISTS idx_movements_date    ON movements (created_at);
CREATE INDEX IF NOT EXISTS idx_movements_type    ON movements (type);

-- ------------------------------------------------------------
-- 5. NOTIFICATIONS — Njoftimet për stok të ulët
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id         SERIAL PRIMARY KEY,
    product_id INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    message    TEXT        NOT NULL,
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (is_read) WHERE is_read = FALSE;

-- ------------------------------------------------------------
-- Trigger: përditëso updated_at te produktet
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- VIEW: Produktet me stok të ulët (për raporte dhe dashboard)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_low_stock AS
SELECT p.*, c.name AS category_name
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.quantity <= p.min_stock;

COMMIT;
