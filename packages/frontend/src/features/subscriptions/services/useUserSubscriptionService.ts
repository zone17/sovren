/**
 * 💳 **ELITE USER SUBSCRIPTION SERVICE**
 *
 * Comprehensive service for user subscription management
 * Stories: US-079, US-080, US-081, US-082
 *
 * Features:
 * - Real-time subscription status tracking
 * - Payment method management
 * - Renewal settings configuration
 * - Subscription history analytics
 * - Lightning Network integration
 * - Comprehensive error handling
 */

import { useCallback, useState } from 'react';
import { z } from 'zod';

// Type Definitions
interface UserSubscription {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar?: string;
  tier_name: string;
  tier_id: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'pending';
  amount_sats: number;
  billing_interval: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  payment_method_id: string;
  last_payment_date?: string;
  next_payment_date?: string;
  benefits: string[];
  usage_stats?: {
    content_accessed: number;
    total_value_received: number;
  };
}

interface PaymentMethod {
  id: string;
  type: 'lightning' | 'bitcoin' | 'nostr';
  name: string;
  identifier: string;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
  last_used?: string;
  failure_count: number;
}

interface SubscriptionHistory {
  id: string;
  subscription_id: string;
  creator_name: string;
  tier_name: string;
  amount_sats: number;
  action: 'subscribed' | 'renewed' | 'cancelled' | 'paused' | 'resumed';
  date: string;
  payment_hash?: string;
  notes?: string;
}

interface RenewalSettings {
  auto_renew: boolean;
  notifications: {
    seven_days_before: boolean;
    one_day_before: boolean;
    after_renewal: boolean;
  };
  failure_handling: {
    retry_failed_payments: boolean;
    notify_failures: boolean;
    max_retries: number;
  };
}

// API Configuration
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Validation Schemas
const UserSubscriptionSchema = z.object({
  id: z.string(),
  creator_id: z.string(),
  creator_name: z.string(),
  creator_avatar: z.string().optional(),
  tier_name: z.string(),
  tier_id: z.string(),
  status: z.enum(['active', 'paused', 'cancelled', 'expired', 'pending']),
  amount_sats: z.number().positive(),
  billing_interval: z.enum(['monthly', 'quarterly', 'yearly']),
  start_date: z.string(),
  end_date: z.string(),
  auto_renew: z.boolean(),
  payment_method_id: z.string(),
  last_payment_date: z.string().optional(),
  next_payment_date: z.string().optional(),
  benefits: z.array(z.string()),
  usage_stats: z
    .object({
      content_accessed: z.number(),
      total_value_received: z.number(),
    })
    .optional(),
});

const PaymentMethodSchema = z.object({
  id: z.string(),
  type: z.enum(['lightning', 'bitcoin', 'nostr']),
  name: z.string(),
  identifier: z.string(),
  is_default: z.boolean(),
  is_verified: z.boolean(),
  created_at: z.string(),
  last_used: z.string().optional(),
  failure_count: z.number().nonnegative(),
});

// Mock Data Service (for development/testing)
class MockUserSubscriptionService {
  private subscriptions: UserSubscription[] = [
    {
      id: 'sub-1',
      creator_id: 'creator-1',
      creator_name: 'Tech Creator Pro',
      creator_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tech',
      tier_name: 'Premium Access',
      tier_id: 'tier-1',
      status: 'active',
      amount_sats: 50000,
      billing_interval: 'monthly',
      start_date: '2024-01-01T00:00:00Z',
      end_date: '2024-02-01T00:00:00Z',
      auto_renew: true,
      payment_method_id: 'pm-1',
      last_payment_date: '2024-01-01T00:00:00Z',
      next_payment_date: '2024-02-01T00:00:00Z',
      benefits: ['Premium Content', 'Direct Messaging', 'Early Access', 'Exclusive Videos'],
      usage_stats: {
        content_accessed: 23,
        total_value_received: 125000,
      },
    },
    {
      id: 'sub-2',
      creator_id: 'creator-2',
      creator_name: 'Art Masterclass',
      creator_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=art',
      tier_name: 'Basic Support',
      tier_id: 'tier-2',
      status: 'paused',
      amount_sats: 25000,
      billing_interval: 'monthly',
      start_date: '2024-01-15T00:00:00Z',
      end_date: '2024-02-15T00:00:00Z',
      auto_renew: false,
      payment_method_id: 'pm-2',
      last_payment_date: '2024-01-15T00:00:00Z',
      next_payment_date: '2024-02-15T00:00:00Z',
      benefits: ['Basic Content', 'Community Access'],
      usage_stats: {
        content_accessed: 8,
        total_value_received: 45000,
      },
    },
    {
      id: 'sub-3',
      creator_id: 'creator-3',
      creator_name: 'Coding Tutorials',
      creator_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=code',
      tier_name: 'Pro Developer',
      tier_id: 'tier-3',
      status: 'active',
      amount_sats: 100000,
      billing_interval: 'quarterly',
      start_date: '2024-01-01T00:00:00Z',
      end_date: '2024-04-01T00:00:00Z',
      auto_renew: true,
      payment_method_id: 'pm-1',
      last_payment_date: '2024-01-01T00:00:00Z',
      next_payment_date: '2024-04-01T00:00:00Z',
      benefits: ['All Content', 'Code Reviews', 'One-on-One Sessions', 'Private Repository Access'],
      usage_stats: {
        content_accessed: 45,
        total_value_received: 350000,
      },
    },
  ];

