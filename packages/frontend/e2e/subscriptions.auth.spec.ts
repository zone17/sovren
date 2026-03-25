import { expect, test } from '@playwright/test';
import { SubscriptionsPage } from './pages/subscriptions.page';

test.describe('Subscriptions — Subscription Management', () => {
  let subscriptions: SubscriptionsPage;

  test.beforeEach(async ({ page }) => {
    subscriptions = new SubscriptionsPage(page);
    await subscriptions.goto();

    // Wait for SPA to settle — either subscriptions heading loads or auth redirect fires
    await Promise.race([
      subscriptions.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
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
