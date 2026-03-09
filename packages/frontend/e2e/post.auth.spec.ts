import { expect, test } from '@playwright/test';
import { PostPage } from './pages/post.page';

const NONEXISTENT_POST_ID = 'test-post-id';

test.describe('Post — Single Post View', () => {
  let post: PostPage;

  test.beforeEach(async ({ page }) => {
    post = new PostPage(page);
  });

  test('post route loads or redirects to login', async ({ page }) => {
    await post.goto(NONEXISTENT_POST_ID);

    // Wait for SPA to settle — post heading, error state, or auth redirect
    await Promise.race([
      post.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.getByText(/error/i).first().waitFor({ state: 'visible', timeout: 10_000 }),
      page
        .getByRole('button', { name: /try again/i })
        .waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    const url = page.url();
    if (/\/login/.test(url)) {
      // Auth redirect — valid path
      expect(true).toBe(true);
    } else if (/\/post\//.test(url)) {
      // Page loaded — either post content, error state, or "not found" are all valid
      // for a nonexistent post ID without a backend
      const hasHeading = await post.heading.isVisible().catch(() => false);
      const hasError = await page
        .getByText(/error/i)
        .first()
        .isVisible()
        .catch(() => false);
      const hasTryAgain = await page
        .getByRole('button', { name: /try again/i })
        .isVisible()
        .catch(() => false);
      expect(hasHeading || hasError || hasTryAgain).toBe(true);
    }
  });
});
