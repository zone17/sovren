import type { Locator, Page } from '@playwright/test';

type CommunityTab = 'circles' | 'mentorship' | 'collaborations' | 'marketplace';

export class CreatorNetworkPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly circlesTab: Locator;
  readonly mentorshipTab: Locator;
  readonly collaborationsTab: Locator;
  readonly marketplaceTab: Locator;
  readonly nicheFilter: Locator;
  readonly audienceFilter: Locator;
  readonly collaborationsPlaceholder: Locator;
  readonly createCircleButton: Locator;
  readonly circlesHeading: Locator;
  readonly marketplaceHeading: Locator;
  readonly serviceTypeFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /community/i }).first();
    this.circlesTab = page.getByRole('tab', { name: /circles/i }).first();
    this.mentorshipTab = page.getByRole('tab', { name: /mentorship/i }).first();
    this.collaborationsTab = page.getByRole('tab', { name: /collaborations/i }).first();
    this.marketplaceTab = page.getByRole('tab', { name: /marketplace/i }).first();
    this.nicheFilter = page.getByRole('textbox', { name: /filter by niche/i });
    this.audienceFilter = page.getByLabel(/filter by audience/i);
    this.collaborationsPlaceholder = page.getByText(
      /select a piece of content to manage collaborators/i
    );
    this.createCircleButton = page.getByRole('button', { name: /create circle/i });
    this.circlesHeading = page.getByRole('heading', { name: /creator circles/i });
    this.marketplaceHeading = page.getByRole('heading', { name: /creator marketplace/i });
    this.serviceTypeFilter = page.getByLabel(/filter by service type/i);
  }

  async goto() {
    await this.page.goto('/community');
    await this.heading.waitFor({ state: 'visible' });
  }

  async switchTab(tab: CommunityTab) {
    const tabMap: Record<CommunityTab, Locator> = {
      circles: this.circlesTab,
      mentorship: this.mentorshipTab,
      collaborations: this.collaborationsTab,
      marketplace: this.marketplaceTab,
    };
    await tabMap[tab].click();
  }
}
