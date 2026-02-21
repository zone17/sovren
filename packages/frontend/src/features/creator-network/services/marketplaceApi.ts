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
    return apiClient['request']('POST', `${BASE}/listings`, data);
  },

  getListings(params?: {
    serviceType?: ServiceType;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ listings: ServiceListing[]; pagination: Pagination }>> {
    return apiClient['request']('GET', `${BASE}/listings`, undefined, params);
  },

  placeOrder(data: {
    listingId: string;
    idempotencyKey: string;
  }): Promise<ApiResponse<ServiceOrder>> {
    return apiClient['request']('POST', `${BASE}/orders`, data);
  },

  startOrder(orderId: string): Promise<ApiResponse<ServiceOrder>> {
    return apiClient['request']('PUT', `${ORDERS_BASE}/${orderId}/start`);
  },

  completeOrder(orderId: string): Promise<ApiResponse<ServiceOrder>> {
    return apiClient['request']('PUT', `${ORDERS_BASE}/${orderId}/complete`);
  },

  disputeOrder(orderId: string, data: { reason: string }): Promise<ApiResponse<ServiceOrder>> {
    return apiClient['request']('PUT', `${ORDERS_BASE}/${orderId}/dispute`, data);
  },

  reviewOrder(
    orderId: string,
    data: { rating: number; reviewText?: string }
  ): Promise<ApiResponse<OrderReview>> {
    return apiClient['request']('POST', `${ORDERS_BASE}/${orderId}/review`, data);
  },
};
