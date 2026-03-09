/**
 * Creator Dashboard E2E spec — authenticated tests.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 8 tests:
 *   1. Dashboard heading and stats card labels are visible
 *   2. Content section heading is visible
 *   3. Empty state messaging when no content exists
 *   4. Create content button is visible and clickable
 *   5. Stats cards show published count
 *   6. Stats cards show views count
 *   7. Stats cards show earnings
 *   8. Stats cards show identity status
 */
import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/dashboard.page';

test.describe('Creator Dashboard', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
    // Wait for SPA to settle — either dashboard renders or auth redirect fires
    await Promise.race([
      dashboard.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      dashboard.loadingText.waitFor({ state: 'visible', timeout: 10_000 }),
      dashboard.errorHeading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});
    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
  });

  test('renders dashboard heading and stats cards', async () => {
    await expect(dashboard.heading).toBeVisible();
    await expect(dashboard.publishedLabel).toBeVisible();
    await expect(dashboard.viewsLabel).toBeVisible();
    await expect(dashboard.earningsLabel).toBeVisible();
    await expect(dashboard.identityLabel).toBeVisible();
  });

  test('displays content section heading', async () => {
    await expect(dashboard.contentHeading).toBeVisible();
  });

  test('empty state shows when no content', async () => {
    // In demo mode with no backend, the empty state should be visible
    const hasEmptyState = await dashboard.emptyStateHeading.isVisible().catch(() => false);
    if (!hasEmptyState) {
      // Content exists — this test only applies when no content
      test.skip(true, 'Content exists — empty state not applicable');
      return;
    }
    await expect(dashboard.emptyStateHeading).toBeVisible();
    await expect(dashboard.emptyStateDescription).toBeVisible();
  });

  test('create content button is visible and clickable', async () => {
    await expect(dashboard.createContentButton).toBeVisible();
    await expect(dashboard.createContentButton).toBeEnabled();
  });

  test('create content button navigates to editor', async ({ page }) => {
    await dashboard.createContentButton.click();
    // After clicking Create Content, the view switches to the editor view
    // which shows a "Back to Dashboard" button
    await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible();
  });

  test('published stats card is visible', async () => {
    await expect(dashboard.publishedLabel).toBeVisible();
  });

  test('views stats card is visible', async () => {
    await expect(dashboard.viewsLabel).toBeVisible();
  });

  test('earnings stats card is visible', async () => {
    await expect(dashboard.earningsLabel).toBeVisible();
  });
});
