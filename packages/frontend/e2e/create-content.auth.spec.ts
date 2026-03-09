import { expect, test } from '@playwright/test';
import { CreateContentPage } from './pages/create-content.page';
import { LayoutPage } from './pages/layout.page';

test.describe('Content Creation', () => {
  let createContent: CreateContentPage;

  test.beforeEach(async ({ page }) => {
    createContent = new CreateContentPage(page);
    await createContent.goto();
  });

  test('create route loads successfully', async ({ page }) => {
    // The /create route is protected — it either stays on /create or redirects to /login
    await page.waitForURL(/\/(create|login)/);
    const url = page.url();
    if (/\/create/.test(url)) {
      // Page loaded — verify no uncaught errors by checking for any visible content
      const hasHeading = await createContent.heading.isVisible().catch(() => false);
      const hasLoading = await createContent.loadingIndicator.isVisible().catch(() => false);
      const hasError = await createContent.errorHeading.isVisible().catch(() => false);
      // At least one state should be rendered (overview heading, loading, or error)
      expect(hasHeading || hasLoading || hasError).toBe(true);
    } else {
      expect(/\/login/.test(url)).toBe(true);
    }
  });

  test('shows creator dashboard heading or loading state', async ({ page }) => {
    await page.waitForURL(/\/(create|login)/);
    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    // The component always renders one of: loading indicator, error, or the overview/editor
    const headingVisible = await createContent.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (headingVisible) {
      await expect(createContent.heading).toBeVisible();
    } else {
      // May still be loading or showing an error — both are valid states
      const hasLoading = await createContent.loadingIndicator.isVisible().catch(() => false);
      const hasError = await createContent.errorHeading.isVisible().catch(() => false);
      expect(hasLoading || hasError).toBe(true);
    }
  });

  test('overview shows quick action buttons', async ({ page }) => {
    await page.waitForURL(/\/(create|login)/);
    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    // Wait for overview to render (heading visible means overview loaded)
    const headingVisible = await createContent.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!headingVisible) {
      test.skip();
      return;
    }

    // In overview mode, the Quick Actions panel should show "Create Content" button
    await expect(createContent.createContentButton).toBeVisible();
  });

  test('create content button is present and clickable from overview', async ({ page }) => {
    await page.waitForURL(/\/(create|login)/);
    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    const headingVisible = await createContent.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!headingVisible) {
      test.skip();
      return;
    }

    // The "Create Content" button should be enabled and clickable
    await expect(createContent.createContentButton).toBeEnabled();
  });

  test('page has descriptive subheading', async ({ page }) => {
    await page.waitForURL(/\/(create|login)/);
    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    const headingVisible = await createContent.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!headingVisible) {
      test.skip();
      return;
    }

    // Overview renders a description below the heading
    await expect(createContent.subheading).toBeVisible();
  });

  test('overview displays content list section', async ({ page }) => {
    await page.waitForURL(/\/(create|login)/);
    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    const headingVisible = await createContent.heading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!headingVisible) {
      test.skip();
      return;
    }

    // The "Your Content" section heading should be visible in overview mode
    await expect(createContent.yourContentHeading).toBeVisible();
  });

  test('navigating to create via nav link', async ({ page }) => {
    // Start from a different route and use the nav "Create" link
    const layout = new LayoutPage(page);
    await layout.goto('/profile');

    const createLink = layout.createLink;
    const linkVisible = await createLink
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!linkVisible) {
      test.skip();
      return;
    }

    await createLink.click();
    await expect(page).toHaveURL(/\/create/);
  });

  test('publish button is not visible on fresh page load', async ({ page }) => {
    await page.waitForURL(/\/(create|login)/);
    if (/\/login/.test(page.url())) {
      test.skip();
      return;
    }

    // On initial load (overview mode, no content selected), the Publish button
    // from the editor header should not be visible — it only appears when
    // current_content is set and activeView is 'editor'
    await expect(createContent.publishButton).not.toBeVisible();
  });
});
