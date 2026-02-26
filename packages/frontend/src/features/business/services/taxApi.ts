import apiClient from '@/services/api/apiClient';
import type { ApiResponse, QuarterlyTaxSummary, CreateExpensePayload } from '../types';
import type { Expense, ExpenseCategory } from '@shared/types/finance';

const BASE = '/api/v2/business/tax';

export const taxApi = {
  getSummary(): Promise<ApiResponse<QuarterlyTaxSummary[]>> {
    return apiClient.get(`${BASE}/summary`);
  },

  getExpenses(params?: {
    categoryId?: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<Expense[]>> {
    return apiClient.get(`${BASE}/expenses`, params);
  },

  addExpense(data: CreateExpensePayload): Promise<ApiResponse<Expense>> {
    return apiClient.post(`${BASE}/expenses`, data);
  },

  getCategories(): Promise<ApiResponse<ExpenseCategory[]>> {
    return apiClient.get(`${BASE}/categories`);
  },

  createCategory(name: string, type: string): Promise<ApiResponse<ExpenseCategory>> {
    return apiClient.post(`${BASE}/categories`, { name, type });
  },

  exportTax(format: 'csv' | 'json', year?: number): Promise<ApiResponse<{ downloadUrl: string }>> {
    return apiClient.get(`${BASE}/export`, {
      format,
      ...(year !== undefined ? { year } : {}),
    });
  },
};
