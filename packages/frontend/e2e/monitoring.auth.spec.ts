import { expect, test } from '@playwright/test';
import { MonitoringPage } from './pages/monitoring.page';

test.describe('Monitoring — Performance Monitor', () => {
  let monitoring: MonitoringPage;

  test.beforeEach(async ({ page }) => {
    monitoring = new MonitoringPage(page);
    await monitoring.goto();

    // Wait for SPA to settle — either content renders or auth redirect fires
    await Promise.race([
      monitoring.toggleButton.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
  });

  test('monitoring page loads without error', async ({ page }) => {
    await expect(page).toHaveURL(/\/monitoring/);
  });

  test('toggle button is visible', async () => {
    await expect(monitoring.toggleButton).toBeVisible();
  });

  test('clicking toggle shows performance panel', async () => {
    await monitoring.toggleButton.click();
    await expect(monitoring.panelHeading).toBeVisible();
  });
});
