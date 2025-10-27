/**
 * 🎯 SOVREN CUSTOM NOSTR IMPLEMENTATION POSSIBILITIES (NIPs)
 *
 * US-320: Custom Sovren NOSTR Extensions
 * Epic 003 Wave 5: NOSTR Consolidation - Custom NIPs
 *
 * Platform-specific NOSTR event kinds for Sovren creator monetization,
 * analytics, and advanced features not covered by standard NIPs.
 *
 * Event Kind Ranges:
 * - 30078-30082: Sovren creator and monetization events
 * - All kinds are parameterized replaceable (30000-39999 range per NIP-33)
 *
 * NOSTR Protocol Compliance:
 * - Follows NIP-01 event structure
 * - Uses NIP-33 parameterized replaceable event pattern
 * - Compatible with standard NOSTR clients
 * - Backward compatible with existing NIPs
 *
 * @author Sovren Development Team
 * @since Epic 003 Wave 5
 */

import { z } from 'zod';
import type { NostrEvent } from './events';

// ========================================
// CUSTOM EVENT KIND DEFINITIONS
// ========================================

/**
 * Sovren-specific NOSTR event kinds
 * Range: 30078-30082 (parameterized replaceable events)
 */
export enum SovrenEventKind {
  /**
   * Kind 30078: Enhanced Creator Profile
   * Extends NIP-01 kind 0 metadata with creator-specific fields
   */
  CREATOR_PROFILE_EXTENDED = 30078,

  /**
   * Kind 30079: Content Monetization Settings
   * Paywall configuration, pricing tiers, Lightning payment info
   */
  CONTENT_MONETIZATION = 30079,

  /**
   * Kind 30080: Analytics Event
   * View tracking, engagement metrics, revenue analytics
   */
  ANALYTICS_EVENT = 30080,

  /**
   * Kind 30081: Subscription Management
   * Subscriber tiers, benefits, active subscription counts
   */
  SUBSCRIPTION_MANAGEMENT = 30081,

  /**
   * Kind 30082: AI-Powered Content Recommendations
   * Personalized content feeds, ML-driven suggestions
   */
  CONTENT_RECOMMENDATIONS = 30082,
}

// ========================================
// KIND 30078: CREATOR PROFILE EXTENDED
// ========================================

/**
 * Social media platform types
 */
export enum SocialPlatform {
  TWITTER = 'twitter',
  YOUTUBE = 'youtube',
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
  GITHUB = 'github',
  LINKEDIN = 'linkedin',
  TWITCH = 'twitch',
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  WEBSITE = 'website',
}

/**
 * Social media link
 */
export const SocialLinkSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  url: z.string().url('Must be a valid URL'),
  username: z.string().optional(),
  verified: z.boolean().default(false),
});

export type SocialLink = z.infer<typeof SocialLinkSchema>;

/**
 * Payment method configuration
 */
