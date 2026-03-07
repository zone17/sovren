import { expect, test } from '@playwright/test';
import { CreatorNetworkPage } from './pages/creator-network.page';

test.describe('Creator Network — Community Hub', () => {
  let community: CreatorNetworkPage;

  test.beforeEach(async ({ page }) => {
    community = new CreatorNetworkPage(page);
    await community.goto();
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
});
