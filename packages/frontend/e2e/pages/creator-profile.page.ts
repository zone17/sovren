import type { Locator, Page } from '@playwright/test';

export class CreatorProfilePage {
  readonly page: Page;
  readonly displayName: Locator;
  readonly username: Locator;
  readonly bio: Locator;
  readonly followerCount: Locator;
  readonly postCount: Locator;
  readonly followButton: Locator;
  readonly tipButton: Locator;
  readonly tiersTab: Locator;
  readonly contentTab: Locator;
  readonly aboutTab: Locator;
  readonly lightningDialog: Locator;
  readonly errorHeading: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.displayName = page.getByRole('heading', { level: 1 }).first();
    this.username = page.getByText(/@\w+/).first();
    this.bio = page.locator('.max-w-2xl').first();
    this.followerCount = page.getByText(/followers/).first();
    this.postCount = page.getByText(/posts/).first();
    this.followButton = page.getByRole('button', { name: /Follow/i }).first();
    this.tipButton = page.getByRole('button', { name: /Tip Creator/i }).first();
    this.tiersTab = page.getByRole('tab', { name: /Subscription Tiers/i });
    this.contentTab = page.getByRole('tab', { name: /Content/i });
    this.aboutTab = page.getByRole('tab', { name: /About/i });
    this.lightningDialog = page.getByRole('dialog');
    this.errorHeading = page.getByRole('heading', { name: /Creator Not Found/i });
    this.loadingSpinner = page.getByRole('status');
  }

  async goto(creatorId: string) {
    await this.page.goto(`/creator/${creatorId}`);
  }

  tierCard(tierName: string): Locator {
    return this.page.locator(`text=${tierName}`).first();
  }

  subscribeButton(tierName: string): Locator {
    return this.page.getByRole('button', {
      name: new RegExp(`Subscribe to ${tierName}`, 'i'),
    });
  }
}