export const PaymentMethodSchema = z.object({
  type: z.enum(['lightning', 'lnurl', 'lnaddress', 'bolt12']),
  address: z.string(),
  preferred: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/**
 * Creator category/niche
 */
export enum CreatorCategory {
  TECHNOLOGY = 'technology',
  EDUCATION = 'education',
  ENTERTAINMENT = 'entertainment',
  GAMING = 'gaming',
  MUSIC = 'music',
  ART = 'art',
  FITNESS = 'fitness',
  FINANCE = 'finance',
  LIFESTYLE = 'lifestyle',
  NEWS = 'news',
  COMEDY = 'comedy',
  FOOD = 'food',
  TRAVEL = 'travel',
  SCIENCE = 'science',
  OTHER = 'other',
}

/**
 * Creator Profile Extended Content Schema
 * Stored in the event's content field as JSON
 */
export const CreatorProfileExtendedContentSchema = z.object({
  // Basic Information (extends NIP-01 kind 0)
  displayName: z.string().min(1).max(100),
  bio: z.string().max(500),
  avatar: z.string().url().optional(),
  banner: z.string().url().optional(),

  // Creator-Specific Fields
  categories: z.array(z.nativeEnum(CreatorCategory)).min(1).max(5),
  lightningAddress: z.string().email('Must be a valid Lightning address (user@domain.com)'),
  website: z.string().url().optional(),

  // Social Media Links
  links: z.array(SocialLinkSchema).max(10),

  // Payment Configuration
  paymentMethods: z.array(PaymentMethodSchema).min(1),
  acceptsDonations: z.boolean().default(true),
  defaultCurrency: z.enum(['sats', 'btc', 'usd']).default('sats'),

  // Verification & Trust
  nip05Verified: z.boolean().default(false),
  nip05Identifier: z.string().optional(),

  // Metadata
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  version: z.literal('1.0.0'),
});

export type CreatorProfileExtendedContent = z.infer<typeof CreatorProfileExtendedContentSchema>;

/**
 * Complete Creator Profile Extended Event (Kind 30078)
 */
export interface CreatorProfileExtendedEvent extends NostrEvent {
  kind: SovrenEventKind.CREATOR_PROFILE_EXTENDED;
  content: string; // JSON stringified CreatorProfileExtendedContent
  tags: Array<
    | ['d', string]                    // Profile identifier (usually pubkey)
    | ['name', string]                 // Display name (for indexing)
    | ['category', string]             // Creator category (multiple allowed)
    | ['lightning', string]            // Lightning address
    | ['website', string]              // Website URL
    | ['l', string, string]            // Language (ISO 639-1)
    | string[]
  >;
}

/**
 * Validation schema for Creator Profile Extended Event
 */
export const CreatorProfileExtendedEventSchema = z.object({
  kind: z.literal(SovrenEventKind.CREATOR_PROFILE_EXTENDED),
  content: z.string().refine(
    (str) => {
      try {
        const parsed = JSON.parse(str);
        CreatorProfileExtendedContentSchema.parse(parsed);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Content must be valid JSON matching CreatorProfileExtendedContent schema' }
  ),
  tags: z.array(z.array(z.string())),
});

// ========================================
// KIND 30079: CONTENT MONETIZATION
// ========================================

/**
 * Pricing tier structure
 */
export const PricingTierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().max(200),
  price: z.number().positive(),
  currency: z.enum(['sats', 'btc', 'usd']),
  interval: z.enum(['one-time', 'monthly', 'yearly']),
  benefits: z.array(z.string()).max(20),
  enabled: z.boolean().default(true),
});

export type PricingTier = z.infer<typeof PricingTierSchema>;

/**
 * Paywall configuration
 */
export const PaywallConfigSchema = z.object({
  enabled: z.boolean(),
  type: z.enum(['full', 'partial', 'time-limited']),
  previewLength: z.number().min(0).max(1000).optional(), // Characters for preview
  timeLimit: z.number().positive().optional(), // Seconds before paywall
  gracePeriod: z.number().min(0).optional(), // Free access period in seconds
});

export type PaywallConfig = z.infer<typeof PaywallConfigSchema>;

/**
 * Content Monetization Settings (Kind 30079)
 */
export const ContentMonetizationContentSchema = z.object({
  // Content Identification
  contentId: z.string(),
  contentType: z.enum(['article', 'video', 'audio', 'image', 'course', 'other']),
  title: z.string().min(1).max(200),

  // Monetization Strategy
  monetizationModel: z.enum(['pay-per-view', 'subscription', 'donation', 'hybrid']),
  paywall: PaywallConfigSchema,

  // Pricing
  pricingTiers: z.array(PricingTierSchema).min(1).max(10),
  defaultTierId: z.string().uuid(),

  // Revenue Sharing
  revenueShare: z.array(z.object({
    pubkey: z.string().length(64),
    percentage: z.number().min(0).max(100),
    role: z.string().optional(),
  })).optional(),

  // Access Control
  requiresVerification: z.boolean().default(false),
  allowedRegions: z.array(z.string()).optional(), // ISO country codes
  blockedRegions: z.array(z.string()).optional(),

  // Metadata
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  expiresAt: z.number().positive().optional(),
  version: z.literal('1.0.0'),
});

export type ContentMonetizationContent = z.infer<typeof ContentMonetizationContentSchema>;

/**
 * Complete Content Monetization Event (Kind 30079)
 */
export interface ContentMonetizationEvent extends NostrEvent {
  kind: SovrenEventKind.CONTENT_MONETIZATION;
  content: string; // JSON stringified ContentMonetizationContent
  tags: Array<
    | ['d', string]                    // Content identifier
    | ['title', string]                // Content title
    | ['type', string]                 // Content type
    | ['price', string]                // Default price
    | ['currency', string]             // Default currency
    | ['e', string]                    // Related content event
    | ['p', string]                    // Creator pubkey
    | string[]
  >;
}

// ========================================
// KIND 30080: ANALYTICS EVENT
// ========================================

/**
 * Analytics event types
 */
export enum AnalyticsEventType {
  VIEW = 'view',
  ENGAGEMENT = 'engagement',
  CONVERSION = 'conversion',
  REVENUE = 'revenue',
  SUBSCRIPTION = 'subscription',
  INTERACTION = 'interaction',
}

/**
 * Engagement metrics
 */
export const EngagementMetricsSchema = z.object({
  likes: z.number().min(0).default(0),
  comments: z.number().min(0).default(0),
  shares: z.number().min(0).default(0),
  zaps: z.number().min(0).default(0),
  zapAmount: z.number().min(0).default(0), // Total sats zapped
  reactions: z.record(z.string(), z.number()).optional(),
});

export type EngagementMetrics = z.infer<typeof EngagementMetricsSchema>;

/**
 * Revenue metrics
 */
export const RevenueMetricsSchema = z.object({
  totalRevenue: z.number().min(0),
  currency: z.enum(['sats', 'btc', 'usd']),
  transactionCount: z.number().min(0),
  averageTransactionValue: z.number().min(0),
  paymentMethods: z.record(z.string(), z.number()).optional(),
});

export type RevenueMetrics = z.infer<typeof RevenueMetricsSchema>;

/**
 * Analytics Event Content (Kind 30080)
 */
export const AnalyticsEventContentSchema = z.object({
  // Event Identification
  eventType: z.nativeEnum(AnalyticsEventType),
  contentId: z.string(),
  contentType: z.string().optional(),

  // Metrics
  viewCount: z.number().min(0).default(0),
  uniqueViewers: z.number().min(0).default(0),
  engagement: EngagementMetricsSchema.optional(),
  revenue: RevenueMetricsSchema.optional(),

  // Time-based Analytics
  timeOnContent: z.number().min(0).optional(), // Seconds
  completionRate: z.number().min(0).max(100).optional(), // Percentage

  // Geographic/Demographic (anonymized)
  regions: z.record(z.string(), z.number()).optional(), // Country code: count
  devices: z.record(z.string(), z.number()).optional(), // Device type: count

  // Referral Source
  referralSource: z.string().optional(),
  referralType: z.enum(['organic', 'social', 'direct', 'search', 'paid']).optional(),

  // Timestamp Information
  periodStart: z.number().positive(),
  periodEnd: z.number().positive(),
  granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']),

  // Metadata
  version: z.literal('1.0.0'),
});

export type AnalyticsEventContent = z.infer<typeof AnalyticsEventContentSchema>;

/**
 * Complete Analytics Event (Kind 30080)
 */
export interface AnalyticsEvent extends NostrEvent {
  kind: SovrenEventKind.ANALYTICS_EVENT;
  content: string; // JSON stringified AnalyticsEventContent
  tags: Array<
    | ['d', string]                    // Analytics event identifier
    | ['content', string]              // Content ID being tracked
    | ['type', string]                 // Analytics event type
    | ['period', string]               // Time period (ISO 8601)
    | ['p', string]                    // Creator pubkey
    | string[]
  >;
}

// ========================================
// KIND 30081: SUBSCRIPTION MANAGEMENT
// ========================================

/**
 * Subscription tier benefits
 */
export const SubscriptionBenefitsSchema = z.object({
  accessLevel: z.enum(['basic', 'premium', 'vip', 'exclusive']),
  features: z.array(z.string()).max(30),
  contentAccess: z.array(z.string()).optional(), // Content IDs
  discounts: z.number().min(0).max(100).optional(), // Percentage discount
  exclusiveContent: z.boolean().default(false),
  earlyAccess: z.boolean().default(false),
  adFree: z.boolean().default(false),
  customPerks: z.array(z.string()).optional(),
});

export type SubscriptionBenefits = z.infer<typeof SubscriptionBenefitsSchema>;

/**
 * Subscription tier definition
 */
export const SubscriptionTierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().max(300),
  price: z.number().positive(),
  currency: z.enum(['sats', 'btc', 'usd']),
  interval: z.enum(['monthly', 'quarterly', 'yearly', 'lifetime']),
  benefits: SubscriptionBenefitsSchema,
  subscriberCount: z.number().min(0).default(0),
  maxSubscribers: z.number().positive().optional(), // Limit for exclusive tiers
  enabled: z.boolean().default(true),
});

