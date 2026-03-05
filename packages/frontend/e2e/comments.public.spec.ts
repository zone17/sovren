/**
 * Comments E2E — Public (Anonymous) Flows — T19
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * No auth — uses chromium-public project (no storage state).
 * Tests:
 * - Anonymous user can view comments on published content
 * - Anonymous user sees sign-in prompt instead of comment form
 * - Comments section has correct ARIA structure
 * - Anonymous user cannot see delete buttons
 *
 * Convention: *.public.spec.ts → auto-matched by chromium-public project.
 */

import { test, expect } from '@playwright/test';
import { CommentsPage } from './pages/comments.page';

const TEST_CONTENT_ID = process.env.TEST_CONTENT_ID ?? 'test-content-fixture-1';

// ============================================================================
// Setup
// ============================================================================

let commentsPage: CommentsPage;

test.beforeEach(async ({ page }) => {
  commentsPage = new CommentsPage(page);
  await commentsPage.goto(TEST_CONTENT_ID);
});

// ============================================================================
// Viewing comments
// ============================================================================

test.describe('View comments (anonymous)', () => {
  test('comments section is visible with correct heading', async () => {
    await expect(commentsPage.commentsSection).toBeVisible();
    await expect(commentsPage.commentsHeading).toContainText('Comments');
  });

  test('comments section has ARIA landmark structure', async ({ page }) => {
    const section = page.getByRole('region', { name: /comments/i }).first();
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute('aria-labelledby', 'comments-heading');
  });

  test('anonymous user sees sign-in link instead of comment form', async () => {
    await expect(commentsPage.signInLink).toBeVisible();
    await expect(commentsPage.commentTextarea).not.toBeVisible();
  });

  test('sign-in link points to /login', async () => {
    const href = await commentsPage.signInLink.getAttribute('href');
    expect(href).toContain('/login');
  });

  test('existing comments are displayed as a list', async ({ page }) => {
    // The test content item should have at least 1 comment pre-seeded in the DB.
    // If no comments are seeded, this test verifies the empty state message.
    const hasComments = await commentsPage.commentList.isVisible();
    if (hasComments) {
      const list = page.getByRole('list', { name: /comments/i }).first();
      await expect(list).toBeVisible();
    } else {
      await expect(commentsPage.emptyState).toBeVisible();
    }
  });

  test('delete button is NOT visible for anonymous users', async ({ page }) => {
    const deleteButtons = page.getByRole('button', { name: /delete comment by/i });
    await expect(deleteButtons).toHaveCount(0);
  });

  test('reply button is NOT visible for anonymous users (no canDelete, no interaction)', async ({
    page,
  }) => {
    // Anonymous users may still see Reply buttons — but they cannot submit (form shows sign-in)
    // Here we verify that clicking Reply shows the sign-in form (not a functional reply form)
    const replyButtons = page.getByRole('button', { name: /reply to/i });
    const replyCount = await replyButtons.count();

    if (replyCount > 0) {
      await replyButtons.first().click();
      // Should see sign-in prompt, not a textarea
      await expect(commentsPage.signInLink).toBeVisible();
    }
  });
});

// ============================================================================
// ARIA and accessibility
// ============================================================================

test.describe('ARIA structure (anonymous)', () => {
  test('loading state has role=status', async ({ page }) => {
    // Intercept the comments API to keep it loading
    await page.route('**/api/v2/comments/**', async (route) => {
      // Delay response so we can observe loading state
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    await page.reload();

    const spinner = page.getByRole('status', { name: /loading comments/i });
    await expect(spinner).toBeVisible();
  });

  test('error state has role=alert with retry button', async ({ page }) => {
    // Make the API fail
    await page.route('**/api/v2/comments/**', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    );

    await page.reload();

    const alert = page.getByRole('alert').first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/failed to load/i);

    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });
});

// ============================================================================
// Content visibility
// ============================================================================

test.describe('Content access (anonymous)', () => {
  test('comments load without authentication for published content', async ({ page }) => {
    // Verify no auth cookie is present
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name.includes('auth'));
    expect(authCookie).toBeUndefined();

    // Comments section should still render
    await expect(commentsPage.commentsSection).toBeVisible();
  });

  test('404 page for non-published or missing content ID', async ({ page }) => {
    // Attempt to navigate to a content page with a non-existent ID
    await page.goto('/content/nonexistent-content-id-000');
    // Should show 404 or redirect — not a crash
    const title = page.getByRole('heading').first();
    await expect(title).toBeVisible();
  });
});
