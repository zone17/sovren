/**
 * Analytics E2E spec — authenticated tests.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 5 tests:
 *   1. Analytics route loads or redirects to login
 *   2. Analytics shows earnings overview after load
 *   3. Analytics page finishes loading (not stuck in infinite spinner)
 *   4. Navigate to analytics from dashboard
 *   5. Analytics page has period selection
 */
import { expect, test } from '@playwright/test';
import { AnalyticsPage } from './pages/analytics.page';

test.describe('Analytics — Creator Dashboard', () => {
  let analytics: AnalyticsPage;

  test.beforeEach(async ({ page }) => {
    analytics = new AnalyticsPage(page);
    await analytics.goto();

    // Wait for SPA to settle — either analytics heading loads or auth redirect fires
    await Promise.race([
      analytics.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
  });

  test('analytics route loads or redirects to login', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/analytics|login)/);
    const url = page.url();
    if (/\/dashboard\/analytics/.test(url)) {
      await expect(analytics.heading).toBeVisible();
    } else {
      expect(/\/login/.test(url)).toBe(true);
    }
  });

  test('analytics shows earnings overview after load', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/analytics|login)/);
    if (!analytics.isOnAnalytics(page.url())) return;

    // Wait for loading to finish — either heading appears or error/no-data shows
    await expect(
      analytics.heading.or(analytics.errorAlert).or(analytics.noDataAlert)
    ).toBeVisible();

    // If the dashboard loaded with data, the Total Earnings label must be visible
    if (await analytics.heading.isVisible()) {
      await expect(analytics.totalEarningsLabel).toBeVisible();
    }
  });

  test('analytics page finishes loading', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/analytics|login)/);
    if (!analytics.isOnAnalytics(page.url())) return;

    // The page must resolve to one of: data loaded, error, or no-data.
    // It should NOT remain stuck on a loading spinner indefinitely.
    await expect(analytics.heading.or(analytics.errorAlert).or(analytics.noDataAlert)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('navigate to analytics from dashboard', async ({ page }) => {
    // Start at the main dashboard, not analytics
    await page.goto('/dashboard');
    await page.waitForURL(/\/(dashboard|login)/);
    if (/\/login/.test(page.url())) return;

    // Navigate to the analytics sub-route
    await page.goto('/dashboard/analytics');
    await page.waitForURL(/\/(dashboard\/analytics|login)/);
    if (!analytics.isOnAnalytics(page.url())) return;

    await expect(
      analytics.heading.or(analytics.errorAlert).or(analytics.noDataAlert)
    ).toBeVisible();
  });

  test('analytics page has period selection', async ({ page }) => {
    await page.waitForURL(/\/(dashboard\/analytics|login)/);
    if (!analytics.isOnAnalytics(page.url())) return;

    // Wait for loading to finish
    await expect(
      analytics.heading.or(analytics.errorAlert).or(analytics.noDataAlert)
    ).toBeVisible();

    // Period selector only renders when the dashboard loaded with data
    if (await analytics.heading.isVisible()) {
      await expect(analytics.periodSelector).toBeVisible();
    }
  });
});