export type SubscriptionTier = z.infer<typeof SubscriptionTierSchema>;

/**
 * Subscription statistics
 */
export const SubscriptionStatsSchema = z.object({
  totalSubscribers: z.number().min(0),
  activeSubscribers: z.number().min(0),
  cancelledSubscribers: z.number().min(0),
  totalRevenue: z.number().min(0),
  monthlyRecurringRevenue: z.number().min(0),
  churnRate: z.number().min(0).max(100).optional(), // Percentage
  growthRate: z.number().optional(), // Percentage (can be negative)
});

export type SubscriptionStats = z.infer<typeof SubscriptionStatsSchema>;

/**
 * Subscription Management Content (Kind 30081)
 */
export const SubscriptionManagementContentSchema = z.object({
  // Creator Information
  creatorId: z.string().length(64), // Creator pubkey
  creatorName: z.string(),

  // Subscription Tiers
  tiers: z.array(SubscriptionTierSchema).min(1).max(10),
  defaultTierId: z.string().uuid().optional(),

  // Statistics
  stats: SubscriptionStatsSchema,

  // Configuration
  allowGifting: z.boolean().default(true),
  allowTrial: z.boolean().default(false),
  trialDuration: z.number().positive().optional(), // Days
  autoRenew: z.boolean().default(true),

  // Metadata
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  version: z.literal('1.0.0'),
});

