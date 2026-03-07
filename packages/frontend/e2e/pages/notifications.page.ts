/**
 * Notifications Page Object Model — Tasks #26, #28
 * Slice 8: Creator Network + Notifications
 *
 * The notification center lives in the app-shell header as a dropdown panel.
 * Bell icon → opens panel with two tabs: "Activity" (server) | "Nostr" (relay).
 *
 * This POM covers:
 * - Bell icon with unread badge
 * - Opening/closing the notification panel
 * - Notification list items
 * - Mark-all-read button
 * - Empty state message
 * - Tab switching (Activity / Nostr)
 */

import type { Locator, Page } from '@playwright/test';

export class NotificationsPage {
  readonly page: Page;

  // ── Header bell trigger ──────────────────────────────────────────────────────
  readonly bellButton: Locator;
  readonly unreadBadge: Locator;

  // ── Notification panel (dropdown) ───────────────────────────────────────────
  readonly panel: Locator;

  // ── Tabs inside panel ───────────────────────────────────────────────────────
  readonly activityTab: Locator;
  readonly nostrTab: Locator;

  // ── Notification list + items ────────────────────────────────────────────────
  readonly notificationList: Locator;

  // ── Actions ─────────────────────────────────────────────────────────────────
  readonly markAllReadButton: Locator;

  // ── Empty state ──────────────────────────────────────────────────────────────
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Bell icon button in header — aria-label "Notifications" or "Open notifications"
    this.bellButton = page.getByRole('button', { name: /notifications/i }).first();

    // Unread badge — numeric badge element near the bell
    this.unreadBadge = page.getByRole('status', { name: /unread notifications/i }).first();

    // Notification dropdown panel — aria role="region" or "dialog"
    this.panel = page.getByRole('region', { name: /notification/i }).first();

    // Tabs inside the panel
    this.activityTab = page.getByRole('tab', { name: /activity/i }).first();
    this.nostrTab = page.getByRole('tab', { name: /nostr/i }).first();

    // Notification list
    this.notificationList = page.getByRole('list', { name: /notifications/i }).first();

    // Mark all read
    this.markAllReadButton = page.getByRole('button', { name: /mark all (as )?read/i }).first();

    // Empty state message
    this.emptyState = page.getByText(/no notifications yet/i).first();
  }

  /**
   * Navigate to a page that shows the header (any authenticated page),
   * then open the notification panel.
   */
  async openPanel() {
    await this.bellButton.click();
    await this.panel.waitFor({ state: 'visible' });
  }

  /**
   * Close the notification panel by clicking the bell button again.
   */
  async closePanel() {
    await this.bellButton.click();
    await this.panel.waitFor({ state: 'hidden' });
  }

  /**
   * Switch to the Activity (server notifications) tab.
   */
  async switchToActivity() {
    await this.activityTab.click();
  }

  /**
   * Get all notification list items currently visible.
   */
  async getNotificationItems(): Promise<Locator[]> {
    const items = this.notificationList.getByRole('listitem');
    const count = await items.count();
    return Array.from({ length: count }, (_, i) => items.nth(i));
  }

  /**
   * Read the numeric unread count from the badge.
   * Returns 0 if badge is not visible.
   */
  async getUnreadCount(): Promise<number> {
    const isVisible = await this.unreadBadge.isVisible();
    if (!isVisible) return 0;
    const text = await this.unreadBadge.textContent();
    const num = parseInt(text ?? '0', 10);
    return isNaN(num) ? 0 : num;
  }
}
