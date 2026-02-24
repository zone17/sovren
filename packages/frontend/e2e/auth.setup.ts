import path from 'path';
import { fileURLToPath } from 'url';
import { expect, test as setup } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { CREATOR_CREDENTIALS } from './fixtures/test-credentials';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../test-results/.auth/creator.json');

setup('authenticate as creator', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginWithEmail(CREATOR_CREDENTIALS.email, CREATOR_CREDENTIALS.password);

  await expect(page, 'Login failed — check E2E_CREATOR_EMAIL and E2E_CREATOR_PASSWORD env vars').toHaveURL(/\/profile/);

  await page.context().storageState({ path: authFile });
});
