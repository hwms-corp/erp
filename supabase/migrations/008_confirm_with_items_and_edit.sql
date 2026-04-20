-- 수주확정 시 별도 레코드 생성을 위한 origin_order_id 컬럼 추가

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'origin_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN origin_order_id BIGINT REFERENCES orders(id);
  END IF;
END $$;

-- 뷰 재생성 (origin_order_id 포함)
DROP VIEW IF EXISTS v_orders_with_partner;
CREATE VIEW v_orders_with_partner AS
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
    p.code   AS partner_code,
    p.name   AS partner_name,
    p.biz_no AS partner_biz_no,
    p.rep    AS partner_rep,
    p.addr   AS partner_addr,
    p.tel    AS partner_tel,
    COALESCE(s.supply_amount, 0) AS supply_amount,
    COALESCE(s.tax_amount,    0) AS tax_amount,
    COALESCE(s.total_amount,  0) AS total_amount
FROM orders o
JOIN partners p ON p.id = o.partner_id
LEFT JOIN LATERAL (
    SELECT
        SUM(oi.qty * oi.price)                      AS supply_amount,
        FLOOR(SUM(oi.qty * oi.price) * 0.1)         AS tax_amount,
        SUM(oi.qty * oi.price) + FLOOR(SUM(oi.qty * oi.price) * 0.1) AS total_amount
    FROM order_items oi WHERE oi.order_id = o.id
) s ON true;
