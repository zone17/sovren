import apiClient from '@/services/api/apiClient';
import type { ApiResponse } from '../types';
import type {
  Expense,
  ExpenseCategory,
  PaginatedData,
  QuarterlyTaxSummary,
} from '@shared/types/finance';

interface CreateExpensePayload {
  categoryId?: string;
  description: string;
  amountSats: number;
  usdAtTime?: number;
  expenseDate: string;
}

const BASE = '/api/v2/business/tax';

export const taxApi = {
  getSummary(year: number): Promise<ApiResponse<QuarterlyTaxSummary[]>> {
    return apiClient.get(`${BASE}/summary`, { year });
  },

  getExpenses(params?: {
    categoryId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<PaginatedData<Expense>>> {
    return apiClient.get(`${BASE}/expenses`, params);
  },

  addExpense(data: CreateExpensePayload): Promise<ApiResponse<Expense>> {
    return apiClient.post(`${BASE}/expenses`, data);
  },

  getCategories(): Promise<ApiResponse<PaginatedData<ExpenseCategory>>> {
    return apiClient.get(`${BASE}/categories`);
  },

  createCategory(name: string, type: string): Promise<ApiResponse<ExpenseCategory>> {
    return apiClient.post(`${BASE}/categories`, { name, type });
  },

  async exportTaxBlob(format: 'csv' | 'json', year: number): Promise<Blob> {
    const params = new URLSearchParams({ format, year: String(year) });
    const token = apiClient.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${apiClient.getBaseUrl()}${BASE}/export?${params}`, { headers });
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  },
};
