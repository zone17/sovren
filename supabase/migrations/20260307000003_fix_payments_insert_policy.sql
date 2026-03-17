-- Fix: restrict payments INSERT to payer only (not recipient)
-- Todo #763: Prevent fraud where attacker inserts payment record with themselves as recipient
-- Only the payer (or service_role for webhooks/system processes) should be able to create payment records.
--
-- Bug fix: original migration dropped wrong policy name ("payments_insert" instead of
-- "payments_insert_own"). Both names are now dropped to ensure the insecure policy is removed.

DROP POLICY IF EXISTS "payments_insert" ON payments;
DROP POLICY IF EXISTS "payments_insert_own" ON payments;
CREATE POLICY "payments_insert_payer_only" ON payments
  FOR INSERT WITH CHECK (
    payer_id = auth.uid() OR auth.role() = 'service_role'
  );
