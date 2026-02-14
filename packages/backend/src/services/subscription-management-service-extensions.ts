/**
 * 💎 SUBSCRIPTION MANAGEMENT SERVICE EXTENSIONS
 *
 * Additional methods for the SubscriptionManagementService
 * These extend the base service with CRUD operations for subscription tiers
 *
 * @module services/subscription-management-service-extensions
 */

import { supabase } from '../config/supabase';
import Redis from 'ioredis';
import { getRedisClient } from '../lib/redis';
import { Logger } from '../utils/logger';

// Add these methods to the SubscriptionManagementService class:

export class SubscriptionManagementServiceExtensions {
  private logger: Logger;
  private redis: Redis;

  constructor() {
    this.logger = new Logger('SubscriptionManagementServiceExt');
    this.redis = getRedisClient();
  }

  /**
   * Get all subscription tiers for a creator
   */
  async getCreatorTiers(creatorId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('is_active', true)
        .order('price_msats', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get creator tiers', error);
      throw error;
    }
  }

  /**
   * Get a specific subscription tier by ID
   */
  async getSubscriptionTier(tierId: string): Promise<any | null> {
    try {
      // Check cache first
      const cached = await this.redis.get(`tier:${tierId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      // Cache for 5 minutes
      await this.redis.setex(`tier:${tierId}`, 300, JSON.stringify(data));

      return data;
    } catch (error) {
      this.logger.error('Failed to get subscription tier', error);
      throw error;
    }
  }

  /**
   * Update a subscription tier
   */
  async updateSubscriptionTier(tierId: string, updates: any): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tierId)
        .select()
        .single();

      if (error) throw error;

      // Clear cache
      await this.redis.del(`tier:${tierId}`);

      // Notify subscribers of tier changes if price changed
      if (updates.price_msats !== undefined) {
        await this.notifyTierSubscribers(tierId, 'tier_updated', {
          changes: updates,
        });
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to update subscription tier', error);
      throw error;
    }
  }

  /**
   * Delete a subscription tier (soft delete)
   */
  async deleteSubscriptionTier(tierId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('subscription_tiers')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tierId);

      if (error) throw error;

      // Clear cache
      await this.redis.del(`tier:${tierId}`);

      // Notify subscribers
      await this.notifyTierSubscribers(tierId, 'tier_deleted', {});
    } catch (error) {
      this.logger.error('Failed to delete subscription tier', error);
      throw error;
    }
  }

  /**
   * Get active subscriptions for a tier
   */
  async getTierSubscriptions(tierId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tier_id', tierId)
        .in('status', ['active', 'pending', 'past_due']);

      if (error) throw error;

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get tier subscriptions', error);
      throw error;
    }
  }

  /**
   * Get subscribers for a specific tier with pagination
   */
  async getTierSubscribers(
    tierId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: any[]; total: number }> {
    try {
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('subscriptions')
        .select('*, users!inner(*)', { count: 'exact' })
        .eq('tier_id', tierId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get tier subscribers', error);
      throw error;
    }
  }

  /**
   * Create a new subscription for a user
   */
  async createSubscription(params: {
    user_id: string;
    tier_id: string;
  }): Promise<any> {
    try {
      // Check if user already subscribed
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', params.user_id)
        .eq('tier_id', params.tier_id)
        .eq('status', 'active')
        .single();

      if (existing) {
        throw new Error('User is already subscribed to this tier');
      }

      // Get tier details
      const tier = await this.getSubscriptionTier(params.tier_id);
      if (!tier) {
        throw new Error('Subscription tier not found');
      }

      // Calculate billing period
      const now = new Date();
      const periodEnd = this.calculateNextBillingDate(now, tier.billing_interval);

      // Create subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: params.user_id,
          tier_id: params.tier_id,
          status: 'pending', // Will be activated after payment
          started_at: now.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Create Lightning invoice
      const invoice = await this.createSubscriptionInvoice(data.id, tier.price_msats);

      return {
        subscription: data,
        invoice,
      };
    } catch (error) {
      this.logger.error('Failed to create subscription', error);
      throw error;
    }
  }

  /**
   * Get user's active subscriptions
   */
  async getUserSubscriptions(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, subscription_tiers!inner(*)')
        .eq('user_id', userId)
        .in('status', ['active', 'pending', 'past_due'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get user subscriptions', error);
      throw error;
    }
  }

  /**
   * Helper: Calculate next billing date
   */
  private calculateNextBillingDate(from: Date, interval: string): Date {
    const date = new Date(from);

    switch (interval) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }

    return date;
  }

  /**
   * Helper: Create Lightning invoice for subscription
   */
  private async createSubscriptionInvoice(
    subscriptionId: string,
    amountMsats: number
  ): Promise<any> {
    // This would integrate with the Lightning service
    // For now, return a mock invoice
    return {
      bolt11: 'lnbc' + Math.random().toString(36).substring(7),
      payment_hash: Math.random().toString(36).substring(2),
      amount_msats: amountMsats,
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    };
  }

  /**
   * Helper: Notify tier subscribers of changes
   */
  private async notifyTierSubscribers(
    tierId: string,
    event: string,
    data: any
  ): Promise<void> {
    try {
      // Get all active subscribers
      const { data: subscribers } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('tier_id', tierId)
        .eq('status', 'active');

      if (!subscribers || subscribers.length === 0) return;

      // Send notifications (would integrate with NotificationService)
      for (const subscriber of subscribers) {
        await supabase.from('notifications').insert({
          user_id: subscriber.user_id,
          type: 'subscription_update',
          title: `Subscription tier ${event.replace('_', ' ')}`,
          message: `Your subscription tier has been ${event.replace('_', ' ')}`,
          data,
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error('Failed to notify subscribers', error);
      // Non-critical error, don't throw
    }
  }
}

// Export methods to be added to the main SubscriptionManagementService class
export const subscriptionManagementExtensions = {
  getCreatorTiers: SubscriptionManagementServiceExtensions.prototype.getCreatorTiers,
  getSubscriptionTier: SubscriptionManagementServiceExtensions.prototype.getSubscriptionTier,
  updateSubscriptionTier: SubscriptionManagementServiceExtensions.prototype.updateSubscriptionTier,
  deleteSubscriptionTier: SubscriptionManagementServiceExtensions.prototype.deleteSubscriptionTier,
  getTierSubscriptions: SubscriptionManagementServiceExtensions.prototype.getTierSubscriptions,
  getTierSubscribers: SubscriptionManagementServiceExtensions.prototype.getTierSubscribers,
  createSubscription: SubscriptionManagementServiceExtensions.prototype.createSubscription,
  getUserSubscriptions: SubscriptionManagementServiceExtensions.prototype.getUserSubscriptions,
};