import apiClient from '@/services/api/apiClient';
import type { ApiResponse, Pagination } from '../types/community';
import type { ServiceListing, ServiceOrder, OrderReview, ServiceType } from '@shared/types/community';

const BASE = '/api/v2/marketplace';
const ORDERS_BASE = '/api/v2/marketplace/orders';

export const marketplaceApi = {
  createListing(data: {
    serviceType: ServiceType;
    title: string;
    description?: string;
    priceSats: number;
    portfolioUrls?: string[];
  }): Promise<ApiResponse<ServiceListing>> {
    return apiClient.post(`${BASE}/listings`, data);
  },

  getListings(params?: {
    serviceType?: ServiceType;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ listings: ServiceListing[]; pagination: Pagination }>> {
    return apiClient.get(`${BASE}/listings`, params);
  },

  placeOrder(data: {
    listingId: string;
    idempotencyKey: string;
  }): Promise<ApiResponse<ServiceOrder>> {
    return apiClient.post(`${BASE}/orders`, data);
  },

  startOrder(orderId: string): Promise<ApiResponse<ServiceOrder>> {
    return apiClient.put(`${ORDERS_BASE}/${orderId}/start`);
  },

  completeOrder(orderId: string): Promise<ApiResponse<ServiceOrder>> {
    return apiClient.put(`${ORDERS_BASE}/${orderId}/complete`);
  },

  disputeOrder(orderId: string, data: { reason: string }): Promise<ApiResponse<ServiceOrder>> {
    return apiClient.put(`${ORDERS_BASE}/${orderId}/dispute`, data);
  },

  reviewOrder(
    orderId: string,
    data: { rating: number; reviewText?: string }
  ): Promise<ApiResponse<OrderReview>> {
    return apiClient.post(`${ORDERS_BASE}/${orderId}/review`, data);
  },
};
