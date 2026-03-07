import type { Locator, Page } from '@playwright/test';

export class OnboardingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly beginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page
      .getByRole('heading', { name: /welcome to true digital sovereignty/i })
      .first();
    this.beginButton = page.getByRole('button', { name: /begin your sovren journey/i });
  }

  async goto() {
    await this.page.goto('/onboarding');
    await this.heading.waitFor({ state: 'visible' });
  }
}
