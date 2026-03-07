import { expect, test } from '@playwright/test';
import { LightningOnboardingPage } from './pages/lightning-onboarding.page';

test.describe('Lightning Onboarding — Wallet Setup', () => {
  let lightning: LightningOnboardingPage;

  test.beforeEach(async ({ page }) => {
    lightning = new LightningOnboardingPage(page);
    await lightning.goto();
  });

  test('lightning onboarding page loads with heading', async () => {
    await expect(lightning.heading).toBeVisible();
  });

  test('get started button is visible', async () => {
    await expect(lightning.getStartedButton).toBeVisible();
  });
});
