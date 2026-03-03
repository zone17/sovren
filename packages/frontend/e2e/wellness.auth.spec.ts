/**
 * Wellness Dashboard E2E spec — authenticated tests.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 4 tests:
 *   1. Dashboard loads with key components visible
 *   2. Pulse check-in opens modal
 *   3. Boundary settings section is visible and accessible
 *   4. Heatmap period toggle is present
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
    // Boundary settings renders as a section/card on the page.
    // Verify the section heading is visible without relying on specific locators
    // that depend on implementation detail (avoids brittle selectors).
    const boundaryHeading = wellnessPage.page
      .getByRole('heading', { name: /boundary|boundaries|work boundaries/i })
      .first();
    await expect(boundaryHeading).toBeVisible();
  });

  test('heatmap period toggle is present on the dashboard', async () => {
    // Work Pattern Heatmap renders a period selector (7d / 30d buttons or tabs).
    const periodSelector = wellnessPage.page
      .getByRole('button', { name: /7d|30d|7 days|30 days/i })
      .first();
    await expect(periodSelector).toBeVisible();
  });
});
