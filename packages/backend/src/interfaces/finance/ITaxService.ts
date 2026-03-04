/**
 * Tax Service Interface
 * EPIC-011: Business Manager — Tax preparation and expense categorization
 */

import type { Expense, ExpenseCategory } from '@shared/types/finance';

export interface ITaxService {
  getQuarterlySummary(
    creatorId: string,
    year: number,
    quarter: 1 | 2 | 3 | 4
  ): Promise<{
    revenue: number;
    expenses: number;
    net: number;
    usdRevenue: number;
    usdExpenses: number;
    usdNet: number;
  }>;
  getAnnualSummary(
    creatorId: string,
    year: number
  ): Promise<
    Array<{
      quarter: string;
      year: number;
      totalIncomeSats: number;
      totalIncomeUsd: number;
      totalExpensesSats: number;
      totalExpensesUsd: number;
      netSats: number;
      netUsd: number;
    }>
  >;
  getExpenses(
    creatorId: string,
    filters?: { categoryId?: string; startDate?: string; endDate?: string }
  ): Promise<Expense[]>;
  addExpense(
    creatorId: string,
    data: { categoryId?: string; description: string; amountSats: number; expenseDate?: string }
  ): Promise<{ id: string }>;
  getExpenseCategories(creatorId: string): Promise<ExpenseCategory[]>;
  createExpenseCategory(
    creatorId: string,
    data: { name: string; type: string }
  ): Promise<{ id: string }>;
  deleteExpense(expenseId: string, creatorId: string): Promise<void>;
  deleteExpenseCategory(categoryId: string, creatorId: string): Promise<void>;
  exportTaxReport(creatorId: string, year: number, format: 'csv' | 'json'): Promise<string>;
}
