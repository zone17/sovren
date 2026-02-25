import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

test.describe('Home Page', () => {
  test('displays hero heading, subheading, and CTA buttons', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await expect(home.heading).toBeVisible();
    await expect(home.subheading).toBeVisible();
    await expect(home.ctaButton).toBeVisible();
    await expect(home.learnMoreButton).toBeVisible();
  });

  test('displays benefit cards', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await expect(home.trueOwnershipCard).toBeVisible();
    await expect(home.bitcoinMonetizationCard).toBeVisible();
    await expect(home.eliteCommunityCard).toBeVisible();
  });

  test('CTA navigates to onboarding', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.ctaButton.click();

    await expect(page).toHaveURL(/\/onboarding/);
  });

  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const home = new HomePage(page);
    await home.goto();

    await expect(home.heading).toBeVisible();
    await expect(home.ctaButton).toBeVisible();
    await expect(home.trueOwnershipCard).toBeVisible();
    await expect(home.bitcoinMonetizationCard).toBeVisible();
    await expect(home.eliteCommunityCard).toBeVisible();
  });
});
