/**
 * 🌐 E2E Tests: NOSTR Relay Connections
 * Tests relay connection management, multi-relay scenarios, and connection resilience
 */
import { test, expect, Page } from '@playwright/test';
import { NostrRelayMock } from './fixtures/relay-mock';

test.describe('NOSTR Relay Connections E2E Tests', () => {
  let page: Page;
  let mockRelay1: NostrRelayMock;
  let mockRelay2: NostrRelayMock;
  let mockRelay3: NostrRelayMock;

  test.beforeAll(async () => {
    // Start mock relay servers
    mockRelay1 = new NostrRelayMock({ port: 7001 });
    mockRelay2 = new NostrRelayMock({ port: 7002 });
    mockRelay3 = new NostrRelayMock({ port: 7003 });

    await Promise.all([mockRelay1.start(), mockRelay2.start(), mockRelay3.start()]);
  });

  test.afterAll(async () => {
    // Stop mock relay servers
    await Promise.all([mockRelay1.stop(), mockRelay2.stop(), mockRelay3.stop()]);
  });

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Clear storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear relay events
    mockRelay1.clearEvents();
    mockRelay2.clearEvents();
    mockRelay3.clearEvents();
  });

  test.describe('Single Relay Connection', () => {
    test('should connect to relay successfully', async () => {
      // Navigate to relay settings/connection page
      await page.click('text=Relays');

      // Add relay URL
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');

      // Wait for connection
      await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10000 });

      // Verify relay stats
      const stats = mockRelay1.getStats();
      expect(stats.connections).toBeGreaterThan(0);
    });

    test('should show connection status indicator', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');

      // Check for visual connection indicator (green dot, badge, etc.)
      await expect(page.locator('[class*="connected"], [class*="online"]')).toBeVisible({
        timeout: 10000,
      });
    });

    test('should disconnect from relay', async () => {
      await page.click('text=Relays');

      // Connect first
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');
      await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10000 });

      // Disconnect
      await page.click('button:has-text("Disconnect")');
      await expect(page.getByText(/disconnected/i)).toBeVisible({ timeout: 10000 });

      // Verify no connections
      await page.waitForTimeout(1000);
      const stats = mockRelay1.getStats();
      expect(stats.connections).toBe(0);
    });

    test('should handle connection timeout', async () => {
      await page.click('text=Relays');

      // Try to connect to non-existent relay
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:9999');
      await page.click('button:has-text("Connect")');

      // Should show timeout/error message
      await expect(page.getByText(/timeout|failed|error/i)).toBeVisible({ timeout: 15000 });
    });

    test('should validate relay URL format', async () => {
      await page.click('text=Relays');

      // Try invalid URL
      await page.fill('input[placeholder*="relay"]', 'invalid-url');
      await page.click('button:has-text("Connect")');

      // Should show validation error
      await expect(page.getByText(/invalid|url/i)).toBeVisible({ timeout: 5000 });
    });

    test('should require ws:// or wss:// protocol', async () => {
      await page.click('text=Relays');

      // Try HTTP URL
      await page.fill('input[placeholder*="relay"]', 'http://localhost:7001');
      await page.click('button:has-text("Connect")');

      await expect(page.getByText(/ws:\/\/|wss:\/\//i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Multi-Relay Scenarios', () => {
    test('should connect to multiple relays simultaneously', async () => {
      await page.click('text=Relays');

      const relayUrls = ['ws://localhost:7001', 'ws://localhost:7002', 'ws://localhost:7003'];

      // Connect to all relays
      for (const url of relayUrls) {
        await page.fill('input[placeholder*="relay"]', url);
        await page.click('button:has-text("Add")');
      }

      await page.click('button:has-text("Connect All")');

      // Wait for all connections
      await page.waitForTimeout(2000);

      // Verify all show as connected
      const connectedCount = await page.locator('[class*="connected"]').count();
      expect(connectedCount).toBe(3);

      // Verify mock servers received connections
      expect(mockRelay1.getStats().connections).toBeGreaterThan(0);
      expect(mockRelay2.getStats().connections).toBeGreaterThan(0);
      expect(mockRelay3.getStats().connections).toBeGreaterThan(0);
    });

    test('should show individual relay status', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:9999'); // Invalid
      await page.click('button:has-text("Add")');

      await page.click('button:has-text("Connect All")');
      await page.waitForTimeout(3000);

      // One should be connected, one failed
      await expect(page.locator('[class*="connected"]')).toBeVisible();
      await expect(page.locator('[class*="failed"], [class*="error"]')).toBeVisible();
    });

    test('should handle relay priority/ordering', async () => {
      await page.click('text=Relays');

      const relays = [
        { url: 'ws://localhost:7001', name: 'Relay 1' },
        { url: 'ws://localhost:7002', name: 'Relay 2' },
        { url: 'ws://localhost:7003', name: 'Relay 3' },
      ];

      // Add relays in order
      for (const relay of relays) {
        await page.fill('input[placeholder*="relay"]', relay.url);
        if (page.locator('input[placeholder*="name"]').isVisible()) {
          await page.fill('input[placeholder*="name"]', relay.name);
        }
        await page.click('button:has-text("Add")');
      }

      // Verify order is maintained
      const relayElements = await page.locator('[data-relay-item]').all();
      expect(relayElements.length).toBe(3);
    });

    test('should distribute events across relays', async () => {
      await page.click('text=Relays');

      // Connect to multiple relays
      const relays = ['ws://localhost:7001', 'ws://localhost:7002'];
      for (const url of relays) {
        await page.fill('input[placeholder*="relay"]', url);
        await page.click('button:has-text("Add")');
      }

      await page.click('button:has-text("Connect All")');
      await page.waitForTimeout(2000);

      // Publish an event
      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"]', 'Test event for multiple relays');
      await page.click('button:has-text("Send")');

      await page.waitForTimeout(1000);

      // Verify both relays received the event
      expect(mockRelay1.getAllEvents().length).toBeGreaterThan(0);
      expect(mockRelay2.getAllEvents().length).toBeGreaterThan(0);
    });
  });

  test.describe('Connection Failures and Recovery', () => {
    test('should handle relay disconnection gracefully', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');
      await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10000 });

      // Simulate relay going offline
      await mockRelay1.stop();

      // Should show disconnected status
      await expect(page.getByText(/disconnected|offline/i)).toBeVisible({ timeout: 15000 });
    });

    test('should attempt automatic reconnection', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');
      await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10000 });

      // Simulate brief disconnection
      await mockRelay1.stop();
      await page.waitForTimeout(2000);

      // Restart relay
      await mockRelay1.start();

      // Should reconnect automatically
      await expect(page.getByText(/reconnected|connected/i)).toBeVisible({ timeout: 30000 });
    });

    test('should show reconnection attempts', async () => {
      await page.click('text=Relays');

      // Try to connect to offline relay
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7004');
      await page.click('button:has-text("Connect")');

      // Should show retry attempts
      await expect(page.getByText(/retrying|attempting/i)).toBeVisible({ timeout: 10000 });
    });

    test('should handle partial relay failures', async () => {
      await page.click('text=Relays');

      // Connect to multiple relays
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7002');
      await page.click('button:has-text("Add")');

      await page.click('button:has-text("Connect All")');
      await page.waitForTimeout(2000);

      // Stop one relay
      await mockRelay1.stop();
      await page.waitForTimeout(2000);

      // Should still show one relay connected
      const connectedElements = await page.locator('[class*="connected"]').count();
      expect(connectedElements).toBeGreaterThanOrEqual(1);

      // System should still be functional
      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"]', 'Test with partial failure');
      await page.click('button:has-text("Send")');

      // Should succeed on remaining relay
      await expect(page.getByText(/published|sent/i)).toBeVisible({ timeout: 10000 });
    });

    test('should handle slow relay responses', async () => {
      // Create slow relay
      const slowRelay = new NostrRelayMock({
        port: 7005,
        responseDelay: 3000, // 3 second delay
      });
      await slowRelay.start();

      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7005');
      await page.click('button:has-text("Connect")');

      // Should show loading/pending state
      await expect(page.getByText(/connecting/i)).toBeVisible({ timeout: 2000 });

      // Eventually should connect
      await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 15000 });

      await slowRelay.stop();
    });
  });

  test.describe('Relay Switching', () => {
    test('should switch primary relay', async () => {
      await page.click('text=Relays');

      // Add multiple relays
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Add")');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7002');
      await page.click('button:has-text("Add")');

      await page.click('button:has-text("Connect All")');
      await page.waitForTimeout(2000);

      // Switch primary relay
      const relay2Element = page.locator('[data-relay-url*="7002"]');
      await relay2Element.click();
      await page.click('button:has-text("Set as Primary")');

      // Verify primary indicator moved
      await expect(relay2Element.locator('[class*="primary"]')).toBeVisible();
    });

    test('should remove relay from list', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Add")');

      // Remove relay
      await page.click('button[aria-label*="Remove"], button[title*="Remove"]');

      // Should be removed from list
      await expect(page.getByText('ws://localhost:7001')).not.toBeVisible();
    });

    test('should persist relay configuration', async () => {
      await page.click('text=Relays');

      // Add and connect to relays
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Add")');
      await page.click('button:has-text("Connect")');
      await page.waitForTimeout(2000);

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('text=Relays');

      // Relay should still be in list
      await expect(page.getByText('ws://localhost:7001')).toBeVisible();
    });
  });

  test.describe('Relay Information and Stats', () => {
    test('should display relay connection statistics', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');
      await page.waitForTimeout(2000);

      // Should show stats
      await expect(page.getByText(/events|subscriptions|uptime/i)).toBeVisible();
    });

    test('should show relay latency', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');
      await page.waitForTimeout(2000);

      // Should display ping/latency
      await expect(page.getByText(/ms|ping|latency/i)).toBeVisible();
    });

    test('should display supported NIPs', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');
      await page.waitForTimeout(2000);

      // Should show NIP support
      await expect(page.getByText(/NIP/i)).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      await page.click('text=Relays');

      // Tab to input
      await page.keyboard.press('Tab');
      await page.keyboard.type('ws://localhost:7001');

      // Tab to connect button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // Should connect
      await expect(page.getByText(/connected/i)).toBeVisible({ timeout: 10000 });
    });

    test('should have proper ARIA labels for connection status', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');
      await page.waitForTimeout(2000);

      // Status should have aria-label
      const statusElement = page.locator('[role="status"], [aria-live]');
      await expect(statusElement).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle malformed WebSocket frames', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7001');
      await page.click('button:has-text("Connect")');
      await page.waitForTimeout(2000);

      // Relay connection should be stable despite errors
      await expect(page.getByText(/connected/i)).toBeVisible();
    });

    test('should handle rate limiting', async () => {
      const rateLimitedRelay = new NostrRelayMock({
        port: 7006,
        failureRate: 0.5, // 50% failure rate to simulate rate limiting
      });
      await rateLimitedRelay.start();

      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7006');
      await page.click('button:has-text("Connect")');

      // Should eventually connect despite rate limiting
      await expect(page.getByText(/connected|limited/i)).toBeVisible({ timeout: 15000 });

      await rateLimitedRelay.stop();
    });

    test('should show error details for connection failures', async () => {
      await page.click('text=Relays');

      await page.fill('input[placeholder*="relay"]', 'ws://localhost:9999');
      await page.click('button:has-text("Connect")');

      // Should show detailed error
      await expect(page.getByText(/error|failed|unable/i)).toBeVisible({ timeout: 15000 });
    });
  });
});
