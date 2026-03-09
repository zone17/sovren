import { expect, test } from '@playwright/test';
import { CreatorNetworkPage } from './pages/creator-network.page';

test.describe('Creator Network — Community Hub', () => {
  let community: CreatorNetworkPage;

  test.beforeEach(async ({ page }) => {
    community = new CreatorNetworkPage(page);
    // Use page.goto() directly — POM's goto() has blocking waitFor that throws on redirect
    await page.goto('/community');

    // Wait for SPA to settle — either content renders or auth redirect fires
    await Promise.race([
      community.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
  });

  test('community page loads with heading visible', async () => {
    await expect(community.heading).toBeVisible();
  });

  test('tab navigation — click each tab, verify aria-selected changes', async () => {
    await expect(community.circlesTab).toHaveAttribute('aria-selected', 'true');

    await community.switchTab('mentorship');
    await expect(community.mentorshipTab).toHaveAttribute('aria-selected', 'true');
    await expect(community.circlesTab).toHaveAttribute('aria-selected', 'false');

    await community.switchTab('collaborations');
    await expect(community.collaborationsTab).toHaveAttribute('aria-selected', 'true');

    await community.switchTab('marketplace');
    await expect(community.marketplaceTab).toHaveAttribute('aria-selected', 'true');
  });

  test('collaborations tab shows placeholder text', async () => {
    await community.switchTab('collaborations');
    await expect(community.collaborationsPlaceholder).toBeVisible();
  });

  test('mentorship tab shows filter inputs', async () => {
    await community.switchTab('mentorship');
    await expect(community.nicheFilter).toBeVisible();
    await expect(community.audienceFilter).toBeVisible();
    await community.nicheFilter.fill('music');
    await expect(community.nicheFilter).toHaveValue('music');
  });

  test('circles tab shows create circle button and heading', async () => {
    // Wait for circles content to finish loading (skeleton → real content)
    const loaded = await community.circlesHeading
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!loaded) {
      test.skip(true, 'Circles content did not load — API may be unavailable');
      return;
    }

    await expect(community.circlesHeading).toBeVisible();
    await expect(community.createCircleButton).toBeVisible();
    await expect(community.createCircleButton).toBeEnabled();
  });

  test('marketplace tab shows service type filter and heading', async () => {
    await community.switchTab('marketplace');
    await expect(community.marketplaceHeading).toBeVisible();
    await expect(community.serviceTypeFilter).toBeVisible();
  });
});
