import { expect, test } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { ProfilePage } from './pages/profile.page';
import { SignupPage } from './pages/signup.page';

// Auth tests create their own auth state per-test — they do NOT use shared storage state.

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('email login redirects to profile', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithEmail('test@sovren.app', 'password123');

    await expect(page).toHaveURL(/\/profile/);

    const profilePage = new ProfilePage(page);
    await expect(profilePage.userName).toBeVisible();
  });

  test('email signup redirects to profile', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await signupPage.goto();
    await signupPage.signupWithEmail('Test Creator', 'newuser@sovren.app', 'password123');

    await expect(page).toHaveURL(/\/profile/);

    const profilePage = new ProfilePage(page);
    await expect(profilePage.userName).toBeVisible();
  });

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout clears session', async ({ page }) => {
    // Login first
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithEmail('test@sovren.app', 'password123');
    await expect(page).toHaveURL(/\/profile/);

    // Logout
    const profilePage = new ProfilePage(page);
    await profilePage.logout();

    // Verify: visiting protected route now redirects to login
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page links to signup', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('signup page links to login', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await signupPage.goto();

    await signupPage.loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });
});
