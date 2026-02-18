-- Revert NOSTR pubkey format CHECK constraints added in 20260218000000_add_creator_id_format_checks.sql

ALTER TABLE platform_metrics_history DROP CONSTRAINT IF EXISTS chk_metrics_creator_id_format;
ALTER TABLE inbox_messages DROP CONSTRAINT IF EXISTS chk_inbox_creator_id_format;
ALTER TABLE repurposed_content DROP CONSTRAINT IF EXISTS chk_repurposed_creator_id_format;
ALTER TABLE cross_posts DROP CONSTRAINT IF EXISTS chk_cross_posts_creator_id_format;
