// Business Manager Feature Types — re-exported from @sovren/shared with frontend-only additions

export type {
  ContractCategory,
  ContractStatus,
  ContractTemplate,
  Contract,
  RedFlagType,
  RedFlag,
  InvoiceStatus,
  RecurringInterval,
  LineItem,
  BusinessInvoice,
  RevenueSource,
  RevenueEntry,
  DiversificationGoal,
  ExpenseCategoryType,
  ExpenseCategory,
  Expense,
  QuarterlyTaxSummary,
  PaginatedData,
} from '@shared/types/finance';

// --- Frontend-only types ---

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Revenue breakdown with computed percentage
export interface RevenueBreakdownEntry {
  source: string;
  amountSats: number;
  percentage: number;
}

export interface RevenueRisk {
  concentration: number;
  dominantSource: string;
  warning: boolean;
}

export interface CreateContractPayload {
  templateId?: string;
  counterparty: string;
  filledText: string;
}

export interface UpdateContractPayload {
  filledText?: string;
  status?: string;
}

export interface CreateInvoicePayload {
  clientName: string;
  lineItems: Array<{ description: string; quantity: number; unitPriceSats: number }>;
  dueDate?: string;
  recurringInterval?: string;
}

export interface CreateExpensePayload {
  categoryId?: string;
  description: string;
  amountSats: number;
  usdAtTime?: number;
  expenseDate: string;
}

export interface CreateRevenueEntryPayload {
  source: string;
  amountSats: number;
  usdAtTime?: number;
  description?: string;
}

export type BusinessTab = 'contracts' | 'invoices' | 'revenue' | 'tax';
