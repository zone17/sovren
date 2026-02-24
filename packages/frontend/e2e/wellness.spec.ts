import { test, expect } from '@playwright/test';
import { WellnessPage } from './pages/wellness.page';

test.describe('Wellness Dashboard (real backend)', () => {
  test('displays wellness heading and action button', async ({ page }) => {
    const wellnessPage = new WellnessPage(page);
    await wellnessPage.goto();

    await expect(wellnessPage.heading).toBeVisible();
    await expect(wellnessPage.subheading).toBeVisible();
    await expect(wellnessPage.pulseCheckInButton).toBeVisible();
  });

  test('renders wellness components without permanent loading state', async ({ page }) => {
    const wellnessPage = new WellnessPage(page);
    await wellnessPage.goto();

    // Page should render — not stuck in a loading state forever
    await expect(wellnessPage.heading).toBeVisible();

    // The wellness error boundary should NOT show a crash
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('pulse check-in button opens modal', async ({ page }) => {
    const wellnessPage = new WellnessPage(page);
    await wellnessPage.goto();

    await wellnessPage.pulseCheckInButton.click();

    // Modal should appear (WellnessPulseModal)
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
