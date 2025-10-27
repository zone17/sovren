/**
 * 📝 E2E Tests: NOSTR Event Publishing
 * Tests event creation, publishing to relays, and error handling
 */
import { test, expect, Page } from '@playwright/test';
import { NostrRelayMock } from './fixtures/relay-mock';
import { ALICE, BOB } from './fixtures/test-users';

test.describe('NOSTR Event Publishing E2E Tests', () => {
  let page: Page;
  let mockRelay: NostrRelayMock;

  test.beforeAll(async () => {
    mockRelay = new NostrRelayMock({ port: 7010 });
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

    // Set up key pair (use Alice's key)
    await page.evaluate((alice) => {
      localStorage.setItem('nostr_keypair_encrypted', JSON.stringify({
        privateKey: alice.privateKeyHex,
        publicKey: alice.publicKey,
        created: Date.now(),
      }));
    }, ALICE);

    // Connect to relay
    await page.click('text=Relays');
    await page.fill('input[placeholder*="relay"]', 'ws://localhost:7010');
    await page.click('button:has-text("Connect")');
    await page.waitForTimeout(2000);
  });

  test.describe('Text Note Publishing (Kind 1)', () => {
    test('should publish simple text note', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Hello NOSTR world!');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/published|sent successfully/i)).toBeVisible({ timeout: 10000 });

      // Verify event was received by relay
      const events = mockRelay.getAllEvents();
      expect(events.length).toBe(1);
      expect(events[0].kind).toBe(1);
      expect(events[0].content).toBe('Hello NOSTR world!');
      expect(events[0].pubkey).toBe(ALICE.publicKey);
    });

    test('should publish note with hashtags', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Testing #nostr #e2e #testing');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/published|sent successfully/i)).toBeVisible({ timeout: 10000 });

      const events = mockRelay.getAllEvents();
      expect(events[0].tags.some(tag => tag[0] === 't' && tag[1] === 'nostr')).toBeTruthy();
      expect(events[0].tags.some(tag => tag[0] === 't' && tag[1] === 'e2e')).toBeTruthy();
    });

    test('should publish note with mentions', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[placeholder*="message"], textarea[name="content"]',
        `Hey @${BOB.npub}, how are you?`);
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/published|sent successfully/i)).toBeVisible({ timeout: 10000 });

      const events = mockRelay.getAllEvents();
      expect(events[0].tags.some(tag => tag[0] === 'p')).toBeTruthy();
    });

    test('should publish note with links', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[placeholder*="message"], textarea[name="content"]',
        'Check out https://sovren.app');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/published|sent successfully/i)).toBeVisible({ timeout: 10000 });

      const events = mockRelay.getAllEvents();
      expect(events[0].content).toContain('https://sovren.app');
    });

    test('should publish long note', async () => {
      const longContent = 'a'.repeat(5000);

      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', longContent);
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/published|sent successfully/i)).toBeVisible({ timeout: 10000 });

      const events = mockRelay.getAllEvents();
      expect(events[0].content.length).toBe(5000);
    });

    test('should publish note with emoji', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[placeholder*="message"], textarea[name="content"]',
        'Testing emoji support 🚀🔥💪');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/published|sent successfully/i)).toBeVisible({ timeout: 10000 });

      const events = mockRelay.getAllEvents();
      expect(events[0].content).toContain('🚀');
      expect(events[0].content).toContain('🔥');
    });
  });

  test.describe('Different Event Kinds', () => {
    test('should publish metadata event (kind 0)', async () => {
      await page.click('text=Profile');

      await page.fill('input[name="name"]', 'Alice Updated');
      await page.fill('textarea[name="about"]', 'Updated bio for E2E test');
      await page.fill('input[name="picture"]', 'https://example.com/alice-new.jpg');

      await page.click('button:has-text("Save Profile")');

      await expect(page.getByText(/profile updated/i)).toBeVisible({ timeout: 10000 });

      const events = mockRelay.getAllEvents();
      const metadataEvent = events.find(e => e.kind === 0);
      expect(metadataEvent).toBeDefined();

      const metadata = JSON.parse(metadataEvent!.content);
      expect(metadata.name).toBe('Alice Updated');
      expect(metadata.about).toBe('Updated bio for E2E test');
    });

    test('should publish contacts event (kind 3)', async () => {
      await page.click('text=Following');

      // Add contact
      await page.fill('input[placeholder*="public key"], input[placeholder*="npub"]', BOB.npub);
      await page.click('button:has-text("Follow")');

      await expect(page.getByText(/following/i)).toBeVisible({ timeout: 10000 });

      const events = mockRelay.getAllEvents();
      const contactsEvent = events.find(e => e.kind === 3);
      expect(contactsEvent).toBeDefined();
      expect(contactsEvent!.tags.some(tag => tag[0] === 'p' && tag[1] === BOB.publicKey)).toBeTruthy();
    });

    test('should publish reaction event (kind 7)', async () => {
      // First publish a note to react to
      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Test note for reaction');
      await page.click('button:has-text("Publish"), button:has-text("Send")');
      await page.waitForTimeout(1000);

      const originalEvent = mockRelay.getAllEvents()[0];

      // React to the note
      await page.click(`button[data-event-id="${originalEvent.id}"] button:has-text("👍"), button[aria-label*="Like"]`);

      await page.waitForTimeout(1000);

      const events = mockRelay.getAllEvents();
      const reactionEvent = events.find(e => e.kind === 7);
      expect(reactionEvent).toBeDefined();
      expect(reactionEvent!.tags.some(tag => tag[0] === 'e' && tag[1] === originalEvent.id)).toBeTruthy();
    });

    test('should publish deletion event (kind 5)', async () => {
      // Publish a note first
      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Note to delete');
      await page.click('button:has-text("Publish"), button:has-text("Send")');
      await page.waitForTimeout(1000);

      const originalEvent = mockRelay.getAllEvents()[0];

      // Delete the note
      await page.click(`button[data-event-id="${originalEvent.id}"] button[aria-label*="Delete"]`);
      await page.click('button:has-text("Confirm Delete")');

      await page.waitForTimeout(1000);

      const events = mockRelay.getAllEvents();
      const deletionEvent = events.find(e => e.kind === 5);
      expect(deletionEvent).toBeDefined();
      expect(deletionEvent!.tags.some(tag => tag[0] === 'e' && tag[1] === originalEvent.id)).toBeTruthy();
    });
  });

  test.describe('Publishing to Multiple Relays', () => {
    let mockRelay2: NostrRelayMock;

    test.beforeAll(async () => {
      mockRelay2 = new NostrRelayMock({ port: 7011 });
      await mockRelay2.start();
    });

    test.afterAll(async () => {
      await mockRelay2.stop();
    });

    test('should publish to all connected relays', async () => {
      // Connect second relay
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7011');
      await page.click('button:has-text("Add")');
      await page.click('button:has-text("Connect All")');
      await page.waitForTimeout(2000);

      // Publish note
      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Multi-relay test');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await page.waitForTimeout(2000);

      // Verify both relays received the event
      const events1 = mockRelay.getAllEvents();
      const events2 = mockRelay2.getAllEvents();

      expect(events1.length).toBeGreaterThan(0);
      expect(events2.length).toBeGreaterThan(0);
      expect(events1[0].content).toBe('Multi-relay test');
      expect(events2[0].content).toBe('Multi-relay test');
    });

    test('should handle partial relay failures', async () => {
      // Connect to working and non-working relay
      await page.click('text=Relays');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:9999'); // Non-existent
      await page.click('button:has-text("Add")');
      await page.waitForTimeout(1000);

      // Publish should succeed on working relay
      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Partial failure test');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/published.*1.*relay|partially published/i)).toBeVisible({ timeout: 10000 });

      // Working relay should have the event
      const events = mockRelay.getAllEvents();
      expect(events.length).toBeGreaterThan(0);
    });
  });

  test.describe('Publish Error Handling', () => {
    test('should show error when not connected to any relay', async () => {
      // Disconnect all relays
      await page.click('text=Relays');
      await page.click('button:has-text("Disconnect All")');
      await page.waitForTimeout(1000);

      // Try to publish
      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'This should fail');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/not connected|no relay/i)).toBeVisible({ timeout: 5000 });
    });

    test('should show error when no private key', async () => {
      // Clear keys
      await page.evaluate(() => {
        localStorage.removeItem('nostr_keypair_encrypted');
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'No key test');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/private key|not logged in/i)).toBeVisible({ timeout: 5000 });
    });

    test('should handle relay rejecting event', async () => {
      // Create relay that rejects all events
      const rejectingRelay = new NostrRelayMock({
        port: 7012,
        acceptAllEvents: false,
      });
      await rejectingRelay.start();

      // Connect to rejecting relay
      await page.click('text=Relays');
      await page.click('button:has-text("Disconnect All")');
      await page.fill('input[placeholder*="relay"]', 'ws://localhost:7012');
      await page.click('button:has-text("Connect")');
      await page.waitForTimeout(2000);

      // Try to publish
      await page.click('text=Publish');
      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Rejection test');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/rejected|failed/i)).toBeVisible({ timeout: 10000 });

      await rejectingRelay.stop();
    });

    test('should validate empty content', async () => {
      await page.click('text=Publish');

      // Try to publish empty note
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/empty|required|enter/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Draft and Editing', () => {
    test('should save draft automatically', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Draft content');

      // Wait for auto-save
      await page.waitForTimeout(2000);

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.click('text=Publish');

      // Draft should be restored
      const content = await page.locator('textarea[placeholder*="message"], textarea[name="content"]').inputValue();
      expect(content).toBe('Draft content');
    });

    test('should clear draft after publishing', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Publish and clear');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      await expect(page.getByText(/published|sent successfully/i)).toBeVisible({ timeout: 10000 });

      // Content should be cleared
      const content = await page.locator('textarea[placeholder*="message"], textarea[name="content"]').inputValue();
      expect(content).toBe('');
    });
  });

  test.describe('Performance', () => {
    test('should publish events quickly', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Performance test');

      const startTime = Date.now();
      await page.click('button:has-text("Publish"), button:has-text("Send")');
      await expect(page.getByText(/published|sent successfully/i)).toBeVisible({ timeout: 10000 });
      const endTime = Date.now();

      const publishTime = endTime - startTime;
      expect(publishTime).toBeLessThan(2000); // Should publish in under 2 seconds
    });

    test('should handle rapid publishing', async () => {
      const noteCount = 5;

      for (let i = 0; i < noteCount; i++) {
        await page.click('text=Publish');
        await page.fill('textarea[placeholder*="message"], textarea[name="content"]', `Rapid test ${i + 1}`);
        await page.click('button:has-text("Publish"), button:has-text("Send")');
        await page.waitForTimeout(500);
      }

      // All events should be published
      const events = mockRelay.getAllEvents();
      expect(events.length).toBe(noteCount);
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard accessible', async () => {
      await page.click('text=Publish');

      // Tab to textarea
      await page.keyboard.press('Tab');
      await page.keyboard.type('Keyboard test note');

      // Tab to publish button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      await expect(page.getByText(/published|sent successfully/i)).toBeVisible({ timeout: 10000 });
    });

    test('should have proper ARIA labels', async () => {
      await page.click('text=Publish');

      const textarea = page.locator('textarea[placeholder*="message"], textarea[name="content"]');
      await expect(textarea).toHaveAttribute('aria-label', /.+/);

      const publishButton = page.getByRole('button', { name: /publish|send/i });
      await expect(publishButton).toHaveAccessibleName();
    });

    test('should announce publish status to screen readers', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[placeholder*="message"], textarea[name="content"]', 'Screen reader test');
      await page.click('button:has-text("Publish"), button:has-text("Send")');

      // Status message should have aria-live
      const statusElement = page.locator('[role="status"], [aria-live="polite"]');
      await expect(statusElement).toBeVisible({ timeout: 10000 });
    });
  });
});
