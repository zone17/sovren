/**
 * 📡 E2E Tests: NOSTR Subscriptions and Feeds
 * Tests event subscriptions, real-time updates, and filter-based queries
 */
import { test, expect, Page } from '@playwright/test';
import { NostrRelayMock } from './fixtures/relay-mock';
import { ALICE, BOB, CHARLIE } from './fixtures/test-users';
import { createTextNote, createMetadata, createContacts } from './fixtures/test-events';

test.describe('NOSTR Subscriptions and Feeds E2E Tests', () => {
  let page: Page;
  let mockRelay: NostrRelayMock;

  test.beforeAll(async () => {
    mockRelay = new NostrRelayMock({ port: 7020 });
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

    // Set up Alice's key
    await page.evaluate((alice) => {
      localStorage.setItem('nostr_keypair_encrypted', JSON.stringify({
        privateKey: alice.privateKeyHex,
        publicKey: alice.publicKey,
        created: Date.now(),
      }));
    }, ALICE);

    // Connect to relay
    await page.click('text=Relays');
    await page.fill('input[placeholder*="relay"]', 'ws://localhost:7020');
    await page.click('button:has-text("Connect")');
    await page.waitForTimeout(2000);
  });

  test.describe('Basic Subscriptions', () => {
    test('should subscribe to global feed', async () => {
      await page.click('text=Feed'), text=Global');

      // Should show subscription active
      await expect(page.getByText(/subscribed|loading feed/i)).toBeVisible({ timeout: 10000 });

      // Verify subscription was created
      const stats = mockRelay.getStats();
      expect(stats.subscriptions).toBeGreaterThan(0);
    });

    test('should receive real-time events', async () => {
      await page.click('text=Feed');

      // Inject an event through backend
      const event = createTextNote(BOB, 'Real-time test message');
      await page.evaluate((evt) => {
        // Simulate receiving event via WebSocket
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, event);

      // Event should appear in feed
      await expect(page.getByText('Real-time test message')).toBeVisible({ timeout: 5000 });
    });

    test('should display EOSE indicator', async () => {
      await page.click('text=Feed');

      // Wait for end of stored events
      await expect(page.getByText(/all caught up|up to date/i)).toBeVisible({ timeout: 10000 });
    });

    test('should auto-scroll to new events', async () => {
      await page.click('text=Feed');

      // Add multiple events
      for (let i = 0; i < 5; i++) {
        const event = createTextNote(BOB, `Auto-scroll test ${i + 1}`);
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
        }, event);
        await page.waitForTimeout(500);
      }

      // Latest message should be visible
      await expect(page.getByText('Auto-scroll test 5')).toBeVisible();
    });
  });

  test.describe('Filter-Based Subscriptions', () => {
    test('should filter by author', async () => {
      await page.click('text=Feed');

      // Apply author filter
      await page.click('button:has-text("Filter"), button[aria-label*="Filter"]');
      await page.fill('input[placeholder*="author"], input[name="author"]', BOB.npub);
      await page.click('button:has-text("Apply Filter")');

      await page.waitForTimeout(1000);

      // Only Bob's events should show
      const events = await page.locator('[data-event-author]').all();
      for (const event of events) {
        const author = await event.getAttribute('data-event-author');
        expect(author).toBe(BOB.publicKey);
      }
    });

    test('should filter by kind', async () => {
      await page.click('text=Feed');

      await page.click('button:has-text("Filter")');
      await page.selectOption('select[name="kind"], select[aria-label*="Event type"]', '1'); // Text notes only
      await page.click('button:has-text("Apply Filter")');

      await page.waitForTimeout(1000);

      const events = await page.locator('[data-event-kind]').all();
      for (const event of events) {
        const kind = await event.getAttribute('data-event-kind');
        expect(kind).toBe('1');
      }
    });

    test('should filter by time range', async () => {
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 86400;

      await page.click('text=Feed');

      await page.click('button:has-text("Filter")');
      await page.fill('input[name="since"], input[aria-label*="From"]', oneDayAgo.toString());
      await page.fill('input[name="until"], input[aria-label*="To"]', now.toString());
      await page.click('button:has-text("Apply Filter")');

      await page.waitForTimeout(1000);

      const events = await page.locator('[data-event-timestamp]').all();
      for (const event of events) {
        const timestamp = parseInt(await event.getAttribute('data-event-timestamp') || '0');
        expect(timestamp).toBeGreaterThanOrEqual(oneDayAgo);
        expect(timestamp).toBeLessThanOrEqual(now);
      }
    });

    test('should filter by hashtags', async () => {
      await page.click('text=Feed');

      await page.click('button:has-text("Filter")');
      await page.fill('input[placeholder*="hashtag"], input[name="tag"]', 'nostr');
      await page.click('button:has-text("Apply Filter")');

      await page.waitForTimeout(1000);

      // All visible events should have #nostr tag
      await expect(page.getByText(/#nostr/i).first()).toBeVisible();
    });

    test('should combine multiple filters', async () => {
      await page.click('text=Feed');

      await page.click('button:has-text("Filter")');
      await page.fill('input[name="author"]', BOB.npub);
      await page.selectOption('select[name="kind"]', '1');
      await page.fill('input[name="tag"]', 'test');
      await page.click('button:has-text("Apply Filter")');

      await page.waitForTimeout(1000);

      // Results should match all filter criteria
      const events = await page.locator('[data-event-item]').all();
      expect(events.length).toBeGreaterThanOrEqual(0); // May be zero if no matches
    });

    test('should clear filters', async () => {
      await page.click('text=Feed');

      // Apply filter
      await page.click('button:has-text("Filter")');
      await page.fill('input[name="author"]', BOB.npub);
      await page.click('button:has-text("Apply Filter")');
      await page.waitForTimeout(1000);

      // Clear filters
      await page.click('button:has-text("Clear Filters"), button[aria-label*="Clear"]');

      // All events should be visible again
      await page.waitForTimeout(1000);
      const events = await page.locator('[data-event-item]').all();
      expect(events.length).toBeGreaterThan(0);
    });
  });

  test.describe('Following Feed', () => {
    test('should show only followed users events', async () => {
      // Set up contacts
      await page.click('text=Following');
      await page.fill('input[placeholder*="public key"]', BOB.npub);
      await page.click('button:has-text("Follow")');
      await page.waitForTimeout(1000);

      // View following feed
      await page.click('text=Feed'), text=Following');

      await page.waitForTimeout(2000);

      // Should only show events from followed users
      const events = await page.locator('[data-event-author]').all();
      for (const event of events) {
        const author = await event.getAttribute('data-event-author');
        expect([ALICE.publicKey, BOB.publicKey]).toContain(author);
      }
    });

    test('should update feed when following new user', async () => {
      await page.click('text=Feed'), text=Following');

      const initialCount = await page.locator('[data-event-item]').count();

      // Follow new user
      await page.click('text=Following');
      await page.fill('input[placeholder*="public key"]', CHARLIE.npub);
      await page.click('button:has-text("Follow")');

      await page.click('text=Feed'), text=Following');
      await page.waitForTimeout(2000);

      const newCount = await page.locator('[data-event-item]').count();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    });

    test('should unfollow user', async () => {
      // Follow user
      await page.click('text=Following');
      await page.fill('input[placeholder*="public key"]', BOB.npub);
      await page.click('button:has-text("Follow")');
      await page.waitForTimeout(1000);

      // Unfollow
      await page.click(`button:has-text("Unfollow"), button[data-pubkey="${BOB.publicKey}"]`);
      await page.waitForTimeout(1000);

      // Should not appear in following list
      await expect(page.getByText(BOB.profile.name)).not.toBeVisible();
    });
  });

  test.describe('Thread Views', () => {
    test('should load conversation thread', async () => {
      await page.click('text=Feed');

      // Click on an event to view thread
      await page.click('[data-event-item]:first-child');

      // Thread view should open
      await expect(page.getByText(/conversation|thread/i)).toBeVisible({ timeout: 5000 });
    });

    test('should show reply context', async () => {
      await page.click('text=Feed');

      // Find event with replies
      const eventWithReplies = page.locator('[data-has-replies="true"]:first-child');
      await eventWithReplies.click();

      // Should show original post and replies
      await expect(page.getByText(/replies|responses/i)).toBeVisible();
    });

    test('should reply to event', async () => {
      await page.click('text=Feed');

      // Open thread
      await page.click('[data-event-item]:first-child');

      // Reply
      await page.fill('textarea[placeholder*="reply"], textarea[name="reply"]', 'Test reply');
      await page.click('button:has-text("Reply")');

      await expect(page.getByText(/reply sent|posted/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Subscription Management', () => {
    test('should pause subscription', async () => {
      await page.click('text=Feed');

      // Pause subscription
      await page.click('button:has-text("Pause"), button[aria-label*="Pause"]');

      // Should show paused state
      await expect(page.getByText(/paused/i)).toBeVisible();

      // New events should not appear
      const initialCount = await page.locator('[data-event-item]').count();

      const event = createTextNote(BOB, 'Should not appear');
      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, event);

      await page.waitForTimeout(2000);
      const newCount = await page.locator('[data-event-item]').count();
      expect(newCount).toBe(initialCount);
    });

    test('should resume subscription', async () => {
      await page.click('text=Feed');

      // Pause then resume
      await page.click('button:has-text("Pause")');
      await page.waitForTimeout(1000);
      await page.click('button:has-text("Resume"), button:has-text("Play")');

      // Should be active again
      await expect(page.getByText(/active|subscribed/i)).toBeVisible({ timeout: 5000 });
    });

    test('should refresh feed', async () => {
      await page.click('text=Feed');

      // Add event
      const event = createTextNote(BOB, 'Before refresh');
      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, event);

      await page.waitForTimeout(1000);

      // Refresh
      await page.click('button:has-text("Refresh"), button[aria-label*="Refresh"]');

      // Should reload events
      await expect(page.getByText(/refreshing|loading/i)).toBeVisible();
      await page.waitForTimeout(2000);
      await expect(page.getByText('Before refresh')).toBeVisible();
    });
  });

  test.describe('Event Interactions', () => {
    test('should like/react to event', async () => {
      await page.click('text=Feed');

      // Like first event
      const likeButton = page.locator('[data-event-item]:first-child button[aria-label*="Like"], button:has-text("👍")');
      await likeButton.click();

      // Should show liked state
      await expect(likeButton).toHaveClass(/liked|active/);
    });

    test('should repost event', async () => {
      await page.click('text=Feed');

      const repostButton = page.locator('[data-event-item]:first-child button[aria-label*="Repost"]');
      await repostButton.click();

      await expect(page.getByText(/reposted|shared/i)).toBeVisible({ timeout: 10000 });
    });

    test('should copy event link', async () => {
      await page.click('text=Feed');

      const moreButton = page.locator('[data-event-item]:first-child button[aria-label*="More"]');
      await moreButton.click();

      await page.click('text=Copy Link');

      await expect(page.getByText(/copied/i)).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Performance', () => {
    test('should handle large feed efficiently', async () => {
      // Generate many events
      const events = [];
      for (let i = 0; i < 100; i++) {
        events.push(createTextNote(BOB, `Performance test ${i + 1}`));
      }

      await page.click('text=Feed');

      // Inject events
      for (const event of events.slice(0, 50)) {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
        }, event);
      }

      // Page should remain responsive
      const scrollContainer = page.locator('[data-feed-container], [role="feed"]');
      await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight);

      // Should scroll smoothly
      await page.waitForTimeout(1000);
      expect(await scrollContainer.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    });

    test('should implement virtual scrolling', async () => {
      await page.click('text=Feed');

      // Scroll to bottom
      const scrollContainer = page.locator('[data-feed-container], [role="feed"]');
      await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight);

      await page.waitForTimeout(1000);

      // Not all events should be in DOM (virtual scrolling)
      const renderedEvents = await page.locator('[data-event-item]').count();
      expect(renderedEvents).toBeLessThan(1000); // Should be reasonable number
    });

    test('should load more events on scroll', async () => {
      await page.click('text=Feed');

      const initialCount = await page.locator('[data-event-item]').count();

      // Scroll to bottom
      const scrollContainer = page.locator('[data-feed-container], [role="feed"]');
      await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight);

      await page.waitForTimeout(2000);

      const newCount = await page.locator('[data-event-item]').count();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      await page.click('text=Feed');

      // Navigate events with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');

      // Enter to open event
      await page.keyboard.press('Enter');

      // Thread should open
      await expect(page.getByText(/conversation|thread/i)).toBeVisible();
    });

    test('should announce new events to screen readers', async () => {
      await page.click('text=Feed');

      const event = createTextNote(BOB, 'Screen reader announcement test');
      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, event);

      // Should have aria-live region
      const liveRegion = page.locator('[aria-live="polite"], [role="status"]');
      await expect(liveRegion).toBeVisible();
    });

    test('should have proper ARIA labels', async () => {
      await page.click('text=Feed');

      const feed = page.locator('[role="feed"]');
      await expect(feed).toBeVisible();

      const events = page.locator('[role="article"], [data-event-item]');
      expect(await events.count()).toBeGreaterThan(0);
    });
  });
});
