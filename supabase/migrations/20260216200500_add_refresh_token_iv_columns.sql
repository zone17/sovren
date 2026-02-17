-- Add separate IV and auth tag columns for refresh token encryption
-- P2-002: Each encrypted token needs its own IV and auth tag for AES-256-GCM
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS refresh_token_iv BYTEA,
  ADD COLUMN IF NOT EXISTS refresh_token_auth_tag BYTEA;

-- Down: ALTER TABLE platform_connections DROP COLUMN IF EXISTS refresh_token_iv, DROP COLUMN IF EXISTS refresh_token_auth_tag;