  private paymentMethods: PaymentMethod[] = [
    {
      id: 'pm-1',
      type: 'lightning',
      name: 'Primary Lightning Wallet',
      identifier: 'user@getalby.com',
      is_default: true,
      is_verified: true,
      created_at: '2024-01-01T00:00:00Z',
      last_used: '2024-01-25T12:00:00Z',
      failure_count: 0,
    },
    {
      id: 'pm-2',
      type: 'lightning',
      name: 'Secondary Wallet',
      identifier: 'lnbc1...wallet2',
      is_default: false,
      is_verified: true,
      created_at: '2024-01-10T00:00:00Z',
      last_used: '2024-01-20T15:30:00Z',
      failure_count: 1,
    },
    {
      id: 'pm-3',
      type: 'nostr',
      name: 'NOSTR Identity',
      identifier: 'npub1abc...def',
      is_default: false,
      is_verified: false,
      created_at: '2024-01-15T00:00:00Z',
      failure_count: 0,
    },
  ];

  private subscriptionHistory: SubscriptionHistory[] = [
    {
      id: 'hist-1',
      subscription_id: 'sub-1',
      creator_name: 'Tech Creator Pro',
      tier_name: 'Premium Access',
      amount_sats: 50000,
      action: 'renewed',
      date: '2024-01-25T10:30:00Z',
      payment_hash: 'abc123def456...',
      notes: 'Automatic renewal successful',
    },
    {
      id: 'hist-2',
      subscription_id: 'sub-2',
      creator_name: 'Art Masterclass',
      tier_name: 'Basic Support',
      amount_sats: 25000,
      action: 'paused',
      date: '2024-01-20T14:15:00Z',
      notes: 'User requested pause',
    },
    {
      id: 'hist-3',
      subscription_id: 'sub-3',
      creator_name: 'Coding Tutorials',
      tier_name: 'Pro Developer',
      amount_sats: 100000,
      action: 'subscribed',
      date: '2024-01-01T09:00:00Z',
      payment_hash: 'xyz789uvw012...',
      notes: 'Initial subscription payment',
    },
    {
      id: 'hist-4',
      subscription_id: 'sub-1',
      creator_name: 'Tech Creator Pro',
      tier_name: 'Premium Access',
      amount_sats: 50000,
      action: 'subscribed',
      date: '2024-01-01T08:30:00Z',
      payment_hash: 'def456ghi789...',
      notes: 'Initial subscription payment',
    },
  ];

