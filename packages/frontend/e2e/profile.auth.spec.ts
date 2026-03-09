/**
 * Profile page E2E spec — authenticated tests.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 4 tests:
 *   1. Profile page loads with user heading
 *   2. Shows authentication section with NOSTR identity
 *   3. Logout button is visible and enabled
 *   4. Navigate to profile from nav bar
 */
import { expect, test } from '@playwright/test';
import { LayoutPage } from './pages/layout.page';
import { ProfilePage } from './pages/profile.page';

test.describe('Profile Page', () => {
  let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    profilePage = new ProfilePage(page);
    await profilePage.goto();

    // If redirected to login, skip — auth state may have expired
    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
  });

  test('profile page loads with user heading', async () => {
    await expect(profilePage.userName).toBeVisible();
    await expect(profilePage.userName).not.toHaveText('Loading Profile...');
  });

  test('shows authentication section with NOSTR identity', async () => {
    await expect(profilePage.authSection).toBeVisible();
    await expect(profilePage.nostrIdentityHeading).toBeVisible();
    await expect(profilePage.pubkeyLabel).toBeVisible();
  });

  test('logout button is visible and enabled', async () => {
    await expect(profilePage.logoutButton).toBeVisible();
    await expect(profilePage.logoutButton).toBeEnabled();
  });

  test('navigate to profile from nav bar', async ({ page }) => {
    const layout = new LayoutPage(page);
    await layout.goto('/');

    // If redirected to login from home, skip
    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }

    await layout.profileLink.click();
    await expect(page).toHaveURL(/\/profile/);
  });
});
