import { z } from 'zod';

// 🏷️ USER ROLE ENUMS
export enum UserRole {
  ADMIN = 'admin',
  CREATOR = 'creator',
  SUPPORTER = 'supporter',
  USER = 'user',
  GUEST = 'guest',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum PrivacyLevel {
  PUBLIC = 'public',
  FOLLOWERS_ONLY = 'followers_only',
  PRIVATE = 'private',
}

// 🎨 PROFILE IMAGE SCHEMA
export const ProfileImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  thumbnailUrl: z.string().url(),
  altText: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  size: z.number().positive(), // bytes
  format: z.enum(['jpeg', 'png', 'webp', 'avif']),
  uploadedAt: z.date(),
});

export type ProfileImage = z.infer<typeof ProfileImageSchema>;

// 🌐 NOSTR IDENTITY SCHEMA (Primary Authentication Method)
export const NostrIdentitySchema = z.object({
  publicKey: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Invalid NOSTR public key format'),
  verified: z.boolean().default(false),
  verifiedAt: z.date().optional(),
  metadata: z
    .object({
      name: z.string().optional(),
      about: z.string().optional(),
      picture: z.string().url().optional(),
      nip05: z.string().optional(), // NIP-05 verification
      lud16: z.string().optional(), // Lightning address
    })
    .optional(),
  relays: z.array(z.string().url()).default([]),
  lastSync: z.date().optional(),
});

export type NostrIdentity = z.infer<typeof NostrIdentitySchema>;

// 🔐 NOSTR AUTHENTICATION SCHEMA
export const NostrAuthSchema = z.object({
  publicKey: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Invalid NOSTR public key format'),
  signature: z.string().min(1, 'Signature is required'), // Signed authentication challenge
  challenge: z.string().min(1, 'Challenge is required'), // Server-provided challenge string
  timestamp: z.number(), // Unix timestamp to prevent replay attacks
});

export type NostrAuth = z.infer<typeof NostrAuthSchema>;

// 🔓 NOSTR LOGIN SCHEMA
export const NostrLoginSchema = z.object({
  publicKey: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Invalid NOSTR public key format'),
  signature: z.string().min(1, 'Signature is required'),
  challenge: z.string().min(1, 'Challenge is required'),
  timestamp: z.number(),
});

export type NostrLogin = z.infer<typeof NostrLoginSchema>;

// 🔒 PRIVACY SETTINGS SCHEMA
export const PrivacySettingsSchema = z.object({
  profileVisibility: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PUBLIC),
  emailVisibility: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PRIVATE),
  showOnlineStatus: z.boolean().default(true),
  allowDirectMessages: z.boolean().default(true),
  allowFollowing: z.boolean().default(true),
  showSupporterCount: z.boolean().default(true),
  showEarnings: z.boolean().default(false),
  searchable: z.boolean().default(true),
  analyticsOptIn: z.boolean().default(false),
});

export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;

