/**
 * Integration Test Setup
 *
 * Global setup for integration tests with testcontainers.
 * Initializes test environment and mocks.
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-key-12345';

// Global test setup
beforeAll(() => {
  console.log('🚀 Integration test suite starting...');
});

// Global test teardown
afterAll(() => {
  console.log('✅ Integration test suite completed');
});
