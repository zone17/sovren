/**
 * Content Shield Dashboard E2E spec — authenticated tests.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 3 tests:
 *   1. Dashboard loads with heading visible and no error boundary
 *   2. Copy Detection Alerts section heading is visible (always rendered as CardTitle)
 *   3. Shield page navigates to /shield URL
 */
import { expect, test } from '@playwright/test';
import { ShieldPage } from './pages/shield.page';

test.describe('Content Shield Dashboard', () => {
  let shieldPage: ShieldPage;

  test.beforeEach(async ({ page }) => {
    shieldPage = new ShieldPage(page);
    await shieldPage.goto();
  });

  test('dashboard loads with key sections visible', async () => {
    await expect(shieldPage.heading).toBeVisible();
    await expect(shieldPage.errorBoundary).not.toBeVisible();
  });

  test('copy detection alerts section is visible on the dashboard', async () => {
    // AlertsFeed renders as a card with CardTitle "Copy Detection Alerts".
    // The title is always visible regardless of loading or error state
    // because the CardHeader is always rendered.
    await expect(shieldPage.alertsHeading).toBeVisible();
  });

  test('navigates to the /shield route', async ({ page }) => {
    await expect(page).toHaveURL(/\/shield/);
  });
});
