import { expect, test } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { ProfilePage } from './pages/profile.page';
import { SignupPage } from './pages/signup.page';
import { TEST_USER, SIGNUP_USER } from './fixtures/test-credentials';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('email login redirects to profile', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithEmail(TEST_USER.email, TEST_USER.password);

    await expect(page).toHaveURL(/\/profile/);

    const profilePage = new ProfilePage(page);
    await expect(profilePage.userName).toBeVisible();
  });

  test('email signup redirects to profile', async ({ page }) => {
    const signupPage = new SignupPage(page);
    await signupPage.goto();
    await signupPage.signupWithEmail(SIGNUP_USER.name, SIGNUP_USER.email, SIGNUP_USER.password);

    await expect(page).toHaveURL(/\/profile/);

    const profilePage = new ProfilePage(page);
    await expect(profilePage.userName).toBeVisible();
  });

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout clears session', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginWithEmail(TEST_USER.email, TEST_USER.password);
    await expect(page).toHaveURL(/\/profile/);

    const profilePage = new ProfilePage(page);
    await profilePage.logout();

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
