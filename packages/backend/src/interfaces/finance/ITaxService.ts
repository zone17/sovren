/**
 * Tax Service Interface
 * EPIC-011: Business Manager — Tax preparation and expense categorization
 */

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
  getExpenses(
    creatorId: string,
    filters?: { categoryId?: string; startDate?: string; endDate?: string }
  ): Promise<any[]>;
  addExpense(
    creatorId: string,
    data: { categoryId?: string; description: string; amountSats: number; expenseDate?: string }
  ): Promise<{ id: string }>;
  getExpenseCategories(creatorId: string): Promise<any[]>;
  createExpenseCategory(
    creatorId: string,
    data: { name: string; type: string }
  ): Promise<{ id: string }>;
  exportTaxReport(creatorId: string, year: number, format: 'csv' | 'json'): Promise<string>;
}
