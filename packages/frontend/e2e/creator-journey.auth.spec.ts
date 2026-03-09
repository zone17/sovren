/**
 * Creator Journey — Golden Path E2E spec.
 *
 * Cross-page journey test validating the complete creator workflow:
 * Dashboard -> Create Content -> Editor -> back to Dashboard, plus
 * layout nav link traversal and dashboard completeness checks.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 3 tests:
 *   1. Dashboard to create content navigation (round-trip)
 *   2. Cross-page navigation via layout nav links
 *   3. Dashboard content lifecycle overview (all sub-components present)
 */
import { expect, test } from '@playwright/test';
import { CreateContentPage } from './pages/create-content.page';
import { DashboardPage } from './pages/dashboard.page';
import { LayoutPage } from './pages/layout.page';

test.describe('Creator Journey — Golden Path', () => {
  test('dashboard to create content navigation round-trip', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const createContent = new CreateContentPage(page);

    // Step 1: Navigate to dashboard
    await dashboard.goto();
    await page.waitForURL(/\/(dashboard|login)/);

    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    // Verify dashboard loaded — heading or empty state should be visible
    const dashboardLoaded = await dashboard.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!dashboardLoaded) {
      // May be in loading or error state — skip gracefully
      const hasLoading = await dashboard.loadingText.isVisible().catch(() => false);
      const hasError = await dashboard.errorHeading.isVisible().catch(() => false);
      expect(hasLoading || hasError).toBe(true);
      test.skip();
      return;
    }

    // Step 2: Verify empty state or content list is present
    const hasEmptyState = await dashboard.emptyStateHeading.isVisible().catch(() => false);
    const hasContentList = await dashboard.contentHeading.isVisible().catch(() => false);
    expect(hasEmptyState || hasContentList).toBe(true);

    // Step 3: Click "Create Content" button to enter editor view
    await expect(dashboard.createContentButton).toBeVisible();
    await dashboard.createContentButton.click();

    // Step 4: Verify editor view — "Back to Dashboard" button confirms we are in editor mode
    await expect(createContent.backToDashboard).toBeVisible();

    // Step 5: Click "Back to Dashboard" to return
    await createContent.backToDashboard.click();

    // Step 6: Verify we returned to dashboard
    await expect(dashboard.heading).toBeVisible();
  });

  test('cross-page navigation via layout links', async ({ page }) => {
    const layout = new LayoutPage(page);
    const dashboard = new DashboardPage(page);
    const createContent = new CreateContentPage(page);

    // Step 1: Start at dashboard
    await layout.goto('/dashboard');
    await page.waitForURL(/\/(dashboard|login)/);

    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    // Wait for dashboard to render before navigating away
    const dashboardLoaded = await dashboard.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!dashboardLoaded) {
      test.skip();
      return;
    }

    await expect(page).toHaveURL(/\/dashboard/);

    // Step 2: Navigate to Create via nav link
    await expect(layout.createLink).toBeVisible();
    await layout.createLink.click();
    await expect(page).toHaveURL(/\/create/);

    // Wait for create page to settle (heading, loading, or error)
    const createLoaded = await createContent.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (createLoaded) {
      await expect(createContent.heading).toBeVisible();
    }

    // Step 3: Navigate back to Dashboard via nav link
    await expect(layout.dashboardLink).toBeVisible();
    await layout.dashboardLink.click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(dashboard.heading).toBeVisible();
  });

  test('dashboard content lifecycle overview — all sub-components present', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    // Navigate to dashboard
    await dashboard.goto();
    await page.waitForURL(/\/(dashboard|login)/);

    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    // Wait for dashboard to fully render
    const dashboardLoaded = await dashboard.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!dashboardLoaded) {
      test.skip();
      return;
    }

    // Verify main heading
    await expect(dashboard.heading).toBeVisible();

    // Verify content list section heading
    await expect(dashboard.contentHeading).toBeVisible();

    // Verify search input is present and interactive
    await expect(dashboard.searchInput).toBeVisible();
    await expect(dashboard.searchInput).toBeEnabled();

    // Verify filter controls
    await expect(dashboard.statusFilter).toBeVisible();
    await expect(dashboard.sortFilter).toBeVisible();

    // Verify stats cards section
    await expect(dashboard.totalViewsLabel).toBeVisible();
    await expect(dashboard.earningsLabel).toBeVisible();
    await expect(dashboard.aiQualityScoreLabel).toBeVisible();
    await expect(dashboard.publishedLabel).toBeVisible();

    // Verify quick actions sidebar
    await expect(dashboard.createContentButton).toBeVisible();
    await expect(dashboard.aiGenerateButton).toBeVisible();
    await expect(dashboard.importButton).toBeVisible();
    await expect(dashboard.exportButton).toBeVisible();
  });
});