export type SubscriptionManagementContent = z.infer<typeof SubscriptionManagementContentSchema>;

/**
 * Complete Subscription Management Event (Kind 30081)
 */
export interface SubscriptionManagementEvent extends NostrEvent {
  kind: SovrenEventKind.SUBSCRIPTION_MANAGEMENT;
  content: string; // JSON stringified SubscriptionManagementContent
  tags: Array<
    | ['d', string]                    // Subscription config identifier
    | ['p', string]                    // Creator pubkey
    | ['tier', string]                 // Tier ID (multiple allowed)
    | ['price', string]                // Default price
    | ['currency', string]             // Currency
    | string[]
  >;
}

// ========================================
// KIND 30082: CONTENT RECOMMENDATIONS
// ========================================

/**
 * Recommendation source
 */
export enum RecommendationSource {
  AI_COLLABORATIVE = 'ai_collaborative',     // Collaborative filtering
  AI_CONTENT_BASED = 'ai_content_based',     // Content-based filtering
  AI_HYBRID = 'ai_hybrid',                   // Hybrid approach
  TRENDING = 'trending',                     // Trending content
  FOLLOWING = 'following',                   // From followed creators
  SIMILAR_USERS = 'similar_users',           // Similar user preferences
  MANUAL = 'manual',                         // Manually curated
}

/**
 * Recommendation confidence and scoring
 */
export const RecommendationScoreSchema = z.object({
  confidence: z.number().min(0).max(1),      // 0-1 confidence score
  relevance: z.number().min(0).max(1),       // 0-1 relevance score
  quality: z.number().min(0).max(1),         // 0-1 quality score
  engagement: z.number().min(0).max(1),      // 0-1 predicted engagement
  overall: z.number().min(0).max(1),         // 0-1 overall score
});

export type RecommendationScore = z.infer<typeof RecommendationScoreSchema>;

/**
 * Individual content recommendation
 */
export const ContentRecommendationSchema = z.object({
  contentId: z.string(),
  eventId: z.string().length(64).optional(),
  creatorPubkey: z.string().length(64),
  title: z.string(),
  description: z.string().max(300).optional(),
  contentType: z.string(),

  // Scoring
  score: RecommendationScoreSchema,
  source: z.nativeEnum(RecommendationSource),

  // Reasoning (for transparency)
  reason: z.string().max(200).optional(),
  factors: z.array(z.string()).optional(),

  // Metadata
  publishedAt: z.number().positive().optional(),
  viewCount: z.number().min(0).optional(),
  engagementRate: z.number().min(0).max(100).optional(),
});

