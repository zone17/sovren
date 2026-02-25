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
    this.heading = page.getByRole('heading', { name: 'Unleash Your Creative Sovereignty' });
    this.subheading = page.getByText('Monetize your audience. Own your platform.');
    this.ctaButton = page.getByRole('button', { name: 'Start Your Sovren Journey' });
    this.learnMoreButton = page.getByRole('button', { name: 'See How Sovren Works' });
    this.trueOwnershipCard = page.getByRole('heading', { name: 'True Ownership' });
    this.bitcoinMonetizationCard = page.getByRole('heading', { name: 'Bitcoin Monetization' });
    this.eliteCommunityCard = page.getByRole('heading', { name: 'Elite Community' });
  }

  async goto() {
    await this.page.goto('/');
  }
}
