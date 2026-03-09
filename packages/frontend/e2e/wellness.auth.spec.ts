/**
 * Wellness Dashboard E2E spec — authenticated tests.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 6 tests:
 *   1. Dashboard loads with key components visible
 *   2. Pulse check-in opens modal
 *   3. Boundary settings section is visible
 *   4. Work activity heatmap section is visible
 *   5. Burnout risk gauge section is visible
 *   6. Pulse check-in modal can be closed with Escape
 */
import { expect, test } from '@playwright/test';
import { WellnessPage } from './pages/wellness.page';

test.describe('Wellness Dashboard', () => {
  let wellnessPage: WellnessPage;

  test.beforeEach(async ({ page }) => {
    wellnessPage = new WellnessPage(page);
    await wellnessPage.goto();

    // Wait for SPA to settle — either content renders or auth redirect fires
    await Promise.race([
      wellnessPage.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
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

  test('burnout risk gauge section is visible on the dashboard', async () => {
    await expect(wellnessPage.burnoutRiskHeading).toBeVisible();
  });

  test('pulse check-in modal can be closed with Escape', async () => {
    await wellnessPage.openPulseModal();
    await expect(wellnessPage.pulseModal).toBeVisible();
    await wellnessPage.page.keyboard.press('Escape');
    await expect(wellnessPage.pulseModal).not.toBeVisible();
  });
});
