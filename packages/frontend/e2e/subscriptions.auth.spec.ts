import { expect, test } from '@playwright/test';
import { SubscriptionsPage } from './pages/subscriptions.page';

test.describe('Subscriptions — Subscription Management', () => {
  let subscriptions: SubscriptionsPage;

  test.beforeEach(async ({ page }) => {
    subscriptions = new SubscriptionsPage(page);
    await subscriptions.goto();
  });

  test('subscriptions route loads or redirects to login', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/subscriptions|login)/);
    const url = page.url();
    if (/\/dashboard\/subscriptions/.test(url)) {
      await expect(subscriptions.heading).toBeVisible();
    } else {
      expect(/\/login/.test(url)).toBe(true);
    }
  });

  test('subscriptions page shows heading after load', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/subscriptions|login)/);
    const url = page.url();
    if (!/\/dashboard\/subscriptions/.test(url)) {
      test.skip();
      return;
    }
    await expect(subscriptions.heading).toBeVisible();
    await expect(subscriptions.heading).toContainText(/subscription management/i);
  });

  test('subscriptions page has management UI', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/subscriptions|login)/);
    const url = page.url();
    if (!/\/dashboard\/subscriptions/.test(url)) {
      test.skip();
      return;
    }
    await expect(subscriptions.createTierButton).toBeVisible();
    await expect(subscriptions.totalSubscribersCard).toBeVisible();
    await expect(subscriptions.tiersTab).toBeVisible();
  });
});
