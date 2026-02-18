-- Add NOSTR pubkey format CHECK constraints (64 hex chars) to Epic 009 tables
-- that were missing this validation from 20260216200600_add_foreign_keys.sql

ALTER TABLE cross_posts
  ADD CONSTRAINT chk_cross_posts_creator_id_format
  CHECK (LENGTH(creator_id) = 64 AND creator_id ~ '^[0-9a-f]+$');

ALTER TABLE repurposed_content
  ADD CONSTRAINT chk_repurposed_creator_id_format
  CHECK (LENGTH(creator_id) = 64 AND creator_id ~ '^[0-9a-f]+$');

ALTER TABLE inbox_messages
  ADD CONSTRAINT chk_inbox_creator_id_format
  CHECK (LENGTH(creator_id) = 64 AND creator_id ~ '^[0-9a-f]+$');

ALTER TABLE platform_metrics_history
  ADD CONSTRAINT chk_metrics_creator_id_format
  CHECK (LENGTH(creator_id) = 64 AND creator_id ~ '^[0-9a-f]+$');
