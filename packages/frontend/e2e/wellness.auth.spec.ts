/**
 * Wellness Dashboard E2E spec — authenticated tests.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 4 tests:
 *   1. Dashboard loads with key components visible
 *   2. Pulse check-in opens modal
 *   3. Boundary settings section is visible
 *   4. Work activity heatmap section is visible
 */
import { expect, test } from '@playwright/test';
import { WellnessPage } from './pages/wellness.page';

test.describe('Wellness Dashboard', () => {
  let wellnessPage: WellnessPage;

  test.beforeEach(async ({ page }) => {
    wellnessPage = new WellnessPage(page);
    await wellnessPage.goto();
  });

  test('dashboard loads with all key components visible', async () => {
    await expect(wellnessPage.heading).toBeVisible();
    await expect(wellnessPage.subheading).toBeVisible();
    await expect(wellnessPage.pulseCheckInButton).toBeVisible();
    // No error boundary should appear
    await expect(wellnessPage.errorBoundary).not.toBeVisible();
  });

  test('pulse check-in button opens modal', async () => {
    await wellnessPage.openPulseModal();
    await expect(wellnessPage.pulseModal).toBeVisible();
  });

  test('boundary settings section is visible on the dashboard', async () => {
    // Boundary settings renders as a card with its title always visible
    // (even in loading/error states when no backend is running).
    const boundaryHeading = wellnessPage.page.getByRole('heading', { name: /boundaries/i }).first();
    await expect(boundaryHeading).toBeVisible();
  });

  test('work activity heatmap section is visible on the dashboard', async () => {
    // Work Pattern Heatmap renders as a card. The title is always visible;
    // period toggle buttons (7d/30d) only appear when the API returns data.
    const heatmapHeading = wellnessPage.page
      .getByRole('heading', { name: /work activity/i })
      .first();
    await expect(heatmapHeading).toBeVisible();
  });
});
