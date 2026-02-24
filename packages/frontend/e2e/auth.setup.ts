import path from 'path';
import { fileURLToPath } from 'url';
import { expect, test as setup } from '@playwright/test';
import { CREATOR_CREDENTIALS } from './fixtures/test-credentials';
import { LoginPage } from './pages/login.page';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../test-results/.auth/creator.json');

setup('authenticate as creator via email', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginWithEmail(CREATOR_CREDENTIALS.email, CREATOR_CREDENTIALS.password);

  // Demo auth redirects to /profile after login
  await expect(page).toHaveURL(/\/profile/);

  // Save storage state for downstream tests
  await page.context().storageState({ path: authFile });
});
