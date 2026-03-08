import { expect, test } from '@playwright/test';
import { LightningOnboardingPage } from './pages/lightning-onboarding.page';

// TODO #691: Expand when onboarding wizard stabilizes. Current smoke coverage
// (heading + button visible) is acceptable for first pass.
// Consolidate 3 spec files into 1 with describe blocks when expanding.
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
