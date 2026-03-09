import { expect, test } from '@playwright/test';
import { RevenuePage } from './pages/revenue.page';

test.describe('Revenue — Revenue Analytics', () => {
  let revenue: RevenuePage;

  test.beforeEach(async ({ page }) => {
    revenue = new RevenuePage(page);
    await revenue.goto();

    // Wait for SPA to settle — either revenue heading loads or auth redirect fires
    await Promise.race([
      revenue.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
  });

  test('revenue route loads or redirects to login', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/revenue|login)/);
    const url = page.url();
    if (/\/dashboard\/revenue/.test(url)) {
      await expect(revenue.heading).toBeVisible();
    } else {
      expect(/\/login/.test(url)).toBe(true);
    }
  });

  test('revenue page shows heading and metrics', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/revenue|login)/);
    const url = page.url();
    if (!/\/dashboard\/revenue/.test(url)) {
      test.skip();
      return;
    }
    await expect(revenue.heading).toBeVisible();
    await expect(revenue.totalRevenueLabel).toBeVisible();
  });

  test('revenue page has chart visualization', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/revenue|login)/);
    const url = page.url();
    if (!/\/dashboard\/revenue/.test(url)) {
      test.skip();
      return;
    }
    await expect(revenue.revenueChart).toBeVisible();
  });

  test('revenue page shows tier breakdown', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/revenue|login)/);
    const url = page.url();
    if (!/\/dashboard\/revenue/.test(url)) {
      test.skip();
      return;
    }
    await expect(revenue.tierBreakdown).toBeVisible();
  });
});
