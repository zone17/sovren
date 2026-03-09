import { expect, test } from '@playwright/test';
import { ProfileDashboardPage } from './pages/profile-dashboard.page';

test.describe('Profile Dashboard — Sovereign Profile', () => {
  let profile: ProfileDashboardPage;

  test.beforeEach(async ({ page }) => {
    profile = new ProfileDashboardPage(page);
    await profile.goto();
  });

  test('profile dashboard page loads with heading or profile content', async ({ page }) => {
    await expect(page).toHaveURL(/\/profile-dashboard/);

    // Without a saved profile in localStorage (public/unauthenticated),
    // the page shows "No Profile Found" instead of "Your Sovereign Profile".
    // Accept either state as valid.
    const hasProfile = await profile.heading.isVisible().catch(() => false);
    const hasNoProfile = await profile.noProfileHeading.isVisible().catch(() => false);

    expect(hasProfile || hasNoProfile).toBe(true);
  });
});
