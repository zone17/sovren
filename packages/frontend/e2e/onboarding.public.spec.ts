import { expect, test } from '@playwright/test';
import { OnboardingPage } from './pages/onboarding.page';

test.describe('Onboarding — Sovereign Onboarding Wizard', () => {
  let onboarding: OnboardingPage;

  test.beforeEach(async ({ page }) => {
    onboarding = new OnboardingPage(page);
    await onboarding.goto();
  });

  test('onboarding page loads with welcome heading', async () => {
    await expect(onboarding.heading).toBeVisible();
  });

  test('begin button is visible', async () => {
    await expect(onboarding.beginButton).toBeVisible();
  });
});
