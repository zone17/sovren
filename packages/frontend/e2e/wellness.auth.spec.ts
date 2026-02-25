import { expect, test } from '@playwright/test';
import { WellnessPage } from './pages/wellness.page';

test.describe('Wellness Dashboard', () => {
  let wellnessPage: WellnessPage;

  test.beforeEach(async ({ page }) => {
    wellnessPage = new WellnessPage(page);
    await wellnessPage.goto();
  });

  test('displays wellness heading and action button', async () => {
    await expect(wellnessPage.heading).toBeVisible();
    await expect(wellnessPage.subheading).toBeVisible();
    await expect(wellnessPage.pulseCheckInButton).toBeVisible();
  });

  test('renders wellness components without permanent loading state', async () => {
    await expect(wellnessPage.heading).toBeVisible();
    await expect(wellnessPage.errorBoundary).not.toBeVisible();
  });

  test('pulse check-in button opens modal', async () => {
    await wellnessPage.pulseCheckInButton.click();
    await expect(wellnessPage.page.getByRole('dialog')).toBeVisible();
  });
});
