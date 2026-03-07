import { expect, test } from '@playwright/test';
import { PostPage } from './pages/post.page';

test.describe('Post — Single Post View', () => {
  let post: PostPage;

  test.beforeEach(async ({ page }) => {
    post = new PostPage(page);
  });

  test('post route loads or redirects to login', async ({ page }) => {
    await post.goto('test-post-id');
    const url = page.url();
    const onRoute = /\/post\//.test(url);
    const redirectedToLogin = /\/login/.test(url);
    expect(onRoute || redirectedToLogin).toBe(true);
  });
});
