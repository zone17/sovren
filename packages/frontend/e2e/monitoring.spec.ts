/**
 * 📊 E2E Tests: Monitoring and Error Handling
 * Tests monitoring dashboard, error notifications, and connection health
 */
import { test, expect, Page } from '@playwright/test';
import { NostrRelayMock } from './fixtures/relay-mock';
import { ALICE } from './fixtures/test-users';

test.describe('NOSTR Monitoring and Error Handling E2E Tests', () => {
  let page: Page;
  let mockRelay: NostrRelayMock;

  test.beforeAll(async () => {
    mockRelay = new NostrRelayMock({ port: 7040 });
    await mockRelay.start();
  });

  test.afterAll(async () => {
    await mockRelay.stop();
  });

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    mockRelay.clearEvents();

    await page.evaluate((alice) => {
      localStorage.setItem('nostr_keypair_encrypted', JSON.stringify({
        privateKey: alice.privateKeyHex,
        publicKey: alice.publicKey,
        created: Date.now(),
      }));
    }, ALICE);

    await page.click('text=Relays');
    await page.fill('input[placeholder*="relay"]', 'ws://localhost:7040');
    await page.click('button:has-text("Connect")');
    await page.waitForTimeout(2000);
  });

  test.describe('Monitoring Dashboard', () => {
    test('should display monitoring dashboard', async () => {
      await page.click('text=Monitoring');

      await expect(page.getByText(/dashboard|monitoring/i)).toBeVisible();
    });

    test('should show connection status', async () => {
      await page.click('text=Monitoring');

      // Should show connected relay count
      await expect(page.getByText(/connected|relays/i)).toBeVisible();

      // Should show online/offline status
      await expect(page.locator('[data-status="connected"], [class*="online"]')).toBeVisible();
    });

    test('should display event statistics', async () => {
      await page.click('text=Monitoring');

      // Should show event counters
      await expect(page.getByText(/events.*published|sent/i)).toBeVisible();
      await expect(page.getByText(/events.*received/i)).toBeVisible();
    });

    test('should show subscription count', async () => {
      // Create subscriptions
      await page.click('text=Feed');
      await page.waitForTimeout(1000);

      await page.click('text=Monitoring');

      // Should display active subscriptions
      await expect(page.getByText(/subscriptions.*active/i)).toBeVisible();
    });

    test('should display relay latency metrics', async () => {
      await page.click('text=Monitoring');

      // Should show ping/latency for each relay
      await expect(page.getByText(/latency|ping/i)).toBeVisible();
      await expect(page.getByText(/ms/i)).toBeVisible();
    });

    test('should show bandwidth usage', async () => {
      await page.click('text=Monitoring');

      // Should display data sent/received
      await expect(page.getByText(/sent|upload/i)).toBeVisible();
      await expect(page.getByText(/received|download/i)).toBeVisible();
    });

    test('should display error count', async () => {
      await page.click('text=Monitoring');

      // Should show error statistics
      await expect(page.getByText(/errors|failures/i)).toBeVisible();
    });

    test('should update metrics in real-time', async () => {
      await page.click('text=Monitoring');

      const initialCount = await page.locator('[data-metric="events-sent"]').textContent();

      // Publish an event
      await page.click('text=Publish');
      await page.fill('textarea[name="content"]', 'Monitoring test');
      await page.click('button:has-text("Send")');
      await page.waitForTimeout(2000);

      await page.click('text=Monitoring');

      // Count should have increased
      const newCount = await page.locator('[data-metric="events-sent"]').textContent();
      expect(newCount).not.toBe(initialCount);
    });

    test('should show connection uptime', async () => {
      await page.click('text=Monitoring');

      // Should display uptime
      await expect(page.getByText(/uptime|connected for/i)).toBeVisible();
    });

    test('should display relay health scores', async () => {
      await page.click('text=Monitoring');

      // Should show health indicators
      await expect(page.locator('[data-health-score], [class*="health"]')).toBeVisible();
    });
  });

  test.describe('Error Toast Notifications', () => {
    test('should show error toast for connection failure', async () => {
      // Try to connect to non-existent relay
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:9999');
      await page.click('button:has-text("Connect")');

      // Should show error notification
      await expect(page.locator('[role="alert"], .toast-error')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/failed|error/i)).toBeVisible();
    });

    test('should show error toast for publish failure', async () => {
      // Disconnect relays
      await page.click('text=Relays');
      await page.click('button:has-text("Disconnect All")');

      // Try to publish
      await page.click('text=Publish');
      await page.fill('textarea[name="content"]', 'This will fail');
      await page.click('button:has-text("Send")');

      // Should show error toast
      await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
    });

    test('should auto-dismiss toast after timeout', async () => {
      // Trigger an error
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:9999');
      await page.click('button:has-text("Connect")');

      // Toast should appear
      const toast = page.locator('[role="alert"]').first();
      await expect(toast).toBeVisible({ timeout: 10000 });

      // Toast should auto-dismiss after 5 seconds
      await expect(toast).not.toBeVisible({ timeout: 10000 });
    });

    test('should allow manual toast dismissal', async () => {
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:9999');
      await page.click('button:has-text("Connect")');

      const toast = page.locator('[role="alert"]').first();
      await expect(toast).toBeVisible({ timeout: 10000 });

      // Click dismiss button
      await page.click('[role="alert"] button[aria-label*="Close"], [role="alert"] .close');

      // Toast should disappear
      await expect(toast).not.toBeVisible({ timeout: 2000 });
    });

    test('should show different toast types', async () => {
      // Error toast
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'invalid');
      await page.click('button:has-text("Connect")');
      await expect(page.locator('.toast-error, [data-type="error"]')).toBeVisible({ timeout: 5000 });

      await page.waitForTimeout(2000);

      // Success toast
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7040');
      await page.click('button:has-text("Connect")');
      await expect(page.locator('.toast-success, [data-type="success"]')).toBeVisible({ timeout: 5000 });
    });

    test('should stack multiple toasts', async () => {
      // Trigger multiple errors
      for (let i = 0; i < 3; i++) {
        await page.click('text=Relays');
        await page.fill('input[placeholder*="relay"]', `ws://localhost:999${i}`);
        await page.click('button:has-text("Connect")');
        await page.waitForTimeout(500);
      }

      // Should show multiple toasts
      const toasts = page.locator('[role="alert"]');
      expect(await toasts.count()).toBeGreaterThan(1);
    });
  });

  test.describe('Connection Error Handling', () => {
    test('should handle relay disconnection', async () => {
      // Simulate relay going offline
      await mockRelay.stop();

      await page.waitForTimeout(3000);

      // Should show disconnection error
      await expect(page.getByText(/disconnected|offline/i)).toBeVisible({ timeout: 10000 });

      await mockRelay.start();
    });

    test('should detect network offline', async () => {
      // Simulate offline
      await page.context().setOffline(true);

      await page.waitForTimeout(2000);

      // Should show offline indicator
      await expect(page.getByText(/offline|no connection/i)).toBeVisible({ timeout: 5000 });

      await page.context().setOffline(false);
    });

    test('should show retry mechanism', async () => {
      await mockRelay.stop();
      await page.waitForTimeout(2000);

      // Should show reconnecting indicator
      await expect(page.getByText(/reconnecting|retrying/i)).toBeVisible({ timeout: 10000 });

      await mockRelay.start();

      // Should reconnect
      await expect(page.getByText(/reconnected|connected/i)).toBeVisible({ timeout: 15000 });
    });

    test('should handle timeout errors', async () => {
      const slowRelay = new NostrRelayMock({
        port: 7041,
        responseDelay: 10000,
      });
      await slowRelay.start();

      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7041');
      await page.click('button:has-text("Connect")');

      // Should show timeout error
      await expect(page.getByText(/timeout/i)).toBeVisible({ timeout: 20000 });

      await slowRelay.stop();
    });

    test('should handle malformed events', async () => {
      // Inject malformed event
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('nostr:event', {
          detail: {
            // Missing required fields
            kind: 1,
            content: 'malformed',
          }
        }));
      });

      await page.waitForTimeout(1000);

      // Should show validation error
      await expect(page.getByText(/invalid|malformed/i)).toBeVisible();
    });

    test('should handle signature verification failure', async () => {
      // Create event with invalid signature
      const invalidEvent = {
        id: 'fake-id',
        pubkey: ALICE.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Invalid signature',
        sig: '0'.repeat(128),
      };

      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, invalidEvent);

      await page.waitForTimeout(1000);

      // Should reject event
      await expect(page.getByText(/signature|verification|invalid/i)).toBeVisible();
    });
  });

  test.describe('Retry Mechanisms', () => {
    test('should retry failed publish', async () => {
      // Create unreliable relay
      const unreliableRelay = new NostrRelayMock({
        port: 7042,
        failureRate: 0.8, // 80% failure rate
      });
      await unreliableRelay.start();

      await page.click('text=Relays');
      await page.click('button:has-text("Disconnect All")');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7042');
      await page.click('button:has-text("Connect")');
      await page.waitForTimeout(2000);

      // Try to publish
      await page.click('text=Publish');
      await page.fill('textarea[name="content"]', 'Retry test');
      await page.click('button:has-text("Send")');

      // Should show retrying
      await expect(page.getByText(/retrying|attempt/i)).toBeVisible({ timeout: 10000 });

      await unreliableRelay.stop();
    });

    test('should implement exponential backoff', async () => {
      await mockRelay.stop();

      const retryTimes: number[] = [];

      // Monitor retry attempts
      page.on('console', msg => {
        if (msg.text().includes('retry') || msg.text().includes('reconnect')) {
          retryTimes.push(Date.now());
        }
      });

      await page.waitForTimeout(30000); // Wait for multiple retries

      // Verify backoff is increasing
      if (retryTimes.length >= 3) {
        const interval1 = retryTimes[1] - retryTimes[0];
        const interval2 = retryTimes[2] - retryTimes[1];
        expect(interval2).toBeGreaterThanOrEqual(interval1);
      }

      await mockRelay.start();
    });

    test('should limit max retry attempts', async () => {
      // Set up relay that never connects
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:9999');
      await page.click('button:has-text("Connect")');

      await page.waitForTimeout(60000); // Wait for retries to exhaust

      // Should show max retries error
      await expect(page.getByText(/max.*attempts|giving up|failed/i)).toBeVisible();
    });
  });

  test.describe('Error Recovery', () => {
    test('should recover from temporary network blip', async () => {
      await page.context().setOffline(true);
      await page.waitForTimeout(2000);

      await page.context().setOffline(false);

      // Should auto-reconnect
      await expect(page.getByText(/reconnected|connected/i)).toBeVisible({ timeout: 15000 });
    });

    test('should resume subscriptions after reconnection', async () => {
      // Create subscription
      await page.click('text=Feed');
      await page.waitForTimeout(2000);

      // Disconnect
      await mockRelay.stop();
      await page.waitForTimeout(2000);

      // Reconnect
      await mockRelay.start();

      await page.waitForTimeout(5000);

      // Subscriptions should be restored
      const stats = mockRelay.getStats();
      expect(stats.subscriptions).toBeGreaterThan(0);
    });

    test('should clear error state after successful operation', async () => {
      // Cause error
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'invalid');
      await page.click('button:has-text("Connect")');
      await expect(page.getByText(/error/i)).toBeVisible({ timeout: 5000 });

      // Successful operation
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7040');
      await page.click('button:has-text("Connect")');

      // Error should be cleared
      await expect(page.getByText(/error/i)).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Performance Monitoring', () => {
    test('should monitor page load performance', async () => {
      await page.click('text=Monitoring');

      // Should show load time metrics
      await expect(page.getByText(/load time|performance/i)).toBeVisible();
    });

    test('should track event processing time', async () => {
      await page.click('text=Monitoring');

      // Publish event
      await page.click('text=Publish');
      await page.fill('textarea[name="content"]', 'Performance test');
      await page.click('button:has-text("Send")');
      await page.waitForTimeout(2000);

      await page.click('text=Monitoring');

      // Should show processing metrics
      await expect(page.getByText(/processing.*time|latency/i)).toBeVisible();
    });

    test('should detect performance degradation', async () => {
      // Create slow relay
      const slowRelay = new NostrRelayMock({
        port: 7043,
        responseDelay: 5000,
      });
      await slowRelay.start();

      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7043');
      await page.click('button:has-text("Connect")');
      await page.waitForTimeout(7000);

      await page.click('text=Monitoring');

      // Should show slow performance warning
      await expect(page.getByText(/slow|degraded|warning/i)).toBeVisible();

      await slowRelay.stop();
    });
  });

  test.describe('Accessibility', () => {
    test('should announce errors to screen readers', async () => {
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'invalid');
      await page.click('button:has-text("Connect")');

      // Error should have aria-live
      const errorRegion = page.locator('[role="alert"], [aria-live="assertive"]');
      await expect(errorRegion).toBeVisible({ timeout: 5000 });
    });

    test('should have keyboard-accessible error dismissal', async () => {
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:9999');
      await page.click('button:has-text("Connect")');

      const toast = page.locator('[role="alert"]').first();
      await expect(toast).toBeVisible({ timeout: 10000 });

      // Tab to close button and press Enter
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      await expect(toast).not.toBeVisible();
    });

    test('should provide descriptive error messages', async () => {
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'invalid-url');
      await page.click('button:has-text("Connect")');

      // Error should be descriptive, not generic
      const errorText = await page.locator('[role="alert"]').first().textContent();
      expect(errorText?.length).toBeGreaterThan(20); // Should be detailed
    });
  });
});
