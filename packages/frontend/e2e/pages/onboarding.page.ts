import type { Locator, Page } from '@playwright/test';

export class OnboardingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly beginButton: Locator;
  readonly creatorCard: Locator;
  readonly supporterCard: Locator;
  readonly continueButton: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page
      .getByRole('heading', { name: /welcome to true digital sovereignty/i })
      .first();
    this.beginButton = page.getByRole('button', { name: /begin your sovren journey/i });
    this.creatorCard = page.getByText(/create & monetize/i).first();
    this.supporterCard = page.getByText(/support creators/i).first();
    this.continueButton = page.getByRole('button', { name: /continue to identity/i });
    this.backButton = page.getByRole('button', { name: /back/i }).first();
  }

  async goto() {
    await this.page.goto('/onboarding');
    await this.heading.waitFor({ state: 'visible' });
  }
}