  async getSubscriptions(): Promise<UserSubscription[]> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return [...this.subscriptions];
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...this.paymentMethods];
  }

  async getSubscriptionHistory(): Promise<SubscriptionHistory[]> {
    await new Promise(resolve => setTimeout(resolve, 400));
    return [...this.subscriptionHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async toggleAutoRenew(subscriptionId: string, autoRenew: boolean): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (subscription) {
      subscription.auto_renew = autoRenew;

      // Add history entry
      this.subscriptionHistory.push({
        id: `hist-${Date.now()}`,
        subscription_id: subscriptionId,
        creator_name: subscription.creator_name,
        tier_name: subscription.tier_name,
        amount_sats: 0,
        action: autoRenew ? 'resumed' : 'paused',
        date: new Date().toISOString(),
        notes: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'}`,
      });
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));

    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (subscription) {
      subscription.status = 'cancelled';
      subscription.auto_renew = false;

      this.subscriptionHistory.push({
        id: `hist-${Date.now()}`,
        subscription_id: subscriptionId,
        creator_name: subscription.creator_name,
        tier_name: subscription.tier_name,
        amount_sats: 0,
        action: 'cancelled',
        date: new Date().toISOString(),
        notes: 'User requested cancellation',
      });
    }
  }

  async pauseSubscription(subscriptionId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 250));

    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (subscription) {
      subscription.status = 'paused';

      this.subscriptionHistory.push({
        id: `hist-${Date.now()}`,
        subscription_id: subscriptionId,
        creator_name: subscription.creator_name,
        tier_name: subscription.tier_name,
        amount_sats: 0,
        action: 'paused',
        date: new Date().toISOString(),
        notes: 'User requested pause',
      });
    }
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 250));

    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (subscription) {
      subscription.status = 'active';

      this.subscriptionHistory.push({
        id: `hist-${Date.now()}`,
        subscription_id: subscriptionId,
        creator_name: subscription.creator_name,
        tier_name: subscription.tier_name,
        amount_sats: 0,
        action: 'resumed',
        date: new Date().toISOString(),
        notes: 'User resumed subscription',
      });
    }
  }

  async addPaymentMethod(
    method: Omit<PaymentMethod, 'id' | 'created_at' | 'failure_count'>
  ): Promise<PaymentMethod> {
    await new Promise(resolve => setTimeout(resolve, 400));

    const newMethod: PaymentMethod = {
      ...method,
      id: `pm-${Date.now()}`,
      created_at: new Date().toISOString(),
      failure_count: 0,
    };

    // If this is the first payment method, make it default
    if (this.paymentMethods.length === 0) {
      newMethod.is_default = true;
    }

    this.paymentMethods.push(newMethod);
    return newMethod;
  }

  async updatePaymentMethod(methodId: string, updates: Partial<PaymentMethod>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const method = this.paymentMethods.find(m => m.id === methodId);
    if (method) {
      Object.assign(method, updates);
    }
  }

  async deletePaymentMethod(methodId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const index = this.paymentMethods.findIndex(m => m.id === methodId);
    if (index !== -1) {
      const wasDefault = this.paymentMethods[index].is_default;
      this.paymentMethods.splice(index, 1);

      // If deleted method was default, make the first remaining method default
      if (wasDefault && this.paymentMethods.length > 0) {
        this.paymentMethods[0].is_default = true;
      }
    }
  }

  async setDefaultPaymentMethod(methodId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 150));

    // Remove default from all methods
    this.paymentMethods.forEach(m => (m.is_default = false));

    // Set new default
    const method = this.paymentMethods.find(m => m.id === methodId);
    if (method) {
      method.is_default = true;
    }
  }

  async updateRenewalSettings(
    subscriptionId: string,
    settings: Partial<RenewalSettings>
  ): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));

    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (subscription && settings.auto_renew !== undefined) {
      subscription.auto_renew = settings.auto_renew;
    }
  }

  async exportSubscriptionHistory(): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate CSV content
    const headers = ['Date', 'Creator', 'Tier', 'Action', 'Amount (sats)', 'Payment Hash', 'Notes'];
    const rows = this.subscriptionHistory.map(item => [
      new Date(item.date).toLocaleDateString(),
      item.creator_name,
      item.tier_name,
      item.action,
      item.amount_sats.toString(),
      item.payment_hash || '',
      item.notes || '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subscription-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return csvContent;
  }
}

// Production API Service
class ProductionUserSubscriptionService {
  private async apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async getSubscriptions(): Promise<UserSubscription[]> {
    const data = await this.apiCall('/api/user/subscriptions');
    return z.array(UserSubscriptionSchema).parse(data);
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const data = await this.apiCall('/api/user/payment-methods');
    return z.array(PaymentMethodSchema).parse(data);
  }

  async getSubscriptionHistory(): Promise<SubscriptionHistory[]> {
    const data = await this.apiCall('/api/user/subscription-history');
    return data;
  }

