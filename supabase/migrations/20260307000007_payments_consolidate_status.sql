-- Synchronize payments.status and payments.state columns.
-- status (from baseline): pending, paid, failed, refunded, expired
-- state (from additional_tables): pending, processing, completed, failed, expired, refunded
-- This trigger keeps them in sync so consumers can use either column consistently.

CREATE OR REPLACE FUNCTION sync_payment_status_state()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- When status changes, update state to match
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.state := CASE NEW.status
      WHEN 'pending' THEN 'pending'
      WHEN 'paid' THEN 'completed'
      WHEN 'failed' THEN 'failed'
      WHEN 'refunded' THEN 'refunded'
      WHEN 'expired' THEN 'expired'
    END;
  -- When state changes, update status to match
  ELSIF NEW.state IS DISTINCT FROM OLD.state THEN
    NEW.status := CASE NEW.state
      WHEN 'pending' THEN 'pending'
      WHEN 'processing' THEN 'pending'
      WHEN 'completed' THEN 'paid'
      WHEN 'failed' THEN 'failed'
      WHEN 'expired' THEN 'expired'
      WHEN 'refunded' THEN 'refunded'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_payment_status
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION sync_payment_status_state();
