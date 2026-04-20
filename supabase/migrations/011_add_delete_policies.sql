-- 삭제 권한 RLS 정책 추가 (기존 004_rls.sql에 DELETE 정책이 누락됨)

-- partners
CREATE POLICY partners_delete ON partners
FOR DELETE TO authenticated
USING (current_user_role() IN ('admin', 'support'));

-- orders
CREATE POLICY orders_delete ON orders
FOR DELETE TO authenticated
USING (current_user_role() IN ('admin', 'sales', 'support'));

-- order_items
CREATE POLICY order_items_delete ON order_items
FOR DELETE TO authenticated
USING (current_user_role() IN ('admin', 'sales', 'support'));

-- pos
CREATE POLICY pos_delete ON pos
FOR DELETE TO authenticated
USING (current_user_role() IN ('admin', 'purchasing', 'support'));

-- po_items
CREATE POLICY po_items_delete ON po_items
FOR DELETE TO authenticated
USING (current_user_role() IN ('admin', 'purchasing', 'support'));