// 📊 USER PREFERENCES SCHEMA
export const UserPreferencesSchema = z.object({
  language: z.string().default('en'),
  timezone: z.string().default('UTC'),
  currency: z.string().length(3).default('USD'), // ISO 4217
  emailNotifications: z
    .object({
      newFollowers: z.boolean().default(true),
      newSupport: z.boolean().default(true),
      contentUpdates: z.boolean().default(true),
      systemUpdates: z.boolean().default(true),
      marketing: z.boolean().default(false),
    })
    .default({}),
  pushNotifications: z
    .object({
      enabled: z.boolean().default(true),
      newFollowers: z.boolean().default(true),
      newSupport: z.boolean().default(true),
      directMessages: z.boolean().default(true),
    })
    .default({}),
  accessibility: z
    .object({
      reducedMotion: z.boolean().default(false),
      highContrast: z.boolean().default(false),
      largeText: z.boolean().default(false),
      screenReader: z.boolean().default(false),
    })
    .default({}),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// 📈 CREATOR STATS SCHEMA
export const CreatorStatsSchema = z.object({
  totalEarnings: z.number().nonnegative().default(0),
  totalSupports: z.number().nonnegative().default(0),
  followerCount: z.number().nonnegative().default(0),
  postCount: z.number().nonnegative().default(0),
  averageSupport: z.number().nonnegative().default(0),
  monthlyEarnings: z.number().nonnegative().default(0),
  lastActive: z.date().optional(),
  popularContent: z.array(z.string().uuid()).default([]),
});

export type CreatorStats = z.infer<typeof CreatorStatsSchema>;

// 💝 SUPPORTER STATS SCHEMA
export const SupporterStatsSchema = z.object({
  totalSpent: z.number().nonnegative().default(0),
  totalSupports: z.number().nonnegative().default(0),
  followingCount: z.number().nonnegative().default(0),
  favoriteCreators: z.array(z.string().uuid()).default([]),
  lastActivity: z.date().optional(),
  supportStreak: z.number().nonnegative().default(0),
});

export type SupporterStats = z.infer<typeof SupporterStatsSchema>;

// 👤 BASE USER SCHEMA
export const BaseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(), // Optional: users can use NOSTR-only
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters'),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  location: z.string().max(100, 'Location must be at most 100 characters').optional(),
  website: z.string().url('Invalid website URL').optional(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  profileImage: ProfileImageSchema.optional(),
  coverImage: ProfileImageSchema.optional(),
  nostrIdentity: NostrIdentitySchema, // REQUIRED: Primary authentication method
  privacySettings: PrivacySettingsSchema.default({}),
  preferences: UserPreferencesSchema.default({}),
  emailVerified: z.boolean().default(false),
  emailVerifiedAt: z.date().optional(),
  phoneNumber: z.string().optional(),
  phoneVerified: z.boolean().default(false),
  phoneVerifiedAt: z.date().optional(),
  lastLoginAt: z.date().optional(),
  lastActiveAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional(),
});

export type BaseUser = z.infer<typeof BaseUserSchema>;

// 🎨 CREATOR USER SCHEMA
export const CreatorUserSchema = BaseUserSchema.extend({
  role: z.literal(UserRole.CREATOR),
  stats: CreatorStatsSchema.default({}),
  lightningAddress: z.string().optional(),
  lightningNodePubkey: z.string().optional(),
  contentCategories: z.array(z.string()).default([]),
  subscriptionTiers: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),
        price: z.number().positive(),
        currency: z.string().length(3),
        features: z.array(z.string()),
        active: z.boolean().default(true),
      })
    )
    .default([]),
  verificationBadges: z.array(z.enum(['verified', 'premium', 'partner'])).default([]),
});

export type CreatorUser = z.infer<typeof CreatorUserSchema>;

// 💝 SUPPORTER USER SCHEMA
export const SupporterUserSchema = BaseUserSchema.extend({
  role: z.literal(UserRole.SUPPORTER),
  stats: SupporterStatsSchema.default({}),
  paymentMethods: z
    .array(
      z.object({
        id: z.string().uuid(),
        type: z.enum(['lightning', 'credit_card', 'bank_transfer']),
        isDefault: z.boolean().default(false),
        lastUsed: z.date().optional(),
      })
    )
    .default([]),
  subscriptions: z
    .array(
      z.object({
        id: z.string().uuid(),
        creatorId: z.string().uuid(),
        tierId: z.string().uuid(),
        status: z.enum(['active', 'paused', 'cancelled']),
        startDate: z.date(),
        nextBillingDate: z.date().optional(),
      })
    )
    .default([]),
});

export type SupporterUser = z.infer<typeof SupporterUserSchema>;

// 🔄 UNION USER TYPE
export const UserSchema = z.discriminatedUnion('role', [CreatorUserSchema, SupporterUserSchema]);

export type User = z.infer<typeof UserSchema>;

