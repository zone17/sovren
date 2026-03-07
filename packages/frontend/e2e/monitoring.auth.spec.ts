import { expect, test } from '@playwright/test';
import { MonitoringPage } from './pages/monitoring.page';

test.describe('Monitoring — Performance Monitor', () => {
  let monitoring: MonitoringPage;

  test.beforeEach(async ({ page }) => {
    monitoring = new MonitoringPage(page);
    await monitoring.goto();
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
