-- ============================================================
-- 015_allow_negative_price.sql
-- 할인(-) 금액 입력을 허용하기 위해 price >= 0 CHECK 제약 제거
-- 대상: order_items, po_items
-- ============================================================

-- 1. order_items.price >= 0 제약 제거
ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS order_items_price_check;

-- 2. po_items.price >= 0 제약 제거
ALTER TABLE po_items
    DROP CONSTRAINT IF EXISTS po_items_price_check;
