import { expect, test } from '@playwright/test';
import { AnalyticsPage } from './pages/analytics.page';

test.describe('Analytics — Creator Dashboard', () => {
  let analytics: AnalyticsPage;

  test.beforeEach(async ({ page }) => {
    analytics = new AnalyticsPage(page);
    await analytics.goto();
  });

  test('analytics route loads or redirects to login', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/analytics|login)/);
    const url = page.url();
    expect(/\/(dashboard\/analytics|login)/.test(url)).toBe(true);
  });
});
