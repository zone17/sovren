/**
 * 🔐 E2E Tests: Encrypted Direct Messages
 * Tests NIP-04 encrypted DM sending, receiving, and decryption
 */
import { test, expect, Page } from '@playwright/test';
import { NostrRelayMock } from './fixtures/relay-mock';
import { ALICE, BOB, CHARLIE } from './fixtures/test-users';
import { createEncryptedDM } from './fixtures/test-events';

test.describe('NOSTR Encrypted DMs E2E Tests', () => {
  let page: Page;
  let mockRelay: NostrRelayMock;

  test.beforeAll(async () => {
    mockRelay = new NostrRelayMock({ port: 7030 });
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
    await page.fill('input[placeholder*="relay"]', 'ws://localhost:7030');
    await page.click('button:has-text("Connect")');
    await page.waitForTimeout(2000);
  });

  test.describe('Sending Encrypted DMs', () => {
    test('should send encrypted DM successfully', async () => {
      await page.click('text=Messages');

      // Start new conversation
      await page.click('button:has-text("New Message")');
      await page.fill('input[placeholder*="recipient"], input[name="recipient"]', BOB.npub);
      await page.fill('textarea[placeholder*="message"], textarea[name="message"]', 'Hello Bob, this is encrypted!');

      await page.click('button:has-text("Send")');

      await expect(page.getByText(/sent|delivered/i)).toBeVisible({ timeout: 10000 });

      // Verify encrypted event was sent to relay
      const events = mockRelay.getAllEvents();
      const dmEvent = events.find(e => e.kind === 4);
      expect(dmEvent).toBeDefined();
      expect(dmEvent!.tags.some(tag => tag[0] === 'p' && tag[1] === BOB.publicKey)).toBeTruthy();

      // Content should be encrypted (not plaintext)
      expect(dmEvent!.content).not.toContain('Hello Bob');
      expect(dmEvent!.content).toMatch(/\?iv=/); // NIP-04 format
    });

    test('should encrypt DM content properly', async () => {
      await page.click('text=Messages');

      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', BOB.npub);
      await page.fill('textarea[name="message"]', 'Secret message 🔒');

      await page.click('button:has-text("Send")');
      await page.waitForTimeout(2000);

      const events = mockRelay.getAllEvents();
      const dmEvent = events.find(e => e.kind === 4);

      // Encrypted content format check
      expect(dmEvent!.content).toContain('?iv=');
      expect(dmEvent!.content).not.toContain('Secret message');
      expect(dmEvent!.content).not.toContain('🔒');
    });

    test('should send DM with emojis', async () => {
      await page.click('text=Messages');

      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', BOB.npub);
      await page.fill('textarea[name="message"]', 'Test with emojis 🚀🔥💪');

      await page.click('button:has-text("Send")');

      await expect(page.getByText(/sent/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('🚀🔥💪')).toBeVisible(); // Should display in UI
    });

    test('should send DM with special characters', async () => {
      const specialMessage = 'Special chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';

      await page.click('text=Messages');
      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', BOB.npub);
      await page.fill('textarea[name="message"]', specialMessage);

      await page.click('button:has-text("Send")');

      await expect(page.getByText(/sent/i)).toBeVisible({ timeout: 10000 });
    });

    test('should send long DM', async () => {
      const longMessage = 'a'.repeat(5000);

      await page.click('text=Messages');
      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', BOB.npub);
      await page.fill('textarea[name="message"]', longMessage);

      await page.click('button:has-text("Send")');

      await expect(page.getByText(/sent/i)).toBeVisible({ timeout: 10000 });
    });

    test('should validate recipient public key', async () => {
      await page.click('text=Messages');

      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', 'invalid-key');
      await page.fill('textarea[name="message"]', 'Test message');

      await page.click('button:has-text("Send")');

      await expect(page.getByText(/invalid|public key/i)).toBeVisible({ timeout: 5000 });
    });

    test('should not send empty DM', async () => {
      await page.click('text=Messages');

      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', BOB.npub);

      await page.click('button:has-text("Send")');

      await expect(page.getByText(/empty|required/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Receiving and Decrypting DMs', () => {
    test('should receive and decrypt incoming DM', async () => {
      // Create encrypted DM from Bob to Alice
      const encryptedDM = await createEncryptedDM(BOB, ALICE.publicKey, 'Hello Alice from Bob!');

      // Inject the event
      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, encryptedDM);

      await page.click('text=Messages');

      // Should see decrypted message
      await expect(page.getByText('Hello Alice from Bob!')).toBeVisible({ timeout: 5000 });
    });

    test('should show sender information', async () => {
      const dm = await createEncryptedDM(BOB, ALICE.publicKey, 'Test sender info');

      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, dm);

      await page.click('text=Messages');

      // Should show sender's public key or name
      await expect(page.getByText(BOB.publicKey.slice(0, 8))).toBeVisible();
    });

    test('should display timestamp', async () => {
      const dm = await createEncryptedDM(BOB, ALICE.publicKey, 'Timestamp test');

      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, dm);

      await page.click('text=Messages');

      // Should show relative time
      await expect(page.getByText(/just now|seconds ago|minutes ago/i)).toBeVisible();
    });

    test('should group messages by conversation', async () => {
      // Send multiple messages from Bob
      const dm1 = await createEncryptedDM(BOB, ALICE.publicKey, 'Message 1');
      const dm2 = await createEncryptedDM(BOB, ALICE.publicKey, 'Message 2');
      const dm3 = await createEncryptedDM(CHARLIE, ALICE.publicKey, 'Message from Charlie');

      for (const dm of [dm1, dm2, dm3]) {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
        }, dm);
      }

      await page.click('text=Messages');

      // Should have 2 conversations (Bob and Charlie)
      const conversations = await page.locator('[data-conversation]').count();
      expect(conversations).toBe(2);
    });

    test('should sort conversations by latest message', async () => {
      const dm1 = await createEncryptedDM(BOB, ALICE.publicKey, 'Older message');
      await page.waitForTimeout(1000);
      const dm2 = await createEncryptedDM(CHARLIE, ALICE.publicKey, 'Newer message');

      for (const dm of [dm1, dm2]) {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
        }, dm);
      }

      await page.click('text=Messages');

      // Charlie's conversation should be first (newer)
      const firstConversation = page.locator('[data-conversation]:first-child');
      await expect(firstConversation).toContainText('Newer message');
    });
  });

  test.describe('DM Threading', () => {
    test('should maintain conversation thread', async () => {
      await page.click('text=Messages');

      // Send initial message
      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', BOB.npub);
      await page.fill('textarea[name="message"]', 'Initial message');
      await page.click('button:has-text("Send")');
      await page.waitForTimeout(2000);

      // Reply in same thread
      await page.fill('textarea[name="message"]', 'Follow-up message');
      await page.click('button:has-text("Send")');

      // Both messages should appear in same conversation
      await expect(page.getByText('Initial message')).toBeVisible();
      await expect(page.getByText('Follow-up message')).toBeVisible();
    });

    test('should show message status (sending, sent, failed)', async () => {
      await page.click('text=Messages');

      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', BOB.npub);
      await page.fill('textarea[name="message"]', 'Status test');

      // Click send
      await page.click('button:has-text("Send")');

      // Should show sending status
      await expect(page.locator('[data-message-status="sending"]')).toBeVisible();

      // Then sent status
      await expect(page.locator('[data-message-status="sent"]')).toBeVisible({ timeout: 10000 });
    });

    test('should support read receipts', async () => {
      const dm = await createEncryptedDM(BOB, ALICE.publicKey, 'Read receipt test');

      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, dm);

      await page.click('text=Messages');

      // Open conversation marks as read
      await page.click('[data-conversation]:first-child');

      // Should show read indicator
      await expect(page.locator('[data-message-read="true"]')).toBeVisible();
    });
  });

  test.describe('Conversation Management', () => {
    test('should delete conversation', async () => {
      const dm = await createEncryptedDM(BOB, ALICE.publicKey, 'To be deleted');

      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, dm);

      await page.click('text=Messages');

      // Delete conversation
      await page.click('[data-conversation]:first-child button[aria-label*="More"]');
      await page.click('text=Delete Conversation');
      await page.click('button:has-text("Confirm")');

      // Conversation should be removed
      await expect(page.getByText('To be deleted')).not.toBeVisible();
    });

    test('should search conversations', async () => {
      // Create multiple conversations
      const dm1 = await createEncryptedDM(BOB, ALICE.publicKey, 'Search keyword test');
      const dm2 = await createEncryptedDM(CHARLIE, ALICE.publicKey, 'Other message');

      for (const dm of [dm1, dm2]) {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
        }, dm);
      }

      await page.click('text=Messages');

      // Search for keyword
      await page.fill('input[placeholder*="search"], input[name="search"]', 'keyword');

      // Should filter conversations
      await expect(page.getByText('Search keyword test')).toBeVisible();
      await expect(page.getByText('Other message')).not.toBeVisible();
    });

    test('should mute conversation', async () => {
      const dm = await createEncryptedDM(BOB, ALICE.publicKey, 'Mute test');

      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, dm);

      await page.click('text=Messages');

      // Mute conversation
      await page.click('[data-conversation]:first-child button[aria-label*="More"]');
      await page.click('text=Mute');

      // Should show muted indicator
      await expect(page.locator('[data-conversation-muted="true"]')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle decryption failure', async () => {
      // Create DM with corrupted encryption
      const corruptedDM = await createEncryptedDM(BOB, CHARLIE.publicKey, 'Not for Alice');

      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, corruptedDM);

      await page.click('text=Messages');

      // Should show decryption error
      await expect(page.getByText(/decrypt|error/i)).toBeVisible();
    });

    test('should retry failed send', async () => {
      // Disconnect relay to cause failure
      await page.click('text=Relays');
      await page.click('button:has-text("Disconnect")');
      await page.waitForTimeout(1000);

      await page.click('text=Messages');
      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', BOB.npub);
      await page.fill('textarea[name="message"]', 'Will fail');
      await page.click('button:has-text("Send")');

      // Should show failed status
      await expect(page.locator('[data-message-status="failed"]')).toBeVisible({ timeout: 10000 });

      // Retry
      await page.click('button:has-text("Retry")');

      // Should attempt to resend
      await expect(page.locator('[data-message-status="sending"]')).toBeVisible();
    });

    test('should handle network interruption gracefully', async () => {
      await page.click('text=Messages');

      // Start sending
      await page.click('button:has-text("New Message")');
      await page.fill('input[name="recipient"]', BOB.npub);
      await page.fill('textarea[name="message"]', 'Network test');

      // Simulate network going offline
      await page.context().setOffline(true);

      await page.click('button:has-text("Send")');

      // Should show offline error
      await expect(page.getByText(/offline|network/i)).toBeVisible({ timeout: 10000 });

      // Restore network
      await page.context().setOffline(false);
    });
  });

  test.describe('Performance', () => {
    test('should handle large conversation efficiently', async () => {
      // Create many messages
      for (let i = 0; i < 50; i++) {
        const dm = await createEncryptedDM(BOB, ALICE.publicKey, `Message ${i + 1}`);
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
        }, dm);
      }

      await page.click('text=Messages');
      await page.click('[data-conversation]:first-child');

      // Should load quickly and be scrollable
      await expect(page.locator('[data-message-item]')).toHaveCount(50, { timeout: 10000 });

      // Scroll should be smooth
      const messageContainer = page.locator('[data-messages-container]');
      await messageContainer.evaluate(el => el.scrollTop = el.scrollHeight);

      await page.waitForTimeout(1000);
      expect(await messageContainer.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    });

    test('should decrypt messages quickly', async () => {
      const startTime = Date.now();

      const dm = await createEncryptedDM(BOB, ALICE.publicKey, 'Decryption speed test');
      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, dm);

      await page.click('text=Messages');

      // Should decrypt and display quickly
      await expect(page.getByText('Decryption speed test')).toBeVisible({ timeout: 5000 });

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(5000); // Should decrypt in under 5 seconds
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      const dm = await createEncryptedDM(BOB, ALICE.publicKey, 'Keyboard test');

      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, dm);

      await page.click('text=Messages');

      // Navigate with keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Open conversation

      // Type reply
      await page.keyboard.type('Keyboard reply');
      await page.keyboard.press('Enter'); // Send

      await expect(page.getByText('Keyboard reply')).toBeVisible({ timeout: 10000 });
    });

    test('should have proper ARIA labels', async () => {
      await page.click('text=Messages');

      const messageList = page.locator('[role="list"], [aria-label*="messages"]');
      await expect(messageList).toBeVisible();

      const sendButton = page.getByRole('button', { name: /send/i });
      await expect(sendButton).toHaveAccessibleName();
    });

    test('should announce new messages to screen readers', async () => {
      const dm = await createEncryptedDM(BOB, ALICE.publicKey, 'Screen reader test');

      await page.click('text=Messages');

      await page.evaluate((evt) => {
        window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
      }, dm);

      // Should have aria-live region
      const liveRegion = page.locator('[aria-live="polite"]');
      await expect(liveRegion).toBeVisible();
    });
  });
});
