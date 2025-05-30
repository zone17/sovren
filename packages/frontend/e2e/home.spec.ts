import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the home page correctly', async ({ page }) => {
    await page.goto('/');

    // Check the main heading
    await expect(page.getByRole('heading', { name: 'Welcome to Sovren' })).toBeVisible();

    // Check the description
    await expect(page.getByText('The platform for creators to monetize their content using Bitcoin and Nostr.')).toBeVisible();

    // Check the call-to-action buttons
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Learn More' })).toBeVisible();

    // Check the feature cards
    await expect(page.getByRole('heading', { name: 'Create Content' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Monetize' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Build Community' })).toBeVisible();
  });

  test('should navigate to signup page when clicking Get Started', async ({ page }) => {
    await page.goto('/');

    // Click the Get Started button
    await page.getByRole('link', { name: 'Get Started' }).click();

    // Should navigate to signup page
    await expect(page).toHaveURL('/signup');
  });

  test('should navigate to about page when clicking Learn More', async ({ page }) => {
    await page.goto('/');

    // Click the Learn More button
    await page.getByRole('link', { name: 'Learn More' }).click();

    // Should navigate to about page
    await expect(page).toHaveURL('/about');
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Should still show main content
    await expect(page.getByRole('heading', { name: 'Welcome to Sovren' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();

    // Feature cards should stack vertically (just check they're visible)
    await expect(page.getByRole('heading', { name: 'Create Content' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Monetize' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Build Community' })).toBeVisible();
  });
});
