import type { Locator, Page } from '@playwright/test';

export class NostrOnboardingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly beginButton: Locator;
  readonly generateKeysButton: Locator;
  readonly backupCheckbox: Locator;
  readonly securityCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page
      .getByRole('heading', { name: /welcome to true digital sovereignty/i })
      .first();
    this.beginButton = page.getByRole('button', { name: /begin your journey/i });
    this.generateKeysButton = page.getByRole('button', { name: /generate my keys/i });
    this.backupCheckbox = page.locator('#backup');
    this.securityCheckbox = page.locator('#security');
  }

  async goto() {
    await this.page.goto('/onboarding/nostr');
    await this.heading.waitFor({ state: 'visible' });
  }
}
