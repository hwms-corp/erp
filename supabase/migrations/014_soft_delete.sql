-- ============================================================
-- 014_soft_delete.sql
-- Hard Delete → Soft Delete 전환
-- 설계 원칙: Phase 1 기준 물리 삭제를 허용하지 않음
-- ============================================================

-- 1. deleted_at 컬럼 추가
ALTER TABLE partners ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE pos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE po_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. 기존 DELETE RLS 정책 제거
DROP POLICY IF EXISTS partners_delete ON partners;
DROP POLICY IF EXISTS orders_delete ON orders;
DROP POLICY IF EXISTS order_items_delete ON order_items;
DROP POLICY IF EXISTS pos_delete ON pos;
DROP POLICY IF EXISTS po_items_delete ON po_items;

-- 3. View 재생성 (deleted_at IS NULL 조건 추가)

DROP VIEW IF EXISTS v_partner_delivery_summary;
DROP VIEW IF EXISTS v_pos_with_detail;
DROP VIEW IF EXISTS v_orders_with_partner;

CREATE VIEW v_orders_with_partner
WITH (security_invoker = true) AS
SELECT
    o.id,
    o.doc_no,
    o.order_date,
    o.partner_id,
    o.contact_person,
    o.vessel,
    o.status,
    o.delivery_status,
    o.delivery_date,
    o.origin_order_id,
    o.created_by,
    o.created_at,
    o.updated_at,
    o.deleted_at,
    p.code AS partner_code,
    p.name AS partner_name,
    p.biz_no AS partner_biz_no,
    p.rep AS partner_rep,
    p.addr AS partner_addr,
    p.tel AS partner_tel,
    COALESCE(SUM(oi.qty * oi.price), 0) AS supply_amount,
    COALESCE(SUM(oi.qty * oi.price), 0) * 0.1 AS tax_amount,
    COALESCE(SUM(oi.qty * oi.price), 0) * 1.1 AS total_amount
FROM orders o
JOIN partners p ON o.partner_id = p.id
LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
WHERE o.deleted_at IS NULL
GROUP BY o.id, p.code, p.name, p.biz_no, p.rep, p.addr, p.tel;

CREATE VIEW v_pos_with_detail
WITH (security_invoker = true) AS
SELECT
    po.id,
    po.doc_no,
    po.po_date,
    po.partner_id,
    po.order_id,
    po.required_date,
    po.payment_terms,
    po.remark,
    po.status,
    po.created_by,
    po.created_at,
    po.updated_at,
    po.deleted_at,
    p.code AS partner_code,
    p.name AS partner_name,
    p.biz_no AS partner_biz_no,
    p.rep AS partner_rep,
    p.addr AS partner_addr,
    ord.doc_no AS order_doc_no,
    COALESCE(SUM(pi.qty * pi.price), 0) AS po_amount,
    COALESCE(SUM(pi.received_qty * pi.price), 0) AS received_amount
FROM pos po
JOIN partners p ON po.partner_id = p.id
LEFT JOIN orders ord ON po.order_id = ord.id
LEFT JOIN po_items pi ON pi.po_id = po.id AND pi.deleted_at IS NULL
WHERE po.deleted_at IS NULL
GROUP BY po.id, p.code, p.name, p.biz_no, p.rep, p.addr, ord.doc_no;

CREATE VIEW v_partner_delivery_summary
WITH (security_invoker = true) AS
SELECT
    p.id AS partner_id,
    p.code AS partner_code,
    p.name AS partner_name,
    DATE_TRUNC('month', o.delivery_date)::date AS month,
    COUNT(DISTINCT o.id) AS delivery_count,
    COALESCE(SUM(oi.qty * oi.price), 0) AS supply_amount,
    COALESCE(SUM(oi.qty * oi.price), 0) * 0.1 AS tax_amount,
    COALESCE(SUM(oi.qty * oi.price), 0) * 1.1 AS total_amount
FROM partners p
JOIN orders o ON o.partner_id = p.id
JOIN order_items oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
WHERE o.delivery_status = 'completed'
  AND o.delivery_date IS NOT NULL
  AND o.deleted_at IS NULL
  AND p.deleted_at IS NULL
GROUP BY p.id, p.code, p.name, DATE_TRUNC('month', o.delivery_date);
