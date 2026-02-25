import { expect, test } from '@playwright/test';
import { HomePage } from './pages/home.page';

test.describe('Home Page', () => {
  let home: HomePage;

  test.beforeEach(async ({ page }) => {
    home = new HomePage(page);
    await home.goto();
  });

  test('displays hero heading, subheading, and CTA buttons', async () => {
    await expect(home.heading).toBeVisible();
    await expect(home.subheading).toBeVisible();
    await expect(home.ctaButton).toBeVisible();
    await expect(home.learnMoreButton).toBeVisible();
  });

  test('displays benefit cards', async () => {
    await expect(home.trueOwnershipCard).toBeVisible();
    await expect(home.bitcoinMonetizationCard).toBeVisible();
    await expect(home.eliteCommunityCard).toBeVisible();
  });

  test('CTA navigates to onboarding', async () => {
    await home.ctaButton.click();
    await expect(home.page).toHaveURL(/\/onboarding/);
  });

  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await home.goto();

    await expect(home.heading).toBeVisible();
    await expect(home.ctaButton).toBeVisible();
    await expect(home.trueOwnershipCard).toBeVisible();
    await expect(home.bitcoinMonetizationCard).toBeVisible();
    await expect(home.eliteCommunityCard).toBeVisible();
  });
});
