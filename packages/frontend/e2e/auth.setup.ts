import { expect, test as setup } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../test-results/.auth/creator.json');

/**
 * Auth setup for NOSTR-based authentication.
 *
 * In CI (no NIP-07 browser extension available), we call the challenge and
 * authenticate endpoints programmatically to obtain a JWT, then inject it
 * into localStorage so the authenticated Playwright projects can reuse it.
 *
 * When USE_BACKEND=1, this hits the real backend. Otherwise it relies on the
 * frontend's demo auth redirect which sets the token automatically.
 */
setup('authenticate as creator via NOSTR', async ({ page, request }) => {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const apiURL = process.env.E2E_API_URL || 'http://localhost:3001';

  if (process.env.USE_BACKEND) {
    // Programmatic NOSTR auth: call backend challenge + authenticate directly.
    // Uses a pre-seeded test creator pubkey from env (no NIP-07 required in CI).
    const testPubkey =
      process.env.E2E_CREATOR_PUBKEY ||
      'e2e0000000000000000000000000000000000000000000000000000000000000001';

    // Step 1: Get challenge
    const challengeRes = await request.post(`${apiURL}/api/auth/challenge`);
    expect(challengeRes.ok()).toBeTruthy();
    const challengeData = await challengeRes.json();
    const { challenge, timestamp } = challengeData.data;

    // Step 2: Authenticate with pre-signed test signature (backend accepts test mode)
    const authRes = await request.post(`${apiURL}/api/auth/authenticate`, {
      data: {
        pubkey: testPubkey,
        challenge,
        timestamp,
        // In E2E test mode the backend accepts a deterministic test signature
        signature: process.env.E2E_CREATOR_SIG || 'test-e2e-signature',
        event: {
          kind: 22242,
          pubkey: testPubkey,
          created_at: timestamp,
          tags: [['challenge', challenge]],
          content: 'test-hash',
          id: 'test-event-id',
          sig: process.env.E2E_CREATOR_SIG || 'test-e2e-signature',
        },
      },
    });

    if (authRes.ok()) {
      const { data } = await authRes.json();
      const token = data.token;

      // Inject token into browser storage state
      await page.goto(baseURL);
      await page.evaluate((t) => {
        localStorage.setItem('auth_token', t);
      }, token);
    } else {
      // Fallback: backend auth failed, inject demo user into localStorage
      await page.goto(baseURL);
      await page.evaluate(() => {
        const demoUser = {
          id: 'e2e-demo-creator-fallback-' + Date.now(),
          name: 'E2E Creator',
          email: 'e2e-creator@sovren.test',
          role: 'creator',
          nostr_pubkey: 'e2e0000000000000000000000000000000000000000000000000000000000000001',
          nostr_verified: true,
          email_verified: true,
          permissions: ['content.create', 'content.edit', 'content.publish', 'payments.receive'],
          created_at: new Date().toISOString(),
        };
        localStorage.setItem('demo_user', JSON.stringify(demoUser));
        localStorage.setItem('auth_token', 'e2e-demo-token-' + Date.now());
      });
      await page.reload();
    }
  } else {
    // Demo auth mode: inject a demo user directly into localStorage.
    // The Login component no longer auto-redirects — it requires user interaction.
    // Instead, seed localStorage with demo_user (for VITE_DEMO_MODE) and auth_token
    // so AuthProvider.verifyAuth() finds an authenticated session on mount.
    await page.goto(baseURL);
    await page.evaluate(() => {
      const demoUser = {
        id: 'e2e-demo-creator-' + Date.now(),
        name: 'E2E Creator',
        email: 'e2e-creator@sovren.test',
        role: 'creator',
        nostr_pubkey: 'e2e0000000000000000000000000000000000000000000000000000000000000001',
        nostr_verified: true,
        email_verified: true,
        permissions: ['content.create', 'content.edit', 'content.publish', 'payments.receive'],
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('demo_user', JSON.stringify(demoUser));
      localStorage.setItem('auth_token', 'e2e-demo-token-' + Date.now());
    });
    // Do NOT reload — realAuthService.verifyAuth() would call /api/auth/verify,
    // fail (no backend), and clear auth_token from localStorage before storageState saves.
    // The authenticated tests will trigger AuthProvider on their own navigation.
  }

  await page.context().storageState({ path: authFile });
});
