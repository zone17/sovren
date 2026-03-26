import type { Locator, Page } from '@playwright/test';

export class PaymentPage {
  readonly page: Page;
  readonly lightningDialog: Locator;
  readonly dialogHeading: Locator;
  readonly bolt11Invoice: Locator;
  readonly copyButton: Locator;
  readonly closeButton: Locator;
  readonly tipButton: Locator;
  readonly supportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.lightningDialog = page.getByRole('dialog').first();
    this.dialogHeading = page
      .getByRole('dialog')
      .getByRole('heading', { name: /Lightning Payment/i })
      .first();
    // BOLT11 invoices always start with "ln" — match the rendered invoice text
    this.bolt11Invoice = page.getByText(/^ln[a-z0-9]+/i).first();
    this.copyButton = page
      .getByRole('dialog')
      .getByRole('button', { name: /Copy/i })
      .first();
    this.closeButton = page
      .getByRole('dialog')
      .getByRole('button', { name: /Close|Cancel|Dismiss/i })
      .first();
    this.tipButton = page.getByRole('button', { name: /Tip Creator/i }).first();
    this.supportButton = page
      .getByRole('button', { name: /Support Creator|Tip|Donate/i })
      .first();
  }

  async gotoCreatorProfile(creatorId: string) {
    await this.page.goto(`/creator/${creatorId}`);
  }
}
