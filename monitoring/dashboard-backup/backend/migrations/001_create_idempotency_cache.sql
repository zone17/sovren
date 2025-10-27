-- Migration: Create idempotency cache table
-- Description: Store idempotency keys with request/response pairs for payment endpoints
-- Author: Backend API Builder
-- Date: 2025-10-25
-- Story: PAY-010

-- UP MIGRATION
-- ============================================================================

-- Create idempotency cache table
CREATE TABLE IF NOT EXISTS idempotency_cache (
  -- Primary key: UUID v4 idempotency key provided by client
  idempotency_key UUID PRIMARY KEY,

  -- Request hash (SHA-256) to detect request body changes
  request_hash VARCHAR(64) NOT NULL,

  -- HTTP method (POST, PUT, etc.)
  http_method VARCHAR(10) NOT NULL,

  -- Endpoint path
  endpoint_path VARCHAR(255) NOT NULL,

  -- Cached response data (JSON)
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  response_headers JSONB DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,

  -- Audit trail
  client_ip VARCHAR(45),
  user_agent TEXT,

  -- Constraints
  CONSTRAINT valid_response_status CHECK (response_status >= 100 AND response_status < 600),
  CONSTRAINT valid_http_method CHECK (http_method IN ('POST', 'PUT', 'PATCH', 'DELETE')),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX idx_idempotency_cache_expires_at ON idempotency_cache(expires_at);
CREATE INDEX idx_idempotency_cache_endpoint ON idempotency_cache(endpoint_path, http_method);
CREATE INDEX idx_idempotency_cache_created_at ON idempotency_cache(created_at DESC);

-- Create composite index for cleanup queries
CREATE INDEX idx_idempotency_cache_cleanup ON idempotency_cache(expires_at, created_at);

-- Add comment to table
COMMENT ON TABLE idempotency_cache IS 'Stores idempotency keys for payment API endpoints to prevent duplicate transactions';
COMMENT ON COLUMN idempotency_cache.idempotency_key IS 'Client-provided UUID v4 idempotency key from Idempotency-Key header';
COMMENT ON COLUMN idempotency_cache.request_hash IS 'SHA-256 hash of request body to detect changes';
COMMENT ON COLUMN idempotency_cache.response_body IS 'Cached JSON response body to return for duplicate requests';
COMMENT ON COLUMN idempotency_cache.expires_at IS 'Expiration timestamp (TTL: 24 hours from creation)';

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================

-- Drop indexes
DROP INDEX IF EXISTS idx_idempotency_cache_cleanup;
DROP INDEX IF EXISTS idx_idempotency_cache_created_at;
DROP INDEX IF EXISTS idx_idempotency_cache_endpoint;
DROP INDEX IF EXISTS idx_idempotency_cache_expires_at;

-- Drop table
DROP TABLE IF EXISTS idempotency_cache CASCADE;
