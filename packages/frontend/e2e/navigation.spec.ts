import { expect, test } from '@playwright/test';
import { LayoutPage } from './pages/layout.page';

test.describe('Navigation (authenticated creator)', () => {
  test('nav bar shows creator links', async ({ page }) => {
    await page.goto('/profile');
    const layout = new LayoutPage(page);

    await expect(layout.profileLink).toBeVisible();
    await expect(layout.createLink).toBeVisible();
    await expect(layout.dashboardLink).toBeVisible();
    await expect(layout.wellnessLink).toBeVisible();
    await expect(layout.shieldLink).toBeVisible();
  });

  test('navigate to dashboard', async ({ page }) => {
    await page.goto('/profile');
    const layout = new LayoutPage(page);

    await layout.dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('navigate to wellness', async ({ page }) => {
    await page.goto('/profile');
    const layout = new LayoutPage(page);

    await layout.wellnessLink.click();
    await expect(page).toHaveURL(/\/wellness/);
  });

  test('navigate to shield', async ({ page }) => {
    await page.goto('/profile');
    const layout = new LayoutPage(page);

    await layout.shieldLink.click();
    await expect(page).toHaveURL(/\/shield/);
  });

  test('logo navigates to home', async ({ page }) => {
    await page.goto('/profile');
    const layout = new LayoutPage(page);

    await layout.sovrenLogo.first().click();
    await expect(page).toHaveURL('/');
  });

  test('mobile viewport renders page correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/profile');

    // Profile content should still be visible
    const profileHeading = page.locator('h1').first();
    await expect(profileHeading).toBeVisible();
  });
});
