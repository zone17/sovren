/**
 * Comments E2E — Authenticated Flows — T18
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Uses stored auth state (chromium-authenticated project).
 * Tests: post, reply, delete (own), moderate (creator), two-level nesting enforcement.
 *
 * Convention: *.auth.spec.ts → auto-matched by chromium-authenticated project.
 *
 * Environment:
 * - TEST_CONTENT_ID: ID of a published content item visible in the test environment.
 *   Defaults to a known fixture content item.
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
  await page.goto(`/content/${TEST_CONTENT_ID}`);

  // Wait for SPA to settle — either comments section loads or auth redirect fires
  await Promise.race([
    commentsPage.commentsSection.waitFor({ state: 'visible', timeout: 10_000 }),
    page.waitForURL(/\/login/, { timeout: 10_000 }),
  ]).catch(() => {});

  if (page.url().includes('/login')) {
    test.skip(true, 'Redirected to login — auth state unavailable');
    return;
  }

  const visible = await commentsPage.commentsSection.isVisible();
  if (!visible) {
    test.skip(true, 'Comments section not available — content fixture missing');
    return;
  }

  // Auth tests require the comment form — if sign-in link is shown, user is not authenticated
  const signInVisible = await commentsPage.signInLink.isVisible().catch(() => false);
  if (signInVisible) {
    test.skip(true, 'User not authenticated — sign-in link visible instead of comment form');
    return;
  }

  // If comments failed to load (no backend), skip — CRUD tests require a working API
  const loadError = await page
    .getByText(/failed to load comments/i)
    .isVisible()
    .catch(() => false);
  if (loadError) {
    test.skip(true, 'Comments API unavailable — backend required for CRUD tests');
  }
});

// ============================================================================
// Post comment
// ============================================================================

test.describe('Post comment', () => {
  test('authenticated user can post a top-level comment', async ({ page }) => {
    const commentText = `E2E test comment ${Date.now()}`;

    await commentsPage.postComment(commentText);

    // Comment should appear in the list
    await expect(page.getByText(commentText)).toBeVisible();
  });

  test('comment form shows character counter', async () => {
    await commentsPage.commentTextarea.fill('Hello');
    await expect(commentsPage.charCounter).toContainText('5/2000');
  });

  test('submit button is disabled for empty textarea', async () => {
    await expect(commentsPage.postCommentButton).toBeDisabled();
  });

  test('comment is rendered as plain text (no HTML injection)', async ({ page }) => {
    const xssAttempt = '<b>Bold</b><script>window.__xss=1</script>';
    await commentsPage.postComment(xssAttempt);

    // Text should appear literally — not as HTML
    await expect(page.getByText(xssAttempt)).toBeVisible();
    // No XSS execution
    const xssFlag = await page.evaluate(() => (window as unknown as Record<string, unknown>).__xss);
    expect(xssFlag).toBeUndefined();
  });
});

// ============================================================================
// Reply flow
// ============================================================================

test.describe('Reply to comment', () => {
  test('authenticated user can reply to a top-level comment', async ({ page }) => {
    // Post a parent comment first
    const parentText = `Parent ${Date.now()}`;
    await commentsPage.postComment(parentText);
    await expect(page.getByText(parentText)).toBeVisible();

    // Reply to it
    const replyText = `Reply ${Date.now()}`;
    await commentsPage.clickReply('You'); // Replace with real author name from auth session

    const replyTextarea = page.getByRole('textbox', { name: /reply to/i }).first();
    await replyTextarea.fill(replyText);
    await page
      .getByRole('button', { name: /post reply/i })
      .first()
      .click();

    // Reply should appear after expanding
    await commentsPage.showRepliesFor(1);
    await expect(page.getByText(replyText)).toBeVisible();
  });

  test('reply form has cancel button that hides the form', async ({ page }) => {
    const parentText = `Parent for cancel test ${Date.now()}`;
    await commentsPage.postComment(parentText);

    await commentsPage.clickReply('You');

    const cancelBtn = page.getByRole('button', { name: /cancel/i }).first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Reply textarea should be gone
    await expect(page.getByRole('textbox', { name: /reply to/i })).not.toBeVisible();
  });
});

// ============================================================================
// Delete flow (owner)
// ============================================================================

test.describe('Delete own comment', () => {
  test('owner can delete their own comment', async ({ page }) => {
    const commentText = `Delete me ${Date.now()}`;
    await commentsPage.postComment(commentText);
    await expect(page.getByText(commentText)).toBeVisible();

    // The auth user is the owner — should see delete button
    await page
      .getByRole('button', { name: /delete comment by/i })
      .first()
      .click();

    await commentsPage.deleteDialog.waitFor({ state: 'visible' });
    await commentsPage.confirmDeleteButton.click();
    await commentsPage.deleteDialog.waitFor({ state: 'hidden' });

    // Comment should be removed (optimistically and after re-fetch)
    await expect(page.getByText(commentText)).not.toBeVisible();
  });

  test('delete dialog can be cancelled without deleting', async ({ page }) => {
    const commentText = `Keep me ${Date.now()}`;
    await commentsPage.postComment(commentText);

    await page
      .getByRole('button', { name: /delete comment by/i })
      .first()
      .click();

    await commentsPage.deleteDialog.waitFor({ state: 'visible' });
    await commentsPage.cancelDeleteButton.click();
    await commentsPage.deleteDialog.waitFor({ state: 'hidden' });

    // Comment should still be visible
    await expect(page.getByText(commentText)).toBeVisible();
  });
});

// ============================================================================
// Two-level threading enforcement
// ============================================================================

test.describe('Two-level threading', () => {
  test('reply items do not show a Reply button (no nesting beyond level 2)', async ({ page }) => {
    // Post a comment and reply
    const parentText = `Top-level ${Date.now()}`;
    await commentsPage.postComment(parentText);

    await commentsPage.clickReply('You');
    const replyTextarea = page.getByRole('textbox', { name: /reply to/i }).first();
    await replyTextarea.fill(`Reply ${Date.now()}`);
    await page
      .getByRole('button', { name: /post reply/i })
      .first()
      .click();

    // Expand replies
    await commentsPage.showRepliesFor(1);

    // Inside the replies list, there should be no "Reply to" button
    const repliesList = page.getByRole('list', { name: /replies to/i }).first();
    await expect(repliesList).toBeVisible();

    const replyButtonsInNested = repliesList.getByRole('button', { name: /reply to/i });
    await expect(replyButtonsInNested).toHaveCount(0);
  });
});

// ============================================================================
// Pagination
// ============================================================================

test.describe('Pagination', () => {
  test('Load more button appears and loads additional comments', async ({ page: _page }) => {
    // This test requires >20 existing comments on TEST_CONTENT_ID in the test DB.
    // Skip gracefully if Load more is not visible (content has <20 comments).
    const loadMore = commentsPage.loadMoreButton;
    const isVisible = await loadMore.isVisible();

    if (!isVisible) {
      test.skip();
      return;
    }

    const initialItems = await commentsPage.getCommentItems();
    const initialCount = initialItems.length;

    await loadMore.click();

    // Wait for more items to appear
    await expect(async () => {
      const newItems = await commentsPage.getCommentItems();
      expect(newItems.length).toBeGreaterThan(initialCount);
    }).toPass({ timeout: 5000 });
  });
});
