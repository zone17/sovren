import type { Locator, Page } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subheading: Locator;
  readonly ctaButton: Locator;
  readonly learnMoreButton: Locator;
  readonly trueOwnershipCard: Locator;
  readonly bitcoinMonetizationCard: Locator;
  readonly eliteCommunityCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Own Your Creative Empire' }).first();
    this.subheading = page.getByText('Monetize your audience with Bitcoin.').first();
    this.ctaButton = page.getByRole('button', { name: 'Start Creating' });
    this.learnMoreButton = page.getByRole('button', { name: 'See How It Works' });
    this.trueOwnershipCard = page.getByRole('heading', { name: 'True Ownership' }).first();
    this.bitcoinMonetizationCard = page
      .getByRole('heading', { name: 'Instant Bitcoin Payments' })
      .first();
    this.eliteCommunityCard = page.getByRole('heading', { name: 'Censorship Resistant' }).first();
  }

  async goto() {
    await this.page.goto('/');
  }
}
