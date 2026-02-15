/**
 * API Response Types matching Phase 1 API Contract (docs/api-spec.md)
 */

// -- Response Envelope --

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  code?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// -- Auth Types --

export interface AuthChallenge {
  challenge: string;
  timestamp: number;
  expires_at: number;
  message: string;
}

export interface AuthenticateRequest {
  nostr_pubkey: string;
  challenge: string;
  timestamp: number;
  signature: string;
  role?: 'creator' | 'supporter' | 'admin';
}

export interface AuthToken {
  token: string;
  user: {
    nostr_pubkey: string;
    role: string;
    signature_verified: boolean;
  };
  expires_in: string;
}

// -- User Types --

export interface UserProfile {
  id: string;
  nostr_pubkey: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  role: 'creator' | 'supporter' | 'admin';
  nip05_verified: boolean;
  lightning_address: string;
  stats: {
    follower_count: number;
    post_count: number;
    total_supporters: number;
  };
  subscription_tiers: SubscriptionTier[];
  created_at: string;
}

export interface UserProfileUpdate {
  display_name?: string;
  bio?: string;
  website?: string;
  lightning_address?: string;
}

export interface UserAnalytics {
  user_id: string;
  timeframe: string;
  metrics: {
    profileViews: number;
    followersGained: number;
    supportReceived: number;
    contentEngagement: number;
    earningsGrowth: number;
  };
}

// -- Content Types --

export interface ContentPublishRequest {
  title: string;
  content_type: 'article' | 'video' | 'audio' | 'image' | 'livestream' | 'course';
  description: string;
  content_url?: string;
  thumbnail_url?: string;
  visibility: 'public' | 'private' | 'supporters_only' | 'paid';
  is_monetized?: boolean;
  price_sats?: number;
  tags?: string[];
  category?: string;
  language?: string;
  publish_to_nostr?: boolean;
}

export interface ContentSearchResult {
  id: string;
  title: string;
  description: string;
  content_type: string;
  creator: {
    id: string;
    display_name: string;
    avatar_url: string;
  };
  visibility: string;
  view_count: number;
  like_count: number;
  published_at: string;
}

export interface ContentRecommendation {
  id: string;
  title: string;
  score: number;
  reason: string;
}

export interface ContentAnalytics {
  content_id: string;
  views: number;
  unique_viewers: number;
  likes: number;
  comments: number;
  shares: number;
  earnings_sats: number;
  engagement_rate: number;
  view_history: Array<{ date: string; views: number }>;
}

// -- Payment Types --

export interface CreateInvoiceRequest {
  amount_sats: number;
  recipient_id: string;
  content_id?: string;
  payment_type: 'subscription' | 'tip' | 'one_time' | 'commission';
  description: string;
  memo?: string;
}

export interface Invoice {
  id: string;
  payment_request: string;
  payment_hash: string;
  amount_sats: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
}

export interface PaymentResult {
  id: string;
  status: 'paid';
  preimage: string;
  fee_sats: number;
  paid_at: string;
}

export interface CurrencyConversion {
  from: string;
  to: string;
  amount: number;
  converted: number;
  sats: number;
  rate: number;
  timestamp: string;
}

// -- Subscription Types --

export interface SubscriptionTier {
  id: string;
  name: string;
  price_sats: number;
  features: string[];
}

export interface CreateSubscriptionRequest {
  creator_id: string;
  tier_id: string;
  billing_interval: 'monthly' | 'yearly';
}

export interface SubscriptionResponse {
  id: string;
  creator_id: string;
  tier_id: string;
  status: 'active' | 'cancelled' | 'past_due';
  start_date: string;
  next_billing_date: string;
  amount_sats: number;
  initial_invoice: {
    payment_request: string;
    payment_hash: string;
  };
}

export interface CancelSubscriptionRequest {
  reason?: string;
  cancel_at_period_end?: boolean;
}

// -- Payment Analytics --

export interface PaymentAnalytics {
  total_revenue_sats: number;
  total_transactions: number;
  average_payment_sats: number;
  mrr_sats: number;
  subscriber_count: number;
  revenue_by_day: Array<{ date: string; revenue_sats: number; count: number }>;
}

// -- Search Params --

export interface ContentSearchParams {
  q: string;
  content_type?: string;
  category?: string;
  visibility?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sort?: string;
}
