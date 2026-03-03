import { expect, test } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { SignupPage } from './pages/signup.page';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('login page shows NOSTR extension sign-in', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.heading).toBeVisible();
    await expect(loginPage.extensionButton).toBeVisible();
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
