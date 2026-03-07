import { expect, test } from '@playwright/test';
import { NotificationsPage } from './pages/notifications.page';

test.describe('Notifications — Flyout Panel', () => {
  let notifications: NotificationsPage;

  test.beforeEach(async ({ page }) => {
    notifications = new NotificationsPage(page);
    await notifications.goto();
  });

  test('bell button visible in nav', async () => {
    await expect(notifications.bellButton).toBeVisible();
  });

  test('click bell opens notification panel dialog', async () => {
    await notifications.openPanel();
    await expect(notifications.panel).toBeVisible();
    await expect(notifications.bellButton).toHaveAttribute('aria-expanded', 'true');
  });

  test('close button closes panel', async () => {
    await notifications.openPanel();
    await notifications.closePanel();
    await expect(notifications.panel).not.toBeVisible();
  });

  test('empty state visible in demo mode', async () => {
    await notifications.openPanel();
    await expect(notifications.emptyState).toBeVisible();
  });

  test('filter tabs are clickable without error', async () => {
    await notifications.openPanel();
    await expect(notifications.filterAll).toBeVisible();
    await notifications.filterMentions.click();
    await notifications.filterReplies.click();
    await notifications.filterReactions.click();
    await notifications.filterMessages.click();
    await notifications.filterZaps.click();
    await notifications.filterAll.click();
    // Panel still visible after clicking all filters
    await expect(notifications.panel).toBeVisible();
  });
});
