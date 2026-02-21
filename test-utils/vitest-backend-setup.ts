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
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-key-for-testing';
process.env.WEBHOOK_SECRET_ROTATION = 'test-webhook-secret-rotation-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SMTP_HOST = 'smtp.test.local';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.local';
process.env.SMTP_PASS = 'test-password';

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
