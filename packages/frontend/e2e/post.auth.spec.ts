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
    await page.waitForURL(/\/(post\/|login)/);
    const url = page.url();
    if (/\/post\//.test(url)) {
      await expect(post.heading).toBeVisible();
    } else {
      expect(/\/login/.test(url)).toBe(true);
    }
  });
});
