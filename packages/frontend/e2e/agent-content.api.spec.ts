import { expect, test } from '@playwright/test';

/**
 * Agent Content CRUD -- API
 *
 * Tests the /api/v1/content endpoints using Playwright's request context
 * (no browser). Verifies both public access patterns and auth boundaries.
 * All tests skip gracefully when the backend is unreachable.
 */
test.describe('Agent Content CRUD — API', () => {
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
  // Public Read Access
  // ---------------------------------------------------------------------------

  test('GET /api/v1/content returns 200 with array data', async ({ request }) => {
    // The list endpoint uses optionalAuth, so unauthenticated requests succeed
    const response = await request.get('/api/v1/content');
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Response shape: { data: [...] } or top-level array
    const items = body.data ?? body;
    expect(Array.isArray(items)).toBe(true);
  });

  test('GET /api/v1/content/search returns results or empty array', async ({ request }) => {
    const response = await request.get('/api/v1/content/search?q=test');
    expect([200, 400]).toContain(response.status());

    if (response.ok()) {
      const body = await response.json();
      const items = body.data ?? body;
      expect(Array.isArray(items)).toBe(true);
    }
  });

  test('GET /api/v1/content/:id with nonexistent ID returns 404', async ({ request }) => {
    const response = await request.get('/api/v1/content/00000000-0000-0000-0000-000000000000');
    // Should be 404 for nonexistent content (optionalAuth allows unauthenticated reads)
    expect([400, 404]).toContain(response.status());
  });

  // ---------------------------------------------------------------------------
  // Auth-Protected Write Operations
  // ---------------------------------------------------------------------------

  test('POST /api/v1/content/publish without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/v1/content/publish', {
      data: {
        title: 'Unauthorized Test Post',
        content: 'This should be rejected',
        kind: 'article',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('PUT /api/v1/content/:id without auth returns 401', async ({ request }) => {
    const response = await request.put('/api/v1/content/00000000-0000-0000-0000-000000000000', {
      data: { title: 'Updated Title' },
    });
    expect(response.status()).toBe(401);
  });

  test('DELETE /api/v1/content/:id without auth returns 401', async ({ request }) => {
    const response = await request.delete('/api/v1/content/00000000-0000-0000-0000-000000000000');
    expect(response.status()).toBe(401);
  });

  test('POST /api/v1/content/moderate without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/v1/content/moderate', {
      data: {
        contentId: '00000000-0000-0000-0000-000000000000',
        action: 'flag',
      },
    });
    expect(response.status()).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // Validation Boundaries
  // ---------------------------------------------------------------------------

  test('POST /api/v1/content/publish with empty body returns 400 or 401', async ({ request }) => {
    const response = await request.post('/api/v1/content/publish', {
      data: {},
    });
    // 401 takes precedence over validation since authenticate runs first
    expect([400, 401, 422]).toContain(response.status());

    if (response.status() === 400 || response.status() === 422) {
      const body = await response.json();
      expect(body).toHaveProperty('error');
    }
  });

  // ---------------------------------------------------------------------------
  // Authenticated CRUD Cycle (requires real NOSTR keys — skipped by default)
  // ---------------------------------------------------------------------------

  test.skip('authenticated content CRUD cycle', async ({ request }) => {
    // This test requires a valid JWT obtained through NOSTR challenge-response.
    // To enable: set E2E_CREATOR_PUBKEY and E2E_CREATOR_SIG env vars,
    // then obtain a token from /api/auth/challenge + /api/auth/authenticate.
    //
    // Steps:
    // 1. Authenticate → get Bearer token
    // 2. POST /api/v1/content/publish → 201 (create)
    // 3. GET /api/v1/content/:id → 200 (read created item)
    // 4. PUT /api/v1/content/:id → 200 (update)
    // 5. GET /api/v1/content/:id → verify update applied
    // 6. DELETE /api/v1/content/:id → 200 (cleanup)
    // 7. GET /api/v1/content/:id → 404 (verify deletion)
  });
});