// 📝 USER CREATION SCHEMAS (NOSTR-based)
export const CreateUserSchema = z.object({
  email: z.string().email().optional(), // Optional: NOSTR-only registration possible
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(100),
  role: z.nativeEnum(UserRole),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional(),
  nostrPublicKey: z.string().regex(/^[0-9a-fA-F]{64}$/), // REQUIRED for NOSTR auth
  nostrSignature: z.string().min(1, 'NOSTR signature is required'), // Signed registration challenge
  nostrChallenge: z.string().min(1, 'NOSTR challenge is required'), // Server-provided registration challenge
});

export type CreateUser = z.infer<typeof CreateUserSchema>;

// ✏️ USER UPDATE SCHEMAS
export const UpdateUserSchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(100).optional(),
    website: z.string().url().optional(),
    email: z.string().email().optional(),
    privacySettings: PrivacySettingsSchema.partial().optional(),
    preferences: UserPreferencesSchema.partial().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

// 🔍 USER SEARCH SCHEMA
export const UserSearchSchema = z.object({
  query: z.string().min(1).max(100),
  role: z.nativeEnum(UserRole).optional(),
  verified: z.boolean().optional(),
  location: z.string().optional(),
  categories: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['relevance', 'followers', 'recent', 'earnings']).default('relevance'),
});

export type UserSearch = z.infer<typeof UserSearchSchema>;

// 📊 USER ANALYTICS SCHEMA
export const UserAnalyticsSchema = z.object({
  userId: z.string().uuid(),
  timeframe: z.enum(['day', 'week', 'month', 'year']).default('month'),
  metrics: z.object({
    profileViews: z.number().nonnegative().default(0),
    followersGained: z.number().default(0),
    supportReceived: z.number().nonnegative().default(0),
    contentEngagement: z.number().nonnegative().default(0),
    earningsGrowth: z.number().default(0),
  }),
  generatedAt: z.date(),
});

export type UserAnalytics = z.infer<typeof UserAnalyticsSchema>;

// 🏷️ USER ACTIVITY SCHEMA
export const UserActivitySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum([
    'profile_update',
    'new_post',
    'support_given',
    'support_received',
    'new_follower',
    'follow_user',
    'profile_view',
    'login',
    'logout',
    'nostr_key_update',
    'email_verified',
  ]),
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  createdAt: z.date(),
});

export type UserActivity = z.infer<typeof UserActivitySchema>;

// 🔐 NOSTR KEY RECOVERY SCHEMA (for account recovery)
export const NostrKeyRecoverySchema = z.object({
  email: z.string().email(), // Backup email for account recovery
  oldPublicKey: z.string().regex(/^[0-9a-fA-F]{64}$/),
  newPublicKey: z.string().regex(/^[0-9a-fA-F]{64}$/),
  recoverySignature: z.string().min(1, 'Recovery signature is required'), // Signed with old private key
  newKeySignature: z.string().min(1, 'New key signature is required'), // Signed with new private key
  timestamp: z.number(),
});

export type NostrKeyRecovery = z.infer<typeof NostrKeyRecoverySchema>;

// 🎯 VALIDATION HELPERS
export const validateUsername = (username: string): boolean => {
  return /^[a-zA-Z0-9_-]{3,30}$/.test(username);
};

export const validateNostrPubkey = (pubkey: string): boolean => {
  return /^[0-9a-fA-F]{64}$/.test(pubkey);
};

export const sanitizeDisplayName = (name: string): string => {
  return name.trim().slice(0, 100);
};

export const sanitizeBio = (bio: string): string => {
  return bio.trim().slice(0, 500);
};

// 🔐 NOSTR SIGNATURE VALIDATION HELPER
export const validateNostrSignature = (
  publicKey: string,
  signature: string,
  message: string
): boolean => {
  // This would use the NOSTR signature verification
  // Implementation would use nostr-tools or similar library
  try {
    // Pseudo-code - actual implementation would use cryptographic verification
    return validateNostrPubkey(publicKey) && signature.length > 0 && message.length > 0;
  } catch {
    return false;
  }
};
