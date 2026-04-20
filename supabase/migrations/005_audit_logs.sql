-- ============================================================
-- 005_audit_logs.sql
-- 감사 로그 — DB_DESIGN.v1.audit_logs.md 기준
-- ============================================================

CREATE TABLE public.audit_logs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_category  TEXT NOT NULL CHECK (event_category IN ('row', 'app')),
    schema_name     TEXT DEFAULT 'public',
    table_name      TEXT,
    record_id       TEXT,
    action          TEXT NOT NULL,
    old_data        JSONB,
    new_data        JSONB,
    changed_fields  TEXT[],
    metadata        JSONB,
    actor_id        BIGINT,
    actor_type      TEXT NOT NULL DEFAULT 'user'
                    CHECK (actor_type IN ('user', 'system', 'batch')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (
        (event_category = 'row'
         AND action IN ('INSERT', 'UPDATE', 'DELETE')
         AND table_name IS NOT NULL
         AND record_id IS NOT NULL)
        OR
        (event_category = 'app'
         AND table_name IS NULL
         AND record_id IS NULL)
    )
);

CREATE INDEX idx_audit_logs_created_at
    ON public.audit_logs (created_at DESC);

CREATE INDEX idx_audit_logs_actor
    ON public.audit_logs (actor_id, created_at DESC);

CREATE INDEX idx_audit_logs_table_record
    ON public.audit_logs (table_name, record_id, created_at DESC);

-- private schema for internal functions
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.log_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_old JSONB := NULL;
    v_new JSONB := NULL;
    v_changed TEXT[] := NULL;
    v_record_id TEXT;
    v_actor BIGINT;
    SKIP_FIELDS CONSTANT TEXT[] := ARRAY['updated_at'];
BEGIN
    SELECT id INTO v_actor
      FROM public.users
     WHERE auth_uid = auth.uid();

    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        v_record_id := OLD.id::TEXT;

    ELSIF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;

    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_record_id := NEW.id::TEXT;

        SELECT array_agg(n.key) INTO v_changed
          FROM jsonb_each(v_new) AS n(key, value)
         WHERE v_old -> n.key IS DISTINCT FROM n.value
           AND n.key <> ALL(SKIP_FIELDS);

        IF v_changed IS NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    INSERT INTO public.audit_logs (
        event_category, schema_name, table_name, record_id,
        action, old_data, new_data, changed_fields,
        actor_id, actor_type
    ) VALUES (
        'row', TG_TABLE_SCHEMA, TG_TABLE_NAME, v_record_id,
        TG_OP, v_old, v_new, v_changed,
        v_actor,
        CASE WHEN v_actor IS NOT NULL THEN 'user' ELSE 'system' END
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Audit triggers on core business tables
CREATE TRIGGER trg_audit_orders
    AFTER INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION private.log_row_change();

CREATE TRIGGER trg_audit_order_items
    AFTER INSERT OR UPDATE OR DELETE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION private.log_row_change();

CREATE TRIGGER trg_audit_pos
    AFTER INSERT OR UPDATE OR DELETE ON public.pos
    FOR EACH ROW EXECUTE FUNCTION private.log_row_change();

CREATE TRIGGER trg_audit_po_items
    AFTER INSERT OR UPDATE OR DELETE ON public.po_items
    FOR EACH ROW EXECUTE FUNCTION private.log_row_change();

-- RLS + permissions for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

CREATE POLICY audit_logs_select_admin ON public.audit_logs
    FOR SELECT TO authenticated
    USING (current_user_role() = 'admin');
