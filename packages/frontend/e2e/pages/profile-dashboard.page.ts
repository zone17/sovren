import type { Locator, Page } from '@playwright/test';

export class ProfileDashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly startOnboardingButton: Locator;
  readonly accountTypeCard: Locator;
  readonly nostrIdentityCard: Locator;
  readonly lightningPaymentsCard: Locator;
  readonly quickActionsCard: Locator;
  readonly shareProfileButton: Locator;
  readonly securityButton: Locator;
  readonly settingsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /your sovereign profile/i }).first();
    this.emptyState = page.getByRole('heading', { name: /no profile found/i });
    this.startOnboardingButton = page.getByRole('button', { name: /start onboarding/i });
    this.accountTypeCard = page.getByText(/account type/i).first();
    this.nostrIdentityCard = page.getByText(/nostr identity/i).first();
    this.lightningPaymentsCard = page.getByText(/lightning payments/i).first();
    this.quickActionsCard = page.getByText(/quick actions/i).first();
    this.shareProfileButton = page.getByRole('button', { name: /share profile/i });
    this.securityButton = page.getByRole('button', { name: /security/i });
    this.settingsButton = page.getByRole('button', { name: /settings/i });
  }

  async goto() {
    await this.page.goto('/profile-dashboard');
  }
}
