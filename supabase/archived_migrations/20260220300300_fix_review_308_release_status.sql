-- Migration: 20260220300300_fix_review_308_release_status.sql
-- #308 (P1): Fix release_status CHECK constraint to include all values used by MarketplaceService
--
-- The original constraint in 20260220100400 only allows:
--   ('pending', 'processing', 'completed', 'failed')
-- But MarketplaceService.completeOrder() also writes 'permanently_failed' (line 438),
-- and the TypeScript types reference 'idle' and 'released'.
--
-- Unified set aligns DB, service, and TypeScript:
--   pending, processing, completed, failed, permanently_failed

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_release_status_check;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_release_status_check
  CHECK (release_status IN ('pending', 'processing', 'completed', 'failed', 'permanently_failed'));

-- DOWN
-- ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_release_status_check;
-- ALTER TABLE service_orders ADD CONSTRAINT service_orders_release_status_check
--   CHECK (release_status IN ('pending', 'processing', 'completed', 'failed'));
