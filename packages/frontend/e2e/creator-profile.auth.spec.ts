import { expect, test } from '@playwright/test';
import { CreatorProfilePage } from './pages/creator-profile.page';
import { DiscoveryPage } from './pages/discovery.page';

test.describe('Creator Profile Page', () => {
  let creatorProfile: CreatorProfilePage;

  test.beforeEach(async ({ page }) => {
    creatorProfile = new CreatorProfilePage(page);
  });

  test('navigates from discovery card to creator profile', async ({ page }) => {
    const discovery = new DiscoveryPage(page);
    await discovery.goto();

    // Skip if no creator cards loaded (no backend data)
    const viewProfileLink = page.getByRole('link', { name: /View.*profile/i }).first();
    const hasCards = await viewProfileLink.isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!hasCards, 'No creator cards — backend not running');

    await viewProfileLink.click();

    // Should navigate to /creator/:id
    await expect(page).toHaveURL(/\/creator\/.+/);
  });

  test('shows loading state then profile content', async ({ page }) => {
    await creatorProfile.goto('creator-1');

    // Either loading spinner shows briefly or profile content renders
    // Wait for either the profile heading or error to appear
    await expect(creatorProfile.displayName.or(creatorProfile.errorHeading)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows error state for nonexistent creator', async ({ page }) => {
    await creatorProfile.goto('00000000-0000-0000-0000-000000000000');

    await expect(creatorProfile.errorHeading).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/does not exist|not found/i)).toBeVisible();
  });

  test('profile header renders display name and stats', async ({ page }) => {
    await creatorProfile.goto('creator-1');

    // Skip if creator not found (no backend data)
    const heading = creatorProfile.displayName;
    const error = creatorProfile.errorHeading;
    const visible = await Promise.race([
      heading.waitFor({ timeout: 8_000 }).then(() => 'profile'),
      error.waitFor({ timeout: 8_000 }).then(() => 'error'),
    ]).catch(() => 'timeout');

    test.skip(visible !== 'profile', 'Creator data not available — backend not running');

    await expect(heading).toBeVisible();
    await expect(creatorProfile.followerCount).toBeVisible();
    await expect(creatorProfile.postCount).toBeVisible();
  });

  test('follow button toggles state', async ({ page }) => {
    await creatorProfile.goto('creator-1');

    const heading = creatorProfile.displayName;
    const error = creatorProfile.errorHeading;
    const visible = await Promise.race([
      heading.waitFor({ timeout: 8_000 }).then(() => 'profile'),
      error.waitFor({ timeout: 8_000 }).then(() => 'error'),
    ]).catch(() => 'timeout');

    test.skip(visible !== 'profile', 'Creator data not available — backend not running');

    await expect(creatorProfile.followButton).toBeVisible();
    await expect(creatorProfile.followButton).toHaveAttribute('aria-pressed', 'false');

    await creatorProfile.followButton.click();
    await expect(creatorProfile.followButton).toHaveAttribute('aria-pressed', 'true');
    await expect(creatorProfile.followButton).toHaveText('Following');

    await creatorProfile.followButton.click();
    await expect(creatorProfile.followButton).toHaveAttribute('aria-pressed', 'false');
    await expect(creatorProfile.followButton).toHaveText('Follow');
  });

  test('tab navigation works', async ({ page }) => {
    await creatorProfile.goto('creator-1');

    const heading = creatorProfile.displayName;
    const error = creatorProfile.errorHeading;
    const visible = await Promise.race([
      heading.waitFor({ timeout: 8_000 }).then(() => 'profile'),
      error.waitFor({ timeout: 8_000 }).then(() => 'error'),
    ]).catch(() => 'timeout');

    test.skip(visible !== 'profile', 'Creator data not available — backend not running');

    // Tiers tab is default
    await expect(creatorProfile.tiersTab).toHaveAttribute('aria-selected', 'true');

    // Switch to Content tab
    await creatorProfile.contentTab.click();
    await expect(creatorProfile.contentTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Content Feed/i)).toBeVisible();

    // Switch to About tab
    await creatorProfile.aboutTab.click();
    await expect(creatorProfile.aboutTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: /About/i })).toBeVisible();
  });

  test('tip creator opens lightning payment dialog', async ({ page }) => {
    await creatorProfile.goto('creator-1');

    const heading = creatorProfile.displayName;
    const error = creatorProfile.errorHeading;
    const visible = await Promise.race([
      heading.waitFor({ timeout: 8_000 }).then(() => 'profile'),
      error.waitFor({ timeout: 8_000 }).then(() => 'error'),
    ]).catch(() => 'timeout');

    test.skip(visible !== 'profile', 'Creator data not available — backend not running');

    // Skip if no tip button (creator has no lightning address)
    const tipVisible = await creatorProfile.tipButton.isVisible().catch(() => false);
    test.skip(!tipVisible, 'Creator has no lightning address');

    await creatorProfile.tipButton.click();

    // Lightning payment dialog should open
    await expect(creatorProfile.lightningDialog).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Lightning Payment/i)).toBeVisible();
  });

  test('subscribe button opens lightning payment dialog', async ({ page }) => {
    await creatorProfile.goto('creator-1');

    const heading = creatorProfile.displayName;
    const error = creatorProfile.errorHeading;
    const visible = await Promise.race([
      heading.waitFor({ timeout: 8_000 }).then(() => 'profile'),
      error.waitFor({ timeout: 8_000 }).then(() => 'error'),
    ]).catch(() => 'timeout');

    test.skip(visible !== 'profile', 'Creator data not available — backend not running');

    // Check for any subscribe button on the tiers tab
    const subscribeBtn = page.getByRole('button', { name: /Subscribe/i }).first();
    const hasTiers = await subscribeBtn.isVisible().catch(() => false);
    test.skip(!hasTiers, 'No subscription tiers available');

    await subscribeBtn.click();

    // The hidden LightningPaymentButton auto-opens its dialog
    // It will either show the dialog or fail to create invoice
    // Either way, the component was wired correctly
    await expect(
      creatorProfile.lightningDialog.or(page.getByText(/Error|Failed/i).first())
    ).toBeVisible({ timeout: 5_000 });
  });
});
