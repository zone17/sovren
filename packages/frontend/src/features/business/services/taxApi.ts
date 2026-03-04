import apiClient from '@/services/api/apiClient';
import type { ApiResponse, QuarterlyTaxSummary, CreateExpensePayload } from '../types';
import type { Expense, ExpenseCategory } from '@shared/types/finance';

const BASE = '/api/v2/business/tax';

export const taxApi = {
  getSummary(year: number): Promise<ApiResponse<QuarterlyTaxSummary[]>> {
    return apiClient.get(`${BASE}/summary`, { year });
  },

  getExpenses(params?: {
    categoryId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ items: Expense[]; total: number; limit: number; offset: number }>> {
    return apiClient.get(`${BASE}/expenses`, params);
  },

  addExpense(data: CreateExpensePayload): Promise<ApiResponse<Expense>> {
    return apiClient.post(`${BASE}/expenses`, data);
  },

  getCategories(): Promise<
    ApiResponse<{ items: ExpenseCategory[]; total: number; limit: number; offset: number }>
  > {
    return apiClient.get(`${BASE}/categories`);
  },

  createCategory(name: string, type: string): Promise<ApiResponse<ExpenseCategory>> {
    return apiClient.post(`${BASE}/categories`, { name, type });
  },

  getExportUrl(format: 'csv' | 'json', year: number): string {
    const params = new URLSearchParams({ format, year: String(year) });
    return `${BASE}/export?${params}`;
  },
};
