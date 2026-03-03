/**
 * ⚡ **LIGHTNING API SERVICE - PAYMENT INTEGRATION**
 *
 * Elite Engineering Standards:
 * - Type-safe API client for Lightning Network payments
 * - Proper error handling with retries
 * - Authentication via JWT tokens
 * - Request timeout protection
 * - Follows Sovren backend API contracts
 *
 * @module lightningApi
 */

// Lightning API Types based on backend contracts
export interface CreateInvoiceRequest {
  amount: number;
  creatorId?: string;
  description?: string;
  expirySeconds?: number;
  metadata?: Record<string, string>;
}

export interface LightningInvoice {
  paymentRequest: string;
  paymentHash: string;
  amount: number;
  description?: string;
  expiresAt: number;
  createdAt: number;
  settled: boolean;
  settledAt?: number;
  preimage?: string;
}

export interface LightningPayment {
  id: string;
  userId: string;
  paymentHash: string;
  paymentRequest: string;
  amount: number;
  description?: string;
  status: 'pending' | 'settled' | 'failed' | 'expired';
  createdAt: number;
  settledAt?: number;
  expiresAt: number;
  metadata?: Record<string, string>;
}

export interface LightningSubscription {
  id: string;
  userId: string;
  creatorId: string;
  status: 'active' | 'inactive' | 'pending' | 'expired';
  tier: string;
  amount: number;
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: number;
  endDate?: number;
  nextPaymentDate: number;
  lastPaymentDate?: number;
  lastPaymentHash?: string;
  canceledAt?: number;
  metadata?: Record<string, string>;
}

export class LightningApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'LightningApiError';
  }
}

class LightningApiClient {
  private readonly apiBaseUrl: string;
  private readonly timeout = 10000; // 10 seconds

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  /**
   * Get authentication token from localStorage
   */
  private getAuthToken(): string {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new LightningApiError('Authentication required', 'AUTH_REQUIRED', 401);
    }
    return token;
  }

  /**
   * Make authenticated request to API with timeout and retry logic
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new LightningApiError(
          errorData.error || errorData.message || 'Request failed',
          `HTTP_${response.status}`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LightningApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new LightningApiError('Request timeout', 'TIMEOUT', 408);
      }

      throw new LightningApiError(
        error instanceof Error ? error.message : 'Network error',
        'NETWORK_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Create a Lightning invoice
   * @param request - Invoice creation request
   * @returns Lightning invoice with payment request and hash
   */
  async createInvoice(request: CreateInvoiceRequest): Promise<LightningInvoice> {
    return this.makeRequest<LightningInvoice>('/api/lightning/invoice', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Check the status of a Lightning invoice
   * @param paymentHash - Payment hash to check
   * @returns Invoice status and details
   */
  async checkInvoiceStatus(paymentHash: string): Promise<LightningInvoice> {
    return this.makeRequest<LightningInvoice>(`/api/lightning/invoice/${paymentHash}`, {
      method: 'GET',
    });
  }

  /**
   * Get payment history for the authenticated user
   * @returns Array of user's Lightning payments
   */
  async getUserPaymentHistory(): Promise<LightningPayment[]> {
    return this.makeRequest<LightningPayment[]>('/api/lightning/user/payments', {
      method: 'GET',
    });
  }

  /**
   * Get active subscriptions for the authenticated user
   * @returns Array of user's active subscriptions
   */
  async getUserSubscriptions(): Promise<LightningSubscription[]> {
    return this.makeRequest<LightningSubscription[]>('/api/lightning/user/subscriptions', {
      method: 'GET',
    });
  }

  /**
   * Create a new Lightning subscription
   * @param subscriptionData - Subscription details
   * @returns Created subscription
   */
  async createSubscription(subscriptionData: {
    creatorId: string;
    tier: string;
    amount: number;
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  }): Promise<LightningSubscription> {
    return this.makeRequest<LightningSubscription>('/api/lightning/subscription', {
      method: 'POST',
      body: JSON.stringify(subscriptionData),
    });
  }

  /**
   * Cancel a Lightning subscription
   * @param subscriptionId - ID of subscription to cancel
   * @returns Updated subscription with canceled status
   */
  async cancelSubscription(subscriptionId: string): Promise<LightningSubscription> {
    return this.makeRequest<LightningSubscription>(
      `/api/lightning/subscription/${subscriptionId}/cancel`,
      {
        method: 'PUT',
      }
    );
  }

  /**
   * Poll for payment status updates
   * @param paymentHash - Payment hash to poll
   * @param intervalMs - Polling interval in milliseconds (default: 2000)
   * @param maxAttempts - Maximum polling attempts (default: 30)
   * @returns Promise that resolves when payment is settled or rejects on timeout/failure
   */
  async pollPaymentStatus(
    paymentHash: string,
    intervalMs: number = 2000,
    maxAttempts: number = 30
  ): Promise<LightningInvoice> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        attempts++;

        try {
          const invoice = await this.checkInvoiceStatus(paymentHash);

          if (invoice.settled) {
            clearInterval(pollInterval);
            resolve(invoice);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            reject(new LightningApiError('Payment polling timeout', 'POLLING_TIMEOUT', 408));
          }
        } catch (error) {
          clearInterval(pollInterval);
          reject(error);
        }
      }, intervalMs);
    });
  }
}

// Export singleton instance
export const lightningApi = new LightningApiClient();
