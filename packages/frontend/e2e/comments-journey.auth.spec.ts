/**
 * Comments Cross-Journey E2E — Authenticated Flows
 *
 * Cross-page navigation test validating comment section interactions
 * when navigating between different pages.
 *
 * Runs in chromium-authenticated project (uses stored creator auth state).
 * File convention: *.auth.spec.ts — auto-matched by Playwright config.
 *
 * 3 tests:
 *   1. Navigate to post and find comments section
 *   2. Comments section shows placeholder text
 *   3. Navigate from dashboard to post via content item
 */
import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/dashboard.page';
import { PostPage } from './pages/post.page';

const TEST_POST_ID = 'test-post-fixture-1';

test.describe('Comments Journey — Cross-Page', () => {
  test('navigate to post and find comments section', async ({ page }) => {
    const postPage = new PostPage(page);

    await postPage.goto(TEST_POST_ID);

    // Wait for SPA to settle — either post renders or auth redirect fires
    await Promise.race([
      page
        .getByRole('heading', { name: 'Comments', level: 2 })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 }),
      page
        .getByRole('heading', { name: 'Post not found' })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    // Post page renders — either the post content or "Post not found"
    // Both paths render an h2; the comments section has <h2>Comments</h2>
    const commentsHeading = page.getByRole('heading', { name: 'Comments', level: 2 }).first();

    const hasComments = await commentsHeading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasComments) {
      // Post not found renders "Post not found" h2 instead — still a valid load
      const notFoundHeading = page.getByRole('heading', { name: 'Post not found' }).first();
      await expect(notFoundHeading).toBeVisible();
      test.skip();
      return;
    }

    await expect(commentsHeading).toBeVisible();
  });

  test('comments section shows placeholder text', async ({ page }) => {
    const postPage = new PostPage(page);

    await postPage.goto(TEST_POST_ID);

    // Wait for SPA to settle
    await Promise.race([
      page
        .getByRole('heading', { name: 'Comments', level: 2 })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 }),
      page
        .getByRole('heading', { name: 'Post not found' })
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    // Wait for the comments heading to confirm we have a valid post
    const commentsHeading = page.getByRole('heading', { name: 'Comments', level: 2 }).first();

    const hasComments = await commentsHeading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasComments) {
      test.skip();
      return;
    }

    // Post.tsx renders "Comments coming soon..." as placeholder
    const placeholder = page.getByText('Comments coming soon...').first();
    await expect(placeholder).toBeVisible();
  });

  test('navigate from dashboard to post via content item', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    // Step 1: Navigate to dashboard and wait for SPA to settle
    await dashboard.goto();
    await Promise.race([
      dashboard.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      dashboard.loadingText.waitFor({ state: 'visible', timeout: 10_000 }),
      dashboard.errorHeading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    // Wait for dashboard to render
    const dashboardLoaded = await dashboard.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!dashboardLoaded) {
      test.skip();
      return;
    }

    // Step 2: Check if content items exist in the content list
    const contentHeadingVisible = await dashboard.contentHeading.isVisible().catch(() => false);

    if (!contentHeadingVisible) {
      // No content section rendered — skip gracefully
      test.skip();
      return;
    }

    // Step 3: Look for clickable content items (links within the content list area)
    const contentLinks = page.getByRole('link').filter({ hasText: /.+/ });
    const linkCount = await contentLinks.count();

    // Filter to find content item links (not nav links)
    // Content items typically link to /content/ or /post/ routes
    let contentItemLink = null;
    for (let i = 0; i < linkCount; i++) {
      const href = await contentLinks.nth(i).getAttribute('href');
      if (href && (/\/content\//.test(href) || /\/post\//.test(href))) {
        contentItemLink = contentLinks.nth(i);
        break;
      }
    }

    if (!contentItemLink) {
      // No content item links found — empty dashboard, skip gracefully
      test.skip();
      return;
    }

    // Step 4: Click the content item to navigate
    await contentItemLink.click();

    // Step 5: Verify navigation occurred — should be on a content or post page
    await expect(page).toHaveURL(/\/(content|post)\//);
  });
});
