import type { Locator, Page } from '@playwright/test';

export class WellnessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subheading: Locator;
  readonly pulseCheckInButton: Locator;
  readonly errorBoundary: Locator;
  readonly boundarySettingsSection: Locator;
  readonly heatmapPeriodToggle: Locator;
  readonly pulseModal: Locator;
  readonly pulseSubmitButton: Locator;
  readonly boundarySaveButton: Locator;
  readonly burnoutRiskHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Creator Wellness' }).first();
    this.subheading = page.getByText('Monitor your work patterns').first();
    this.pulseCheckInButton = page.getByRole('button', { name: /Pulse Check-?In/i }).first();
    this.errorBoundary = page.getByText('Something went wrong').first();
    this.boundarySettingsSection = page
      .getByRole('region', { name: /boundary|boundaries/i })
      .first();
    this.heatmapPeriodToggle = page.getByRole('group', { name: /period|heatmap/i }).first();
    this.pulseModal = page.getByRole('dialog');
    this.pulseSubmitButton = page.getByRole('button', { name: /submit|save/i }).first();
    this.boundarySaveButton = page
      .getByRole('button', { name: /save.*boundaries|update.*boundaries|save settings/i })
      .first();
    this.burnoutRiskHeading = page.getByRole('heading', { name: /burnout risk/i }).first();
  }

  async goto() {
    await this.page.goto('/wellness');
  }

  async openPulseModal() {
    await this.pulseCheckInButton.click();
    await this.pulseModal.waitFor({ state: 'visible' });
  }
}
