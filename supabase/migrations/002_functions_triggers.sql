-- ============================================================
-- 002_functions_triggers.sql
-- 함수 및 트리거 — DB_DESIGN.v1.md 기준
-- ============================================================

-- 8-1. 문서번호 생성 -------------------------------------------

CREATE OR REPLACE FUNCTION gen_doc_no(p_prefix VARCHAR(3))
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    next_seq INT;
    today_val DATE := timezone('Asia/Seoul', now())::date;
BEGIN
    IF p_prefix NOT IN ('ORD', 'PUR') THEN
        RAISE EXCEPTION 'Invalid prefix: %', p_prefix;
    END IF;

    INSERT INTO doc_counters(prefix, doc_date, last_seq)
    VALUES (p_prefix, today_val, 1)
    ON CONFLICT (prefix, doc_date)
    DO UPDATE SET last_seq = doc_counters.last_seq + 1
    RETURNING last_seq INTO next_seq;

    RETURN p_prefix || TO_CHAR(today_val, 'YYYYMMDD') || '-' || LPAD(next_seq::TEXT, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION set_order_doc_no()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.doc_no IS NULL OR BTRIM(NEW.doc_no) = '' THEN
        NEW.doc_no := gen_doc_no('ORD');
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_po_doc_no()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.doc_no IS NULL OR BTRIM(NEW.doc_no) = '' THEN
        NEW.doc_no := gen_doc_no('PUR');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_doc_no
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION set_order_doc_no();

CREATE TRIGGER trg_pos_doc_no
BEFORE INSERT ON pos
FOR EACH ROW EXECUTE FUNCTION set_po_doc_no();

-- 8-2. 로그인 시 public.users ensure ---------------------------

CREATE OR REPLACE FUNCTION ensure_public_user()
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    auth_row auth.users%ROWTYPE;
    result_row public.users%ROWTYPE;
BEGIN
    SELECT *
    INTO auth_row
    FROM auth.users
    WHERE id = auth.uid();

    IF auth_row.id IS NULL THEN
        RAISE EXCEPTION 'authenticated user not found in auth.users';
    END IF;

    INSERT INTO public.users (auth_uid, email, name, role, active)
    VALUES (
        auth_row.id,
        auth_row.email,
        COALESCE(auth_row.raw_user_meta_data ->> 'name', split_part(auth_row.email, '@', 1)),
        NULL,
        false
    )
    ON CONFLICT (auth_uid) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name)
    RETURNING * INTO result_row;

    RETURN result_row;
END;
$$;

-- 8-3. 관리자 재동기화 함수 ------------------------------------

CREATE OR REPLACE FUNCTION sync_public_user_from_auth(target_auth_uid UUID)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    auth_row auth.users%ROWTYPE;
    result_row public.users%ROWTYPE;
BEGIN
    SELECT *
    INTO auth_row
    FROM auth.users
    WHERE id = target_auth_uid;

    IF auth_row.id IS NULL THEN
        RAISE EXCEPTION 'target auth user not found: %', target_auth_uid;
    END IF;

    INSERT INTO public.users (auth_uid, email, name, role, active)
    VALUES (
        auth_row.id,
        auth_row.email,
        COALESCE(auth_row.raw_user_meta_data ->> 'name', split_part(auth_row.email, '@', 1)),
        NULL,
        false
    )
    ON CONFLICT (auth_uid) DO UPDATE
    SET email = EXCLUDED.email,
        name = COALESCE(public.users.name, EXCLUDED.name)
    RETURNING * INTO result_row;

    RETURN result_row;
END;
$$;

-- 8-4. 현재 로그인 유저 역할 조회 ------------------------------

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.users WHERE auth_uid = auth.uid() AND active = true
$$;

-- 8-5. 거래처 타입 검증 ----------------------------------------

CREATE OR REPLACE FUNCTION validate_order_partner_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    partner_type VARCHAR(20);
BEGIN
    SELECT type INTO partner_type FROM partners WHERE id = NEW.partner_id;

    IF partner_type NOT IN ('sales', 'both') THEN
        RAISE EXCEPTION 'orders.partner_id must reference sales or both partner type';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_order_partner_type
BEFORE INSERT OR UPDATE OF partner_id ON orders
FOR EACH ROW EXECUTE FUNCTION validate_order_partner_type();

CREATE OR REPLACE FUNCTION validate_po_partner_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    partner_type VARCHAR(20);
BEGIN
    SELECT type INTO partner_type FROM partners WHERE id = NEW.partner_id;

    IF partner_type NOT IN ('purchasing', 'both') THEN
        RAISE EXCEPTION 'pos.partner_id must reference purchasing or both partner type';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_po_partner_type
BEFORE INSERT OR UPDATE OF partner_id ON pos
FOR EACH ROW EXECUTE FUNCTION validate_po_partner_type();

-- 8-6. 주문 납품 상태 검증 -------------------------------------

