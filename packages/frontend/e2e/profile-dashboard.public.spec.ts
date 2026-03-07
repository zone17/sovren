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
    await expect(profile.heading).toBeVisible();
  });
});
