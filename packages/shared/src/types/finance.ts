/**
 * Finance Types — EPIC-011: Business Manager
 * Shared type definitions for Contracts, Invoicing, Revenue, Tax
 */

// Contract types
export type ContractCategory =
  | 'sponsorship'
  | 'licensing'
  | 'freelance'
  | 'collaboration'
  | 'general';
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired' | 'terminated';

export interface ContractTemplate {
  id: string;
  name: string;
  category: ContractCategory;
  templateText: string;
  redFlags: RedFlag[];
  createdAt: string;
}

export interface Contract {
  id: string;
  creatorId: string;
  templateId?: string;
  counterparty: string;
  filledText: string;
  status: ContractStatus;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RedFlagType = 'exclusivity' | 'perpetual' | 'delayed_payment' | 'ip_assignment';

export interface RedFlag {
  type: RedFlagType;
  match: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

// Invoice types
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
export type RecurringInterval = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export interface LineItem {
  description: string;
  quantity: number;
  unitPriceSats: number;
}

export interface BusinessInvoice {
  id: string;
  creatorId: string;
  clientName: string;
  lineItems: LineItem[];
  totalSats: number;
  lightningPaymentLink?: string;
  lnurlPay?: string;
  status: InvoiceStatus;
  dueDate?: string;
  recurringInterval?: RecurringInterval;
  recurrenceEndDate?: string | null;
  createdAt: string;
  paidAt?: string;
}

// Revenue types
export type RevenueSource =
  | 'subscriptions'
  | 'tips'
  | 'sponsorships'
  | 'services'
  | 'affiliate'
  | 'marketplace'
  | 'other';

export interface RevenueEntry {
  id: string;
  creatorId: string;
  source: RevenueSource;
  amountSats: number;
  usdAtTime?: number;
  description?: string;
  recordedAt: string;
}

export interface DiversificationGoal {
  id: string;
  creatorId: string;
  targetDistribution: Record<RevenueSource, number>;
  createdAt: string;
  updatedAt: string;
}

// Expense types
export type ExpenseCategoryType =
  | 'equipment'
  | 'software'
  | 'services'
  | 'travel'
  | 'office'
  | 'other';

export interface ExpenseCategory {
  id: string;
  creatorId: string;
  name: string;
  type: ExpenseCategoryType;
}

export interface Expense {
  id: string;
  creatorId: string;
  categoryId?: string;
  description: string;
  amountSats: number;
  usdAtTime?: number;
  expenseDate: string;
  createdAt: string;
}

// Tax summary types
export interface QuarterlyTaxSummary {
  quarter: string;
  year: number;
  totalIncomeSats: number;
  totalIncomeUsd: number;
  totalExpensesSats: number;
  totalExpensesUsd: number;
  netSats: number;
  netUsd: number;
}

/**
 * @deprecated Use PaginatedResult from @shared/types/pagination instead.
 * This type uses offset-based pagination; PaginatedResult uses page-based.
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
