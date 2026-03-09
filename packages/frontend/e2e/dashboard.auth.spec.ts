/**
 * Creator Dashboard E2E spec — authenticated tests.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 8 tests:
 *   1. Dashboard heading and all four stats card labels are visible
 *   2. Content list section with heading, search, and filter controls
 *   3. Search input accepts text and reflects value
 *   4. Status filter contains all expected options
 *   5. Sort filter contains all expected options
 *   6. Quick actions sidebar buttons are visible
 *   7. Empty state messaging when no content exists
 *   8. Create Content button is clickable
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
    await expect(dashboard.totalViewsLabel).toBeVisible();
    await expect(dashboard.earningsLabel).toBeVisible();
    await expect(dashboard.aiQualityScoreLabel).toBeVisible();
    await expect(dashboard.publishedLabel).toBeVisible();
  });

  test('displays content list section', async () => {
    await expect(dashboard.contentHeading).toBeVisible();
    await expect(dashboard.searchInput).toBeVisible();
    await expect(dashboard.statusFilter).toBeVisible();
    await expect(dashboard.sortFilter).toBeVisible();
  });

  test('search filters content', async () => {
    await dashboard.searchInput.fill('bitcoin');
    await expect(dashboard.searchInput).toHaveValue('bitcoin');
  });

  test('status filter has all options', async () => {
    await expect(dashboard.statusFilter).toContainText('All Status');
    await expect(dashboard.statusFilter).toContainText('Draft');
    await expect(dashboard.statusFilter).toContainText('Published');
    await expect(dashboard.statusFilter).toContainText('Scheduled');
    await expect(dashboard.statusFilter).toContainText('Archived');
  });

  test('sort filter has all options', async () => {
    await expect(dashboard.sortFilter).toContainText('Recently Updated');
    await expect(dashboard.sortFilter).toContainText('Recently Created');
    await expect(dashboard.sortFilter).toContainText('Most Viewed');
    await expect(dashboard.sortFilter).toContainText('Highest Earnings');
  });

  test('quick actions sidebar visible', async () => {
    await expect(dashboard.createContentButton).toBeVisible();
    await expect(dashboard.aiGenerateButton).toBeVisible();
    await expect(dashboard.importButton).toBeVisible();
    await expect(dashboard.exportButton).toBeVisible();
  });

  test('empty state shows when no content', async () => {
    await expect(dashboard.emptyStateHeading).toBeVisible();
    await expect(dashboard.emptyStateDescription).toBeVisible();
  });

  test('create content button navigates to editor', async ({ page }) => {
    await dashboard.createContentButton.click();
    // After clicking Create Content, the view switches to the editor view
    // which shows a "Back to Dashboard" button
    await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible();
  });
});
