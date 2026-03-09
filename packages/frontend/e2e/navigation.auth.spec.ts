import { expect, test } from '@playwright/test';
import { LayoutPage } from './pages/layout.page';
import { ProfilePage } from './pages/profile.page';

test.describe('Navigation (authenticated creator)', () => {
  let layout: LayoutPage;

  test.beforeEach(async ({ page }) => {
    layout = new LayoutPage(page);
    await layout.goto('/profile');

    // Wait for SPA to settle — either content renders or auth redirect fires
    await Promise.race([
      layout.profileLink.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
  });

  test('nav bar shows creator links', async () => {
    await expect(layout.profileLink).toBeVisible();
    await expect(layout.createLink).toBeVisible();
    await expect(layout.dashboardLink).toBeVisible();
    await expect(layout.wellnessLink).toBeVisible();
    await expect(layout.shieldLink).toBeVisible();
  });

  test('navigate to dashboard', async () => {
    await layout.dashboardLink.click();
    await expect(layout.page).toHaveURL(/\/dashboard/);
  });

  test('navigate to wellness', async () => {
    await layout.wellnessLink.click();
    await expect(layout.page).toHaveURL(/\/wellness/);
  });

  test('navigate to shield', async () => {
    await layout.shieldLink.click();
    await expect(layout.page).toHaveURL(/\/shield/);
  });

  test('logo navigates to home', async () => {
    await layout.sovrenLogo.click();
    await expect(layout.page).toHaveURL('/');
  });

  test('mobile viewport renders page correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/profile');

    // Wait for SPA to settle after mobile navigation
    await Promise.race([
      page
        .getByRole('heading', { level: 1 })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }

    const profilePage = new ProfilePage(page);
    await expect(profilePage.userName).toBeVisible();
  });
});
