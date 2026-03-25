import { expect, test } from '@playwright/test';
import { NostrOnboardingPage } from './pages/nostr-onboarding.page';

// TODO #691: Expand when onboarding wizard stabilizes. Current smoke coverage
// (heading + button visible) is acceptable for first pass.
// Consolidate 3 spec files into 1 with describe blocks when expanding.
test.describe('Nostr Onboarding — Key Generation', () => {
  let nostr: NostrOnboardingPage;

  test.beforeEach(async ({ page }) => {
    nostr = new NostrOnboardingPage(page);
    await nostr.goto();
  });

  test('nostr onboarding page loads with heading', async () => {
    await expect(nostr.heading).toBeVisible();
  });

  test('begin button is visible', async () => {
    await expect(nostr.beginButton).toBeVisible();
  });
});
