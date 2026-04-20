-- ============================================================
-- 004_rls.sql
-- Row Level Security — DB_DESIGN.v1.md 기준
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;

-- users -------------------------------------------------------

CREATE POLICY users_select_self ON users
FOR SELECT TO authenticated
USING (auth_uid = auth.uid() OR current_user_role() = 'admin');

CREATE POLICY users_update_admin ON users
FOR UPDATE TO authenticated
USING (current_user_role() = 'admin')
WITH CHECK (current_user_role() = 'admin');

-- company -----------------------------------------------------

CREATE POLICY company_select_all ON company
FOR SELECT TO authenticated
USING (true);

CREATE POLICY company_update_admin_support ON company
FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'support'))
WITH CHECK (current_user_role() IN ('admin', 'support'));

-- partners ----------------------------------------------------

CREATE POLICY partners_select ON partners
FOR SELECT TO authenticated USING (true);

CREATE POLICY partners_insert ON partners
FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'support'));

CREATE POLICY partners_update ON partners
FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'support'))
WITH CHECK (current_user_role() IN ('admin', 'support'));

-- orders / order_items ----------------------------------------

CREATE POLICY orders_select ON orders
FOR SELECT TO authenticated USING (true);

CREATE POLICY orders_insert ON orders
FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'sales', 'support'));

CREATE POLICY orders_update ON orders
FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'sales', 'support'))
WITH CHECK (current_user_role() IN ('admin', 'sales', 'support'));

CREATE POLICY order_items_select ON order_items
FOR SELECT TO authenticated USING (true);

CREATE POLICY order_items_insert ON order_items
FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'sales', 'support'));

CREATE POLICY order_items_update ON order_items
FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'sales', 'support'))
WITH CHECK (current_user_role() IN ('admin', 'sales', 'support'));

-- pos / po_items ----------------------------------------------

CREATE POLICY pos_select ON pos
FOR SELECT TO authenticated USING (true);

CREATE POLICY pos_insert ON pos
FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'purchasing', 'support'));

CREATE POLICY pos_update ON pos
FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'purchasing', 'support'))
WITH CHECK (current_user_role() IN ('admin', 'purchasing', 'support'));

CREATE POLICY po_items_select ON po_items
FOR SELECT TO authenticated USING (true);

CREATE POLICY po_items_insert ON po_items
FOR INSERT TO authenticated
WITH CHECK (current_user_role() IN ('admin', 'purchasing', 'support'));

CREATE POLICY po_items_update ON po_items
FOR UPDATE TO authenticated
USING (current_user_role() IN ('admin', 'purchasing', 'support'))
WITH CHECK (current_user_role() IN ('admin', 'purchasing', 'support'));
