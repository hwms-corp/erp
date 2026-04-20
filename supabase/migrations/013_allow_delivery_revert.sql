-- 납품완료 → 납품대기 되돌리기 허용
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

    RETURN NEW;
END;
$$;
