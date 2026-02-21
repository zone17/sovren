/* eslint-disable no-undef */
/**
 * Minimal Jest setup for EPIC-011 finance service tests.
 *
 * The global jest.setup.js eagerly requires nostr-auth → user-repository which
 * pulls in ESM-only nostr-tools and crashes ts-jest (CJS mode).  Finance services
 * have no dependency on auth or NOSTR, so we use this lightweight setup instead.
 */

// Standard test environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

// Mock global fetch (used by TaxService.getBtcUsdRate)
global.fetch = jest.fn();

// Global timeout
jest.setTimeout(30000);

// Clear mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});
