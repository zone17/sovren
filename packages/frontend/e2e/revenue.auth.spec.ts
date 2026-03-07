import { expect, test } from '@playwright/test';
import { RevenuePage } from './pages/revenue.page';

test.describe('Revenue — Revenue Analytics', () => {
  let revenue: RevenuePage;

  test.beforeEach(async ({ page }) => {
    revenue = new RevenuePage(page);
    await revenue.goto();
  });

  test('revenue route loads or redirects to login', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/revenue|login)/);
    const url = page.url();
    expect(/\/(dashboard\/revenue|login)/.test(url)).toBe(true);
  });
});
