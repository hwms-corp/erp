-- ============================================================
-- 003_views.sql
-- View Tables — DB_DESIGN.v1.md 기준
-- ============================================================

CREATE OR REPLACE VIEW v_orders_with_partner
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
    o.created_by,
    o.created_at,
    o.updated_at,
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
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, p.code, p.name, p.biz_no, p.rep, p.addr, p.tel;

CREATE OR REPLACE VIEW v_pos_with_detail
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
LEFT JOIN po_items pi ON pi.po_id = po.id
GROUP BY po.id, p.code, p.name, p.biz_no, p.rep, p.addr, ord.doc_no;

CREATE OR REPLACE VIEW v_partner_delivery_summary
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
JOIN order_items oi ON oi.order_id = o.id
WHERE o.delivery_status = 'completed'
  AND o.delivery_date IS NOT NULL
GROUP BY p.id, p.code, p.name, DATE_TRUNC('month', o.delivery_date);
