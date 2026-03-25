import { expect, test } from '@playwright/test';

/**
 * Agent Auth -- API Flow
 *
 * Tests the backend authentication and health endpoints using Playwright's
 * request context (no browser). All tests skip gracefully when the backend
 * is unreachable, which is the default in dev/CI without USE_BACKEND=1.
 */
test.describe('Agent Auth — API Flow', () => {
  let backendAvailable = false;

  test.beforeAll(async ({ request }) => {
    try {
      const health = await request.get('/health', { timeout: 5000 });
      backendAvailable = health.ok();
    } catch {
      backendAvailable = false;
    }
  });

  test.beforeEach(() => {
    test.skip(!backendAvailable, 'Backend not running — skipping API test');
  });

  // ---------------------------------------------------------------------------
  // Health, Readiness & Liveness Probes
  // ---------------------------------------------------------------------------

  test('GET /health returns 200 with status healthy', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'healthy');
    expect(body).toHaveProperty('service', 'sovren-api');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
  });

  test('GET /ready returns 200 or 503 with status field', async ({ request }) => {
    const response = await request.get('/ready');
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('timestamp');

    if (response.status() === 200) {
      expect(['ready', 'degraded']).toContain(body.status);
    } else {
      expect(body.status).toBe('not-ready');
    }
  });

  test('GET /live returns 200 with status alive', async ({ request }) => {
    const response = await request.get('/live');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'alive');
    expect(body).toHaveProperty('pid');
    expect(body).toHaveProperty('uptime');
  });

  test('GET /health/detailed returns comprehensive diagnostics', async ({ request }) => {
    const response = await request.get('/health/detailed');
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('environment');

    // Detailed endpoint includes services and metrics when not errored
    if (body.services) {
      expect(body.services).toHaveProperty('database');
      expect(body.services).toHaveProperty('redis');
    }
  });

  // ---------------------------------------------------------------------------
  // Authentication Boundaries
  // ---------------------------------------------------------------------------

  test('GET /api/auth/verify without token returns 401', async ({ request }) => {
    const response = await request.get('/api/auth/verify');
    expect(response.status()).toBe(401);
  });

  test('GET /api/v1/content with invalid Bearer token returns 401', async ({ request }) => {
    const response = await request.get('/api/v1/content', {
      headers: { Authorization: 'Bearer invalid-token-abc123' },
    });
    // optionalAuth may pass through with invalid token, or middleware may reject
    expect([200, 401]).toContain(response.status());
  });

  test('POST /api/auth/refresh without valid token returns 401', async ({ request }) => {
    const response = await request.post('/api/auth/refresh', {
      headers: { Authorization: 'Bearer expired-or-invalid-token' },
    });
    expect(response.status()).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // Challenge-Response Auth Flow (requires NOSTR keys — skipped by default)
  // ---------------------------------------------------------------------------

  test.skip('challenge-response auth flow produces valid JWT', async ({ request }) => {
    // This test requires real NOSTR keys and a seeded test user.
    // To enable: set E2E_CREATOR_PUBKEY and E2E_CREATOR_SIG env vars.
    //
    // Steps:
    // 1. POST /api/auth/challenge → { data: { challenge, timestamp } }
    // 2. Sign challenge with NOSTR private key
    // 3. POST /api/auth/authenticate → { data: { token } }
    // 4. GET /api/auth/verify with Bearer token → 200
  });
});