export type ContentRecommendation = z.infer<typeof ContentRecommendationSchema>;

/**
 * Content Recommendations Content (Kind 30082)
 */
export const ContentRecommendationsContentSchema = z.object({
  // Target User
  targetPubkey: z.string().length(64),

  // Recommendations
  recommendations: z.array(ContentRecommendationSchema).min(1).max(50),

  // Feed Configuration
  feedType: z.enum(['personalized', 'trending', 'following', 'discovery']),
  algorithm: z.string(),
  algorithmVersion: z.string(),

  // Metadata
  generatedAt: z.number().positive(),
  expiresAt: z.number().positive(),
  refreshInterval: z.number().positive(), // Seconds
  version: z.literal('1.0.0'),
});

export type ContentRecommendationsContent = z.infer<typeof ContentRecommendationsContentSchema>;

/**
 * Complete Content Recommendations Event (Kind 30082)
 */
export interface ContentRecommendationsEvent extends NostrEvent {
  kind: SovrenEventKind.CONTENT_RECOMMENDATIONS;
  content: string; // JSON stringified ContentRecommendationsContent
  tags: Array<
    | ['d', string]                    // Recommendations identifier
    | ['p', string]                    // Target user pubkey
    | ['feed', string]                 // Feed type
    | ['algo', string]                 // Algorithm name
    | ['expiration', string]           // Expiration timestamp
    | string[]
  >;
}

// ========================================
// VALIDATION HELPERS
// ========================================

/**
 * Validate and parse Creator Profile Extended event content
 */
export function parseCreatorProfileExtended(content: string): CreatorProfileExtendedContent {
  const parsed = JSON.parse(content);
  return CreatorProfileExtendedContentSchema.parse(parsed);
}

/**
 * Validate and parse Content Monetization event content
 */
export function parseContentMonetization(content: string): ContentMonetizationContent {
  const parsed = JSON.parse(content);
  return ContentMonetizationContentSchema.parse(parsed);
}

/**
 * Validate and parse Analytics Event content
 */
export function parseAnalyticsEvent(content: string): AnalyticsEventContent {
  const parsed = JSON.parse(content);
  return AnalyticsEventContentSchema.parse(parsed);
}

/**
 * Validate and parse Subscription Management event content
 */
export function parseSubscriptionManagement(content: string): SubscriptionManagementContent {
  const parsed = JSON.parse(content);
  return SubscriptionManagementContentSchema.parse(parsed);
}

/**
 * Validate and parse Content Recommendations event content
 */
export function parseContentRecommendations(content: string): ContentRecommendationsContent {
  const parsed = JSON.parse(content);
  return ContentRecommendationsContentSchema.parse(parsed);
}

// ========================================
// EVENT BUILDER HELPERS
// ========================================

/**
 * Build Creator Profile Extended event template
 */
export function buildCreatorProfileExtendedTemplate(
  pubkey: string,
  content: CreatorProfileExtendedContent
): Omit<CreatorProfileExtendedEvent, 'id' | 'sig' | 'created_at'> {
  // Validate content
  CreatorProfileExtendedContentSchema.parse(content);

  const tags: string[][] = [
    ['d', pubkey], // Use pubkey as identifier
    ['name', content.displayName],
    ['lightning', content.lightningAddress],
  ];

  // Add categories
  content.categories.forEach(category => {
    tags.push(['category', category]);
  });

  // Add website if present
  if (content.website) {
    tags.push(['website', content.website]);
  }

  return {
    kind: SovrenEventKind.CREATOR_PROFILE_EXTENDED,
    pubkey,
    content: JSON.stringify(content),
    tags,
  };
}

/**
 * Build Content Monetization event template
 */
