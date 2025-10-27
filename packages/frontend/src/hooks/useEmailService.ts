/**
 * 📧 **EMAIL SERVICE HOOK** 📧
 *
 * Comprehensive React hook for email service operations covering all user stories:
 * - US-139: Email Notifications management
 * - US-140: Newsletter functionality
 * - US-141: Email Marketing campaigns
 * - US-142: Transactional email handling
 *
 * **Features:**
 * - Intelligent caching with SWR
 * - Real-time updates via WebSocket
 * - Comprehensive error handling
 * - Optimistic updates
 * - Retry logic for failed operations
 * - TypeScript safety throughout
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2024-01-15
 */

import { useCallback, useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import {
  CreateCampaignRequest,
  CreateNewsletterRequest,
  EmailAnalyticsResponse,
  EmailCampaign,
  EmailNotification,
  EmailSegment,
  Newsletter,
  NotificationPreferences,
  SendNotificationRequest,
  SendTransactionalRequest,
  Subscriber,
  TransactionalEmail,
} from '../types/email-integration';
import { useToast } from './useToast';
import { useWebSocket } from './useWebSocket';

// API Client Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class EmailServiceAPI {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // ==========================================
  // US-139: EMAIL NOTIFICATIONS API
  // ==========================================

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>(`/email/notifications/preferences/${userId}`);
  }

  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>(`/email/notifications/preferences/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  async sendNotification(request: SendNotificationRequest): Promise<EmailNotification> {
    return this.request<EmailNotification>('/email/notifications/send', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getNotificationHistory(
    userId: string,
    filters?: any
  ): Promise<{ notifications: EmailNotification[]; total: number; page: number }> {
    const queryParams = new URLSearchParams({
      user_id: userId,
      ...filters,
    });

    return this.request<{ notifications: EmailNotification[]; total: number; page: number }>(
      `/email/notifications/history?${queryParams}`
    );
  }

  async unsubscribeFromNotifications(token: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/email/notifications/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // ==========================================
  // US-140: NEWSLETTER FUNCTIONALITY API
  // ==========================================

  async getNewsletters(creatorId: string): Promise<Newsletter[]> {
    return this.request<Newsletter[]>(`/email/newsletters?creator_id=${creatorId}`);
  }

  async createNewsletter(creatorId: string, request: CreateNewsletterRequest): Promise<Newsletter> {
    return this.request<Newsletter>('/email/newsletters', {
      method: 'POST',
      body: JSON.stringify({ creator_id: creatorId, ...request }),
    });
  }

  async updateNewsletter(newsletterId: string, updates: Partial<Newsletter>): Promise<Newsletter> {
    return this.request<Newsletter>(`/email/newsletters/${newsletterId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async scheduleNewsletter(newsletterId: string, scheduledAt: Date): Promise<Newsletter> {
    return this.request<Newsletter>(`/email/newsletters/${newsletterId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_at: scheduledAt.toISOString() }),
    });
  }

  async sendNewsletter(newsletterId: string): Promise<Newsletter> {
    return this.request<Newsletter>(`/email/newsletters/${newsletterId}/send`, {
      method: 'POST',
    });
  }

  async getNewsletterAnalytics(newsletterId: string): Promise<EmailAnalyticsResponse> {
    return this.request<EmailAnalyticsResponse>(`/email/newsletters/${newsletterId}/analytics`);
  }

  async getSubscribers(creatorId: string): Promise<Subscriber[]> {
    return this.request<Subscriber[]>(`/email/subscribers?creator_id=${creatorId}`);
  }

  async addSubscriber(
    creatorId: string,
    subscriber: Omit<Subscriber, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Subscriber> {
    return this.request<Subscriber>('/email/subscribers', {
      method: 'POST',
      body: JSON.stringify({ creator_id: creatorId, ...subscriber }),
    });
  }

  async removeSubscriber(subscriberId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/email/subscribers/${subscriberId}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // US-141: EMAIL MARKETING INTEGRATION API
  // ==========================================

  async getCampaigns(creatorId: string): Promise<EmailCampaign[]> {
    return this.request<EmailCampaign[]>(`/email/campaigns?creator_id=${creatorId}`);
  }

  async createCampaign(creatorId: string, request: CreateCampaignRequest): Promise<EmailCampaign> {
    return this.request<EmailCampaign>('/email/campaigns', {
      method: 'POST',
      body: JSON.stringify({ creator_id: creatorId, ...request }),
    });
  }

  async sendCampaign(campaignId: string): Promise<EmailCampaign> {
    return this.request<EmailCampaign>(`/email/campaigns/${campaignId}/send`, {
      method: 'POST',
    });
  }

  async getCampaignAnalytics(campaignId: string): Promise<EmailAnalyticsResponse> {
    return this.request<EmailAnalyticsResponse>(`/email/campaigns/${campaignId}/analytics`);
  }

  async getEmailSegments(creatorId: string): Promise<EmailSegment[]> {
    return this.request<EmailSegment[]>(`/email/segments?creator_id=${creatorId}`);
  }

  async createEmailSegment(
    creatorId: string,
    segment: Omit<EmailSegment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<EmailSegment> {
    return this.request<EmailSegment>('/email/segments', {
      method: 'POST',
      body: JSON.stringify({ creator_id: creatorId, ...segment }),
    });
  }

  // ==========================================
  // US-142: TRANSACTIONAL EMAIL API
  // ==========================================

  async sendTransactionalEmail(request: SendTransactionalRequest): Promise<TransactionalEmail> {
    return this.request<TransactionalEmail>('/email/transactional/send', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getTransactionalEmails(filters?: any): Promise<TransactionalEmail[]> {
    const queryParams = new URLSearchParams(filters);
    return this.request<TransactionalEmail[]>(`/email/transactional?${queryParams}`);
  }

  async retryTransactionalEmail(emailId: string): Promise<TransactionalEmail> {
    return this.request<TransactionalEmail>(`/email/transactional/${emailId}/retry`, {
      method: 'POST',
    });
  }

  async getDeliveryStatus(emailId: string): Promise<{ status: string; details: any }> {
    return this.request<{ status: string; details: any }>(`/email/transactional/${emailId}/status`);
  }

  // ==========================================
  // ANALYTICS AND REPORTING API
  // ==========================================

  async getEmailAnalytics(filters: any): Promise<EmailAnalyticsResponse> {
    const queryParams = new URLSearchParams(filters);
    return this.request<EmailAnalyticsResponse>(`/email/analytics?${queryParams}`);
  }

  async generateReport(reportConfig: any): Promise<{ reportId: string; downloadUrl: string }> {
    return this.request<{ reportId: string; downloadUrl: string }>('/email/reports/generate', {
      method: 'POST',
      body: JSON.stringify(reportConfig),
    });
  }
}

// Initialize API client
const emailAPI = new EmailServiceAPI(API_BASE_URL);

// SWR configuration
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  refreshInterval: 30000, // 30 seconds
  errorRetryCount: 3,
  errorRetryInterval: 5000,
};

/**
 * Main Email Service Hook
 */
export const useEmailService = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  // WebSocket connection for real-time updates
  const { socket, isConnected } = useWebSocket('/email');

  // Setup real-time listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handlers = {
      'email:sent': (data: any) => {
        toast({
          title: 'Email Sent',
          description: `Email "${data.subject}" has been sent successfully.`,
          variant: 'default',
        });

        // Invalidate relevant caches
        mutate((key) => typeof key === 'string' && key.includes('/email/'), undefined, false);
      },

      'email:delivered': (data: any) => {
        // Update delivery status in cache
        mutate(`/email/transactional/${data.id}/status`, { status: 'delivered' }, false);
      },

      'email:bounced': (data: any) => {
        toast({
          title: 'Email Bounced',
          description: `Email to ${data.recipient} could not be delivered.`,
          variant: 'destructive',
        });
      },

      'newsletter:sent': (data: any) => {
        toast({
          title: 'Newsletter Sent',
          description: `Newsletter "${data.title}" has been sent to ${data.recipient_count} subscribers.`,
          variant: 'default',
        });

        // Refresh newsletters and analytics
        mutate(
          (key) => typeof key === 'string' && key.includes('/email/newsletters'),
          undefined,
          false
        );
      },

      'campaign:completed': (data: any) => {
        toast({
          title: 'Campaign Completed',
          description: `Campaign "${data.name}" has finished sending.`,
          variant: 'default',
        });

        // Refresh campaigns
        mutate(
          (key) => typeof key === 'string' && key.includes('/email/campaigns'),
          undefined,
          false
        );
      },
    };

    // Register event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup
    return () => {
      Object.keys(handlers).forEach((event) => {
        socket.off(event);
      });
    };
  }, [socket, isConnected, toast]);

  // ==========================================
  // US-139: EMAIL NOTIFICATIONS HOOKS
  // ==========================================

  const useNotificationPreferences = (userId: string) => {
    const {
      data,
      error,
      mutate: mutatePreferences,
    } = useSWR(
      userId ? `/email/notifications/preferences/${userId}` : null,
      () => emailAPI.getNotificationPreferences(userId),
      swrConfig
    );

    const updatePreferences = useCallback(
      async (updates: Partial<NotificationPreferences>) => {
        try {
          setLoading(true);
          setError(null);

          // Optimistic update
          mutatePreferences(
            (current: NotificationPreferences) => ({ ...current, ...updates }),
            false
          );

          const updated = await emailAPI.updateNotificationPreferences(userId, updates);

          // Revalidate with server data
          mutatePreferences(updated);

          return updated;
        } catch (err: any) {
          setError(err.message);
          // Revert optimistic update
          mutatePreferences();
          throw err;
        } finally {
          setLoading(false);
        }
      },
      [userId, mutatePreferences]
    );

    return {
      preferences: data,
      loading: !data && !error,
      error,
      updatePreferences,
      mutate: mutatePreferences,
    };
  };

  const sendNotification = useCallback(async (request: SendNotificationRequest) => {
    try {
      setLoading(true);
      setError(null);

      const result = await emailAPI.sendNotification(request);

      // Invalidate notification history
      mutate(
        (key) => typeof key === 'string' && key.includes('/email/notifications/history'),
        undefined,
        false
      );

      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const useNotificationHistory = (userId: string, filters?: any) => {
    const { data, error } = useSWR(
      userId ? [`/email/notifications/history`, userId, filters] : null,
      () => emailAPI.getNotificationHistory(userId, filters),
      swrConfig
    );

    return {
      notifications: data?.notifications || [],
      total: data?.total || 0,
      loading: !data && !error,
      error,
    };
  };

  // ==========================================
  // US-140: NEWSLETTER FUNCTIONALITY HOOKS
  // ==========================================

  const useNewsletters = (creatorId: string) => {
    const {
      data,
      error,
      mutate: mutateNewsletters,
    } = useSWR(
      creatorId ? `/email/newsletters?creator_id=${creatorId}` : null,
      () => emailAPI.getNewsletters(creatorId),
      swrConfig
    );

    const createNewsletter = useCallback(
      async (request: CreateNewsletterRequest) => {
        try {
          setLoading(true);
          setError(null);

          const newsletter = await emailAPI.createNewsletter(creatorId, request);

          // Add to cache optimistically
          mutateNewsletters((current: Newsletter[]) => [newsletter, ...(current || [])], false);

          return newsletter;
        } catch (err: any) {
          setError(err.message);
          // Revert optimistic update
          mutateNewsletters();
          throw err;
        } finally {
          setLoading(false);
        }
      },
      [creatorId, mutateNewsletters]
    );

    const scheduleNewsletter = useCallback(
      async (newsletterId: string, scheduledAt: Date) => {
        try {
          setLoading(true);
          const updated = await emailAPI.scheduleNewsletter(newsletterId, scheduledAt);

          // Update in cache
          mutateNewsletters(
            (current: Newsletter[]) =>
              current?.map((n) => (n.id === newsletterId ? updated : n)) || [],
            false
          );

          return updated;
        } catch (err: any) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      },
      [mutateNewsletters]
    );

    const sendNewsletter = useCallback(
      async (newsletterId: string) => {
        try {
          setLoading(true);
          const sent = await emailAPI.sendNewsletter(newsletterId);

          // Update in cache
          mutateNewsletters(
            (current: Newsletter[]) =>
              current?.map((n) => (n.id === newsletterId ? sent : n)) || [],
            false
          );

          return sent;
        } catch (err: any) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      },
      [mutateNewsletters]
    );

    return {
      newsletters: data || [],
      loading: !data && !error,
      error,
      createNewsletter,
      scheduleNewsletter,
      sendNewsletter,
      mutate: mutateNewsletters,
    };
  };

  const useSubscribers = (creatorId: string) => {
    const {
      data,
      error,
      mutate: mutateSubscribers,
    } = useSWR(
      creatorId ? `/email/subscribers?creator_id=${creatorId}` : null,
      () => emailAPI.getSubscribers(creatorId),
      swrConfig
    );

    const addSubscriber = useCallback(
      async (subscriber: Omit<Subscriber, 'id' | 'created_at' | 'updated_at'>) => {
        try {
          setLoading(true);
          const newSubscriber = await emailAPI.addSubscriber(creatorId, subscriber);

          // Add to cache
          mutateSubscribers((current: Subscriber[]) => [newSubscriber, ...(current || [])], false);

          return newSubscriber;
        } catch (err: any) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      },
      [creatorId, mutateSubscribers]
    );

    return {
      subscribers: data || [],
      loading: !data && !error,
      error,
      addSubscriber,
      mutate: mutateSubscribers,
    };
  };

  // ==========================================
  // US-141: EMAIL MARKETING HOOKS
  // ==========================================

  const useCampaigns = (creatorId: string) => {
    const {
      data,
      error,
      mutate: mutateCampaigns,
    } = useSWR(
      creatorId ? `/email/campaigns?creator_id=${creatorId}` : null,
      () => emailAPI.getCampaigns(creatorId),
      swrConfig
    );

    const createCampaign = useCallback(
      async (request: CreateCampaignRequest) => {
        try {
          setLoading(true);
          const campaign = await emailAPI.createCampaign(creatorId, request);

          // Add to cache
          mutateCampaigns((current: EmailCampaign[]) => [campaign, ...(current || [])], false);

          return campaign;
        } catch (err: any) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      },
      [creatorId, mutateCampaigns]
    );

    const sendCampaign = useCallback(
      async (campaignId: string) => {
        try {
          setLoading(true);
          const sent = await emailAPI.sendCampaign(campaignId);

          // Update in cache
          mutateCampaigns(
            (current: EmailCampaign[]) =>
              current?.map((c) => (c.id === campaignId ? sent : c)) || [],
            false
          );

          return sent;
        } catch (err: any) {
          setError(err.message);
          throw err;
        } finally {
          setLoading(false);
        }
      },
      [mutateCampaigns]
    );

    return {
      campaigns: data || [],
      loading: !data && !error,
      error,
      createCampaign,
      sendCampaign,
      mutate: mutateCampaigns,
    };
  };

  // ==========================================
  // US-142: TRANSACTIONAL EMAIL HOOKS
  // ==========================================

  const sendTransactionalEmail = useCallback(async (request: SendTransactionalRequest) => {
    try {
      setLoading(true);
      setError(null);

      const result = await emailAPI.sendTransactionalEmail(request);

      // Invalidate transactional emails list
      mutate(
        (key) => typeof key === 'string' && key.includes('/email/transactional'),
        undefined,
        false
      );

      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const useTransactionalEmails = (filters?: any) => {
    const { data, error } = useSWR(
      [`/email/transactional`, filters],
      () => emailAPI.getTransactionalEmails(filters),
      swrConfig
    );

    return {
      emails: data || [],
      loading: !data && !error,
      error,
    };
  };

  // ==========================================
  // ANALYTICS HOOKS
  // ==========================================

  const useEmailAnalytics = (filters: any) => {
    const { data, error } = useSWR(
      [`/email/analytics`, filters],
      () => emailAPI.getEmailAnalytics(filters),
      swrConfig
    );

    return {
      analytics: data,
      loading: !data && !error,
      error,
    };
  };

  // ==========================================
  // RETURN INTERFACE
  // ==========================================

  return {
    // State
    loading,
    error,
    isConnected,

    // US-139: Email Notifications
    useNotificationPreferences,
    sendNotification,
    useNotificationHistory,
    getNotificationPreferences: emailAPI.getNotificationPreferences.bind(emailAPI),
    updateNotificationPreferences: emailAPI.updateNotificationPreferences.bind(emailAPI),

    // US-140: Newsletter Functionality
    useNewsletters,
    useSubscribers,
    getNewsletterAnalytics: emailAPI.getNewsletterAnalytics.bind(emailAPI),

    // US-141: Email Marketing
    useCampaigns,
    getCampaignAnalytics: emailAPI.getCampaignAnalytics.bind(emailAPI),
    getEmailSegments: emailAPI.getEmailSegments.bind(emailAPI),
    createEmailSegment: emailAPI.createEmailSegment.bind(emailAPI),

    // US-142: Transactional Email
    sendTransactionalEmail,
    useTransactionalEmails,
    retryTransactionalEmail: emailAPI.retryTransactionalEmail.bind(emailAPI),
    getDeliveryStatus: emailAPI.getDeliveryStatus.bind(emailAPI),

    // Analytics
    useEmailAnalytics,
    generateReport: emailAPI.generateReport.bind(emailAPI),

    // Cache management
    clearCache: () => mutate(() => true, undefined, false),
    refreshData: () => mutate(() => true),
  };
};

export default useEmailService;