CREATE OR REPLACE FUNCTION validate_order_delivery_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'confirmed' AND NEW.delivery_status IS NULL THEN
        RAISE EXCEPTION 'confirmed orders require delivery_status';
    END IF;

    IF NEW.delivery_status IS NULL AND NEW.delivery_date IS NOT NULL THEN
        RAISE EXCEPTION 'delivery_status is NULL but delivery_date is set';
    END IF;

    IF NEW.delivery_status = 'completed' AND NEW.delivery_date IS NULL THEN
        RAISE EXCEPTION 'delivery_date is required when delivery_status is completed';
    END IF;

    IF NEW.delivery_status IS NOT NULL AND NEW.status <> 'confirmed' THEN
        RAISE EXCEPTION 'delivery state requires orders.status = confirmed';
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.delivery_status = 'completed'
       AND NEW.delivery_status = 'pending' THEN
        RAISE EXCEPTION 'delivery_status cannot transition from completed back to pending';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_order_delivery_state
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION validate_order_delivery_state();

-- 8-7. 연결 발주 검증 ------------------------------------------

CREATE OR REPLACE FUNCTION validate_po_order_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    order_status VARCHAR(20);
    has_po_items BOOLEAN;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN
        SELECT EXISTS (SELECT 1 FROM po_items WHERE po_id = NEW.id)
        INTO has_po_items;

        IF has_po_items THEN
            RAISE EXCEPTION 'cannot change pos.order_id after po_items exist';
        END IF;
    END IF;

    IF NEW.order_id IS NOT NULL THEN
        SELECT status INTO order_status FROM orders WHERE id = NEW.order_id;

        IF order_status IS DISTINCT FROM 'confirmed' THEN
            RAISE EXCEPTION 'linked PO requires confirmed order';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_po_order_link
BEFORE INSERT OR UPDATE OF order_id ON pos
FOR EACH ROW EXECUTE FUNCTION validate_po_order_link();

-- 8-8. 발주 품목 ↔ 주문 품목 연결 검증 -------------------------

CREATE OR REPLACE FUNCTION validate_po_item_order_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    linked_order_id BIGINT;
    po_order_id BIGINT;
BEGIN
    IF NEW.order_item_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT order_id INTO linked_order_id
    FROM order_items
    WHERE id = NEW.order_item_id;

    SELECT order_id INTO po_order_id
    FROM pos
    WHERE id = NEW.po_id;

    IF po_order_id IS NULL THEN
        RAISE EXCEPTION 'order_item_id requires linked order_id on pos';
    END IF;

    IF linked_order_id <> po_order_id THEN
        RAISE EXCEPTION 'po_items.order_item_id must belong to pos.order_id';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_po_item_order_link
BEFORE INSERT OR UPDATE OF order_item_id, po_id ON po_items
FOR EACH ROW EXECUTE FUNCTION validate_po_item_order_link();

-- 8-9. 발주 상태 자동 갱신 -------------------------------------

CREATE OR REPLACE FUNCTION protect_pos_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND COALESCE(NEW.status, 'ordered') <> 'ordered' THEN
        RAISE EXCEPTION 'pos.status must start as ordered';
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.status IS DISTINCT FROM OLD.status
       AND current_setting('app.allow_pos_status_refresh', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'pos.status can only be changed by refresh_po_status()';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_po_status(target_po_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    has_items BOOLEAN;
    all_done BOOLEAN;
    any_done BOOLEAN;
BEGIN
    PERFORM 1 FROM pos WHERE id = target_po_id FOR UPDATE;

    SELECT EXISTS (SELECT 1 FROM po_items WHERE po_id = target_po_id)
    INTO has_items;

    SELECT
        COALESCE(BOOL_AND(received_qty >= qty), false),
        COALESCE(BOOL_OR(received_qty > 0), false)
    INTO all_done, any_done
    FROM po_items
    WHERE po_id = target_po_id;

    PERFORM set_config('app.allow_pos_status_refresh', 'on', true);

    UPDATE pos
    SET status = CASE
        WHEN NOT has_items THEN 'ordered'
        WHEN all_done THEN 'received'
        WHEN any_done THEN 'partial_received'
        ELSE 'ordered'
    END,
    updated_at = now()
    WHERE id = target_po_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_po_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM refresh_po_status(OLD.po_id);
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.po_id IS DISTINCT FROM OLD.po_id THEN
        PERFORM refresh_po_status(OLD.po_id);
    END IF;

    PERFORM refresh_po_status(NEW.po_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_pos_status
BEFORE INSERT OR UPDATE ON pos
FOR EACH ROW EXECUTE FUNCTION protect_pos_status();

CREATE TRIGGER trg_po_item_status_change
AFTER INSERT OR UPDATE OF po_id, qty, received_qty OR DELETE ON po_items
FOR EACH ROW EXECUTE FUNCTION update_po_status();

-- 8-10. updated_at 자동 갱신 -----------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_partners_updated_at BEFORE UPDATE ON partners
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pos_updated_at BEFORE UPDATE ON pos
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8-11. 누락 프로필 점검 / 재동기화 운영 -----------------------

CREATE OR REPLACE VIEW v_missing_public_users AS
SELECT
    au.id AS auth_uid,
    au.email
FROM auth.users au
LEFT JOIN public.users pu ON pu.auth_uid = au.id
WHERE pu.auth_uid IS NULL;

CREATE OR REPLACE FUNCTION reconcile_public_user(target_auth_uid UUID)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result_row public.users%ROWTYPE;
BEGIN
    result_row := sync_public_user_from_auth(target_auth_uid);
    RETURN result_row;
END;
$$;
