/**
 * Vitest Backend Setup
 *
 * Provides Node.js test environment setup with database mocks
 * and backend-specific utilities.
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

// Provide CJS require() for tests that use it
if (typeof globalThis.require === 'undefined') {
  (globalThis as any).require = createRequire(import.meta.url);
}

// Environment variables
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-minimum-32-characters';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-key-for-testing';
process.env.WEBHOOK_SECRET_ROTATION = 'test-webhook-secret-rotation-key';

afterEach(() => {
  vi.clearAllMocks();
  if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
  }
});

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  vi.clearAllMocks();
});

// Mock fetch globally
globalThis.fetch = vi.fn() as any;
