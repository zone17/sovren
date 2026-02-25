import { expect, test as setup } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { CREATOR_CREDENTIALS } from './fixtures/test-credentials';
import { LoginPage } from './pages/login.page';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../test-results/.auth/creator.json');

setup('authenticate as creator via email', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginWithEmail(CREATOR_CREDENTIALS.email, CREATOR_CREDENTIALS.password);

  await expect(page).toHaveURL(/\/profile/);

  await page.context().storageState({ path: authFile });
});