export function buildContentMonetizationTemplate(
  pubkey: string,
  contentId: string,
  content: ContentMonetizationContent
): Omit<ContentMonetizationEvent, 'id' | 'sig' | 'created_at'> {
  // Validate content
  ContentMonetizationContentSchema.parse(content);

  const defaultTier = content.pricingTiers.find(t => t.id === content.defaultTierId);

  const tags: string[][] = [
    ['d', contentId],
    ['title', content.title],
    ['type', content.contentType],
    ['p', pubkey],
  ];

  if (defaultTier) {
    tags.push(['price', defaultTier.price.toString()]);
    tags.push(['currency', defaultTier.currency]);
  }

  return {
    kind: SovrenEventKind.CONTENT_MONETIZATION,
    pubkey,
    content: JSON.stringify(content),
    tags,
  };
}

/**
 * Build Analytics Event template
 */
export function buildAnalyticsEventTemplate(
  pubkey: string,
  analyticsId: string,
  content: AnalyticsEventContent
): Omit<AnalyticsEvent, 'id' | 'sig' | 'created_at'> {
  // Validate content
  AnalyticsEventContentSchema.parse(content);

  const tags: string[][] = [
    ['d', analyticsId],
    ['content', content.contentId],
    ['type', content.eventType],
    ['period', `${content.periodStart}-${content.periodEnd}`],
    ['p', pubkey],
  ];

  return {
    kind: SovrenEventKind.ANALYTICS_EVENT,
    pubkey,
    content: JSON.stringify(content),
    tags,
  };
}

/**
 * Build Subscription Management event template
 */
export function buildSubscriptionManagementTemplate(
  pubkey: string,
  content: SubscriptionManagementContent
): Omit<SubscriptionManagementEvent, 'id' | 'sig' | 'created_at'> {
  // Validate content
  SubscriptionManagementContentSchema.parse(content);

  const tags: string[][] = [
    ['d', `subscription-${pubkey}`],
    ['p', pubkey],
  ];

  // Add tier tags
  content.tiers.forEach(tier => {
    tags.push(['tier', tier.id]);
  });

  // Add default currency
  if (content.tiers.length > 0) {
    tags.push(['currency', content.tiers[0].currency]);
  }

  return {
    kind: SovrenEventKind.SUBSCRIPTION_MANAGEMENT,
    pubkey,
    content: JSON.stringify(content),
    tags,
  };
}

/**
 * Build Content Recommendations event template
 */
export function buildContentRecommendationsTemplate(
  pubkey: string,
  targetPubkey: string,
  content: ContentRecommendationsContent
): Omit<ContentRecommendationsEvent, 'id' | 'sig' | 'created_at'> {
  // Validate content
  ContentRecommendationsContentSchema.parse(content);

  const tags: string[][] = [
    ['d', `recommendations-${targetPubkey}-${content.generatedAt}`],
    ['p', targetPubkey],
    ['feed', content.feedType],
    ['algo', content.algorithm],
    ['expiration', content.expiresAt.toString()],
  ];

  return {
    kind: SovrenEventKind.CONTENT_RECOMMENDATIONS,
    pubkey,
    content: JSON.stringify(content),
    tags,
  };
}

// ========================================
// EXPORT ALL SCHEMAS
// ========================================

export const SovrenNIPSchemas = {
  // Creator Profile Extended
  CreatorProfileExtendedContent: CreatorProfileExtendedContentSchema,
  SocialLink: SocialLinkSchema,
  PaymentMethod: PaymentMethodSchema,

  // Content Monetization
  ContentMonetizationContent: ContentMonetizationContentSchema,
  PricingTier: PricingTierSchema,
  PaywallConfig: PaywallConfigSchema,

  // Analytics
  AnalyticsEventContent: AnalyticsEventContentSchema,
  EngagementMetrics: EngagementMetricsSchema,
  RevenueMetrics: RevenueMetricsSchema,

  // Subscription Management
  SubscriptionManagementContent: SubscriptionManagementContentSchema,
  SubscriptionTier: SubscriptionTierSchema,
  SubscriptionBenefits: SubscriptionBenefitsSchema,
  SubscriptionStats: SubscriptionStatsSchema,

  // Content Recommendations
  ContentRecommendationsContent: ContentRecommendationsContentSchema,
  ContentRecommendation: ContentRecommendationSchema,
  RecommendationScore: RecommendationScoreSchema,
} as const;
