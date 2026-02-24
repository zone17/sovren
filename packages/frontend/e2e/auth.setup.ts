import path from 'path';
import { fileURLToPath } from 'url';
import { expect, test as setup } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../test-results/.auth/creator.json');

setup('authenticate as creator', async ({ page }) => {
  await page.goto('/login');

  // Click the Email tab (default is NOSTR)
  await page.getByRole('button', { name: /Email/ }).click();

  // Fill login form
  await page.getByLabel('Email address').fill('e2e-creator@sovren.app');
  await page.getByLabel('Password').fill('testpassword123');

  // Submit
  await page.getByRole('button', { name: /Sign In with Email/ }).click();

  // Wait for redirect to profile
  await expect(page).toHaveURL(/\/profile/);

  // Save storage state for authenticated tests
  await page.context().storageState({ path: authFile });
});
