import apiClient from '@/services/api/apiClient';
import type { ApiResponse, CreateInvoicePayload } from '../types';
import type { BusinessInvoice, PaginatedData } from '@shared/types/finance';

const BASE = '/api/v2/business/invoices';

export const invoicesApi = {
  getInvoices(): Promise<ApiResponse<PaginatedData<BusinessInvoice>>> {
    return apiClient.get(BASE);
  },

  getInvoice(id: string): Promise<ApiResponse<BusinessInvoice>> {
    return apiClient.get(`${BASE}/${id}`);
  },

  createInvoice(data: CreateInvoicePayload): Promise<ApiResponse<BusinessInvoice>> {
    return apiClient.post(BASE, data);
  },

  updateStatus(id: string, status: string): Promise<ApiResponse<BusinessInvoice>> {
    return apiClient.put(`${BASE}/${id}/status`, { status });
  },

  generatePaymentLink(id: string): Promise<ApiResponse<{ lnurlPay: string }>> {
    return apiClient.post(`${BASE}/${id}/payment-link`);
  },
};
