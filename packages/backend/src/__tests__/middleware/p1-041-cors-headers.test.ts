/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * P1-041: CORS Exposed Headers Tests
 *
 * Verifies that CORS exposedHeaders configuration includes IETF standard
 * RateLimit-* headers (not the X-RateLimit-* variants that the rate limiter
 * doesn't actually send).
 *
 * The rate limiter uses `standardHeaders: true` and `legacyHeaders: false`,
 * which sends IETF headers without the X- prefix.
 */

import { createApp } from '../../app';

// Mock all imports that createApp uses to avoid side effects
vi.mock('../../lib/sentry', () => ({
  initSentry: vi.fn(),
}));

vi.mock('../../lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../middleware/deployment-monitoring', () => ({
  deploymentMonitoring: vi.fn((_req: any, _res: any, next: any) => next()),
  getPrometheusMetrics: vi.fn((_req: any, res: any) => res.end('# metrics')),
}));

vi.mock('../../middleware/csrf', () => ({
  csrfProtection: () => vi.fn((_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../middleware/rate-limit-middleware', () => ({
  createRateLimiter: () => vi.fn((_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../middleware/correlation-id', () => ({
  correlationIdMiddleware: vi.fn((_req: any, _res: any, next: any) => next()),
  getCorrelationId: vi.fn(() => 'test-correlation-id'),
}));

vi.mock('../../routes/auth', async () => {
  const { Router } = await vi.importActual('express');
  return Router();
});

vi.mock('../../routes/lightning', async () => {
  const { Router } = await vi.importActual('express');
  return Router();
});

vi.mock('../../routes/lightning-receipts', async () => {
  const { Router } = await vi.importActual('express');
  return Router();
});

vi.mock('../../routes/users', async () => {
  const { Router } = await vi.importActual('express');
  return Router();
});

vi.mock('../../routes/health', async () => {
  const { Router } = await vi.importActual('express');
  return Router();
});

vi.mock('../../routes/v1', async () => {
  const { Router } = await vi.importActual('express');
  return Router();
});

vi.mock('../../middleware/error-handler-middleware', () => ({
  errorHandler: vi.fn((_err: any, _req: any, _res: any, next: any) => next()),
}));

describe('P1-041: CORS Exposed Headers', () => {
  beforeAll(() => {
    createApp();
  });

  it('should include IETF standard RateLimit headers in exposedHeaders', () => {
    // This is a config validation test, so we check the source directly
    // The exposed headers should include IETF standard names
    const expectedHeaders = [
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'RateLimit-Policy',
    ];

    const forbiddenHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'];

    // Read the app.ts file content to verify the CORS config
    const fs = require('fs');
    const path = require('path');
    const appPath = path.join(__dirname, '../../app.ts');
    const appContent = fs.readFileSync(appPath, 'utf8');

    // Verify IETF headers ARE present
    for (const header of expectedHeaders) {
      expect(appContent).toContain(`'${header}'`);
    }

    // Verify legacy X-RateLimit-* headers are NOT present
    for (const header of forbiddenHeaders) {
      expect(appContent).not.toContain(`'${header}'`);
    }
  });

  it('should include Retry-After in exposedHeaders', () => {
    const fs = require('fs');
    const path = require('path');
    const appPath = path.join(__dirname, '../../app.ts');
    const appContent = fs.readFileSync(appPath, 'utf8');

    expect(appContent).toContain("'Retry-After'");
  });

  it('should include X-CSRF-Token and X-Correlation-ID in exposedHeaders', () => {
    const fs = require('fs');
    const path = require('path');
    const appPath = path.join(__dirname, '../../app.ts');
    const appContent = fs.readFileSync(appPath, 'utf8');

    expect(appContent).toContain("'X-CSRF-Token'");
    expect(appContent).toContain("'X-Correlation-ID'");
  });
});
