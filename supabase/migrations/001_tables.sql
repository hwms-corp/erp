-- ============================================================
-- 001_tables.sql
-- ERP 시스템 테이블 생성 — Supabase (PostgreSQL)
-- DB_DESIGN.v1.md 기준
-- ============================================================

CREATE TABLE users (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    auth_uid   UUID UNIQUE NOT NULL,
    name       VARCHAR(50) NOT NULL,
    email      VARCHAR(100),
    role       VARCHAR(20) CHECK (role IS NULL OR role IN ('admin', 'sales', 'purchasing', 'support')),
    dept       VARCHAR(50),
    active     BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company (
    id     SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name   VARCHAR(100) NOT NULL,
    biz_no VARCHAR(20) NOT NULL,
    rep    VARCHAR(50) NOT NULL,
    addr   VARCHAR(200),
    tel    VARCHAR(20),
    fax    VARCHAR(20)
);

CREATE TABLE partners (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code       VARCHAR(20) UNIQUE NOT NULL,
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(20) NOT NULL CHECK (type IN ('sales', 'purchasing', 'both')),
    biz_no     VARCHAR(20) NOT NULL,
    biz_type   VARCHAR(20) NOT NULL CHECK (biz_type IN ('individual', 'corporate')),
    rep        VARCHAR(50) NOT NULL,
    tel        VARCHAR(20),
    addr       VARCHAR(200),
    bank       VARCHAR(50),
    account    VARCHAR(50),
    email      VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no          VARCHAR(30) UNIQUE NOT NULL,
    order_date      DATE NOT NULL,
    partner_id      BIGINT NOT NULL REFERENCES partners(id),
    contact_person  VARCHAR(50),
    vessel          VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'confirmed')),
    delivery_status VARCHAR(20)
                    CHECK (delivery_status IN ('pending', 'completed') OR delivery_status IS NULL),
    delivery_date   DATE,
    created_by      BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (status = 'draft' AND delivery_status IS NULL AND delivery_date IS NULL)
        OR (status = 'confirmed' AND delivery_status = 'pending' AND delivery_date IS NULL)
        OR (status = 'confirmed' AND delivery_status = 'completed' AND delivery_date IS NOT NULL)
    )
);

CREATE TABLE order_items (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    seq        INT NOT NULL,
    name       VARCHAR(100) NOT NULL,
    spec       VARCHAR(200),
    qty        INT NOT NULL CHECK (qty > 0),
    unit       VARCHAR(10) NOT NULL DEFAULT 'EA',
    price      NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    remark     VARCHAR(200),
    UNIQUE (order_id, seq)
);

CREATE TABLE pos (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_no        VARCHAR(30) UNIQUE NOT NULL,
    po_date       DATE NOT NULL,
    partner_id    BIGINT NOT NULL REFERENCES partners(id),
    order_id      BIGINT REFERENCES orders(id),
    required_date DATE,
    payment_terms VARCHAR(20) NOT NULL DEFAULT 'settlement'
                  CHECK (payment_terms IN ('immediate', 'settlement')),
    remark        TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'ordered'
                  CHECK (status IN ('ordered', 'partial_received', 'received')),
    created_by    BIGINT NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE po_items (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_id         BIGINT NOT NULL REFERENCES pos(id) ON DELETE RESTRICT,
    order_item_id BIGINT REFERENCES order_items(id),
    seq           INT NOT NULL,
    name          VARCHAR(100) NOT NULL,
    spec          VARCHAR(200),
    qty           INT NOT NULL CHECK (qty > 0),
    unit          VARCHAR(10) NOT NULL DEFAULT 'EA',
    price         NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    remark        VARCHAR(200),
    received_qty  INT NOT NULL DEFAULT 0 CHECK (received_qty >= 0 AND received_qty <= qty),
    UNIQUE (po_id, seq)
);

CREATE TABLE doc_counters (
    prefix   VARCHAR(3) NOT NULL CHECK (prefix IN ('ORD', 'PUR')),
    doc_date DATE NOT NULL,
    last_seq INT NOT NULL CHECK (last_seq > 0),
    PRIMARY KEY (prefix, doc_date)
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_partners_type ON partners(type);
CREATE INDEX idx_partners_name ON partners(name);

CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_partner ON orders(partner_id);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_status_order_date ON orders(status, order_date DESC);
CREATE INDEX idx_orders_delivery_date ON orders(delivery_status, delivery_date DESC);

CREATE INDEX idx_order_items_order_seq ON order_items(order_id, seq);

CREATE INDEX idx_pos_po_date ON pos(po_date);
CREATE INDEX idx_pos_partner ON pos(partner_id);
CREATE INDEX idx_pos_order ON pos(order_id);
CREATE INDEX idx_pos_created_by ON pos(created_by);
CREATE INDEX idx_pos_status_po_date ON pos(status, po_date DESC);

CREATE INDEX idx_po_items_po_seq ON po_items(po_id, seq);
CREATE INDEX idx_po_items_order_item ON po_items(order_item_id);
