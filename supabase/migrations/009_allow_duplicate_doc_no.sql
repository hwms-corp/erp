-- doc_no UNIQUE 제약 제거: 부분 수주확정 시 원본과 동일한 견적번호 사용 가능하도록
-- origin_order_id로 원본/확정 건을 구분

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_doc_no_key;
