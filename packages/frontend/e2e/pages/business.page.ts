import type { Locator, Page } from '@playwright/test';

export class BusinessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly contractsTab: Locator;
  readonly invoicesTab: Locator;
  readonly revenueTab: Locator;
  readonly taxTab: Locator;
  readonly createInvoiceButton: Locator;
  readonly taxTable: Locator;
  readonly yearSelector: Locator;
  readonly exportCsvButton: Locator;
  readonly exportJsonButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /business manager/i }).first();
    this.contractsTab = page.getByRole('tab', { name: /contracts/i }).first();
    this.invoicesTab = page.getByRole('tab', { name: /invoices/i }).first();
    this.revenueTab = page.getByRole('tab', { name: /revenue/i }).first();
    this.taxTab = page.getByRole('tab', { name: /tax/i }).first();
    this.createInvoiceButton = page
      .getByRole('button', { name: /new invoice|create invoice/i })
      .first();
    this.taxTable = page.getByRole('table', { name: /tax summary/i }).first();
    this.yearSelector = page.getByLabel(/select tax year/i).first();
    this.exportCsvButton = page.getByLabel(/export.*csv/i).first();
    this.exportJsonButton = page.getByLabel(/export.*json/i).first();
  }

  async goto() {
    await this.page.goto('/business');
    await this.heading.waitFor({ state: 'visible' });
  }

  async switchTab(tab: 'contracts' | 'invoices' | 'revenue' | 'tax') {
    const tabMap = {
      contracts: this.contractsTab,
      invoices: this.invoicesTab,
      revenue: this.revenueTab,
      tax: this.taxTab,
    };
    await tabMap[tab].click();
  }
}
