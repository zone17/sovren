import type { Locator, Page } from '@playwright/test';

export class NostrOnboardingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly beginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page
      .getByRole('heading', { name: /welcome to true digital sovereignty/i })
      .first();
    this.beginButton = page.getByRole('button', { name: /begin your journey/i });
  }

  async goto() {
    await this.page.goto('/onboarding/nostr');
    await this.heading.waitFor({ state: 'visible' });
  }
}
