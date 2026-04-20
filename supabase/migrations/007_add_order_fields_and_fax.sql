-- 기존 배포된 DB에 컬럼 추가 (이미 있으면 무시)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE orders ADD COLUMN contact_person VARCHAR(50);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'vessel'
  ) THEN
    ALTER TABLE orders ADD COLUMN vessel VARCHAR(100);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company' AND column_name = 'fax'
  ) THEN
    ALTER TABLE company ADD COLUMN fax VARCHAR(20);
  END IF;
END $$;

-- 기존 뷰 DROP 후 재생성 (컬럼 순서 변경 시 REPLACE 불가)
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
