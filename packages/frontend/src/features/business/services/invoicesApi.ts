import apiClient from '@/services/api/apiClient';
import type { ApiResponse, CreateInvoicePayload } from '../types';
import type { BusinessInvoice } from '@shared/types/finance';

const BASE = '/api/v2/business/invoices';

export const invoicesApi = {
  getInvoices(): Promise<ApiResponse<BusinessInvoice[]>> {
    return apiClient['request']('GET', BASE);
  },

  getInvoice(id: string): Promise<ApiResponse<BusinessInvoice>> {
    return apiClient['request']('GET', `${BASE}/${id}`);
  },

  createInvoice(data: CreateInvoicePayload): Promise<ApiResponse<BusinessInvoice>> {
    return apiClient['request']('POST', BASE, data);
  },

  updateStatus(
    id: string,
    status: string
  ): Promise<ApiResponse<BusinessInvoice>> {
    return apiClient['request']('PUT', `${BASE}/${id}/status`, { status });
  },

  generatePaymentLink(id: string): Promise<ApiResponse<{ lnurlPay: string; qrCode: string }>> {
    return apiClient['request']('POST', `${BASE}/${id}/payment-link`);
  },
};
