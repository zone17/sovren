/**
 * Vitest Backend Setup
 *
 * Configures environment for backend tests running against
 * real local Supabase and Redis instances.
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

// Provide CJS require() for tests that use it
if (typeof globalThis.require === 'undefined') {
  (globalThis as any).require = createRequire(import.meta.url);
}

// Environment variables — real local Supabase + Redis
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';
process.env.JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-key-for-testing';
process.env.WEBHOOK_SECRET_ROTATION = 'test-webhook-secret-rotation-key';
process.env.REDIS_URL = 'redis://localhost:6380';
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

// NOTE: globalThis.fetch is NOT mocked — we use real fetch against local Supabase
