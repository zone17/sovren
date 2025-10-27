/**
 * Vitest Test Setup
 *
 * Global test configuration and mocks.
 */

import { beforeEach, vi } from 'vitest';

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.WEBHOOK_SECRET = 'test-webhook-secret';
process.env.JWT_SECRET = 'test-jwt-secret';
