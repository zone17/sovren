-- Fix: restrict payments INSERT to payer only (not recipient)
-- Todo #763: Prevent fraud where attacker inserts payment record with themselves as recipient
-- Only the payer (or service_role for webhooks/system processes) should be able to create payment records.

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments
  FOR INSERT WITH CHECK (
    payer_id = auth.uid() OR auth.role() = 'service_role'
  );
