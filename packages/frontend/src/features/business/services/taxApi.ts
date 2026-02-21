import apiClient from '@/services/api/apiClient';
import type { ApiResponse, QuarterlyTaxSummary, CreateExpensePayload } from '../types';
import type { Expense, ExpenseCategory } from '@shared/types/finance';

const BASE = '/api/v2/business/tax';

export const taxApi = {
  getSummary(): Promise<ApiResponse<QuarterlyTaxSummary[]>> {
    return apiClient['request']('GET', `${BASE}/summary`);
  },

  getExpenses(params?: {
    categoryId?: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<Expense[]>> {
    return apiClient['request']('GET', `${BASE}/expenses`, undefined, params);
  },

  addExpense(data: CreateExpensePayload): Promise<ApiResponse<Expense>> {
    return apiClient['request']('POST', `${BASE}/expenses`, data);
  },

  getCategories(): Promise<ApiResponse<ExpenseCategory[]>> {
    return apiClient['request']('GET', `${BASE}/categories`);
  },

  createCategory(name: string, type: string): Promise<ApiResponse<ExpenseCategory>> {
    return apiClient['request']('POST', `${BASE}/categories`, { name, type });
  },

  exportTax(format: 'csv' | 'json', year?: number): Promise<ApiResponse<{ downloadUrl: string }>> {
    return apiClient['request']('GET', `${BASE}/export`, undefined, {
      format,
      ...(year !== undefined ? { year } : {}),
    });
  },
};