  async toggleAutoRenew(subscriptionId: string, autoRenew: boolean): Promise<void> {
    await this.apiCall(`/api/user/subscriptions/${subscriptionId}/auto-renew`, {
      method: 'PATCH',
      body: JSON.stringify({ auto_renew: autoRenew }),
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.apiCall(`/api/user/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
    });
  }

  async pauseSubscription(subscriptionId: string): Promise<void> {
    await this.apiCall(`/api/user/subscriptions/${subscriptionId}/pause`, {
      method: 'POST',
    });
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await this.apiCall(`/api/user/subscriptions/${subscriptionId}/resume`, {
      method: 'POST',
    });
  }

  async addPaymentMethod(
    method: Omit<PaymentMethod, 'id' | 'created_at' | 'failure_count'>
  ): Promise<PaymentMethod> {
    const data = await this.apiCall('/api/user/payment-methods', {
      method: 'POST',
      body: JSON.stringify(method),
    });
    return PaymentMethodSchema.parse(data);
  }

  async updatePaymentMethod(methodId: string, updates: Partial<PaymentMethod>): Promise<void> {
    await this.apiCall(`/api/user/payment-methods/${methodId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deletePaymentMethod(methodId: string): Promise<void> {
    await this.apiCall(`/api/user/payment-methods/${methodId}`, {
      method: 'DELETE',
    });
  }

  async setDefaultPaymentMethod(methodId: string): Promise<void> {
    await this.apiCall(`/api/user/payment-methods/${methodId}/set-default`, {
      method: 'POST',
    });
  }

  async updateRenewalSettings(
    subscriptionId: string,
    settings: Partial<RenewalSettings>
  ): Promise<void> {
    await this.apiCall(`/api/user/subscriptions/${subscriptionId}/renewal-settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  async exportSubscriptionHistory(): Promise<string> {
    const response = await fetch(`${API_BASE}/api/user/subscription-history/export`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to export subscription history');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subscription-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return 'Export completed';
  }
}

// Service Hook
export const useUserSubscriptionService = () => {
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use mock service for development, production service for production
  const service =
    process.env.NODE_ENV === 'development'
      ? new MockUserSubscriptionService()
      : new ProductionUserSubscriptionService();

  const refreshSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [subs, methods, history] = await Promise.all([
        service.getSubscriptions(),
        service.getPaymentMethods(),
        service.getSubscriptionHistory(),
      ]);

      setSubscriptions(subs);
      setPaymentMethods(methods);
      setSubscriptionHistory(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [service]);

  const toggleAutoRenew = useCallback(
    async (subscriptionId: string, autoRenew: boolean) => {
      try {
        await service.toggleAutoRenew(subscriptionId, autoRenew);
        await refreshSubscriptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update auto-renewal');
      }
    },
    [service, refreshSubscriptions]
  );

  const cancelSubscription = useCallback(
    async (subscriptionId: string) => {
      try {
        await service.cancelSubscription(subscriptionId);
        await refreshSubscriptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
      }
    },
    [service, refreshSubscriptions]
  );

  const pauseSubscription = useCallback(
    async (subscriptionId: string) => {
      try {
        await service.pauseSubscription(subscriptionId);
        await refreshSubscriptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to pause subscription');
      }
    },
    [service, refreshSubscriptions]
  );

  const resumeSubscription = useCallback(
    async (subscriptionId: string) => {
      try {
        await service.resumeSubscription(subscriptionId);
        await refreshSubscriptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to resume subscription');
      }
    },
    [service, refreshSubscriptions]
  );

  const addPaymentMethod = useCallback(async () => {
    try {
      // This would typically open a modal for adding payment methods
      // For now, we'll add a sample method
      await service.addPaymentMethod({
        type: 'lightning',
        name: 'New Lightning Wallet',
        identifier: 'newuser@getalby.com',
        is_default: false,
        is_verified: false,
      });
      await refreshSubscriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payment method');
    }
  }, [service, refreshSubscriptions]);

  const updatePaymentMethod = useCallback(
    async (methodId: string, updates: Partial<PaymentMethod>) => {
      try {
        await service.updatePaymentMethod(methodId, updates);
        await refreshSubscriptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update payment method');
      }
    },
    [service, refreshSubscriptions]
  );

  const deletePaymentMethod = useCallback(
    async (methodId: string) => {
      try {
        await service.deletePaymentMethod(methodId);
        await refreshSubscriptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete payment method');
      }
    },
    [service, refreshSubscriptions]
  );

  const setDefaultPaymentMethod = useCallback(
    async (methodId: string) => {
      try {
        await service.setDefaultPaymentMethod(methodId);
        await refreshSubscriptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set default payment method');
      }
    },
    [service, refreshSubscriptions]
  );

  const updateRenewalSettings = useCallback(
    async (subscriptionId: string, settings: any) => {
      try {
        await service.updateRenewalSettings(subscriptionId, settings);
        await refreshSubscriptions();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update renewal settings');
      }
    },
    [service, refreshSubscriptions]
  );

  const exportSubscriptionHistory = useCallback(async () => {
    try {
      await service.exportSubscriptionHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export subscription history');
    }
  }, [service]);

  return {
    subscriptions,
    paymentMethods,
    subscriptionHistory,
    loading,
    error,
    refreshSubscriptions,
    toggleAutoRenew,
    cancelSubscription,
    pauseSubscription,
    resumeSubscription,
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    setDefaultPaymentMethod,
    updateRenewalSettings,
    exportSubscriptionHistory,
  };
};
