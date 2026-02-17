-- Rollback: 20260216200300_epic009_inbox_messages.sql
-- Drops the inbox_messages table and all associated objects

BEGIN;

DROP POLICY IF EXISTS "Creators can only access own inbox" ON inbox_messages;
DROP INDEX IF EXISTS idx_inbox_creator;
DROP INDEX IF EXISTS idx_inbox_creator_unread;
DROP INDEX IF EXISTS idx_inbox_creator_platform;
DROP INDEX IF EXISTS idx_inbox_fetched;
DROP TABLE IF EXISTS inbox_messages CASCADE;

COMMIT;
