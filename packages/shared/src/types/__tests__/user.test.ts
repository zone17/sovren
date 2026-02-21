
import {
    BaseUserSchema,
    CreateUserSchema,
    CreatorStatsSchema,
    CreatorUserSchema,
    NostrAuthSchema,
    NostrIdentitySchema,
    NostrLoginSchema,
    PrivacyLevel,
    PrivacySettingsSchema,
    ProfileImageSchema,
    sanitizeBio,
    sanitizeDisplayName,
    SupporterStatsSchema,
    SupporterUserSchema,
    UpdateUserSchema,
    UserActivitySchema,
    UserAnalyticsSchema,
    UserPreferencesSchema,
    UserRole,
    UserSearchSchema,
    UserStatus,
    validateNostrPubkey,
    validateNostrSignature,
    validateUsername,
} from '../user';

describe('User Type Schemas', () => {
  describe('UserRole Enum', () => {
    it('should have correct role values', () => {
      expect(UserRole.CREATOR).toBe('creator');
      expect(UserRole.SUPPORTER).toBe('supporter');
      expect(UserRole.ADMIN).toBe('admin');
    });
  });

  describe('UserStatus Enum', () => {
    it('should have correct status values', () => {
      expect(UserStatus.ACTIVE).toBe('active');
      expect(UserStatus.INACTIVE).toBe('inactive');
      expect(UserStatus.SUSPENDED).toBe('suspended');
      expect(UserStatus.PENDING_VERIFICATION).toBe('pending_verification');
    });
  });

  describe('PrivacyLevel Enum', () => {
    it('should have correct privacy levels', () => {
      expect(PrivacyLevel.PUBLIC).toBe('public');
      expect(PrivacyLevel.FOLLOWERS_ONLY).toBe('followers_only');
      expect(PrivacyLevel.PRIVATE).toBe('private');
    });
  });

  describe('ProfileImageSchema', () => {
    const validProfileImage = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      url: 'https://example.com/image.jpg',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
      altText: 'Profile picture',
      width: 300,
      height: 300,
      size: 15000,
      format: 'jpeg' as const,
      uploadedAt: new Date(),
    };

    it('should validate correct profile image data', () => {
      const result = ProfileImageSchema.safeParse(validProfileImage);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = ProfileImageSchema.safeParse({
        ...validProfileImage,
        id: 'invalid-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL', () => {
      const result = ProfileImageSchema.safeParse({
        ...validProfileImage,
        url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative dimensions', () => {
      const result = ProfileImageSchema.safeParse({
        ...validProfileImage,
        width: -100,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid format', () => {
      const result = ProfileImageSchema.safeParse({
        ...validProfileImage,
        format: 'gif',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('NostrIdentitySchema', () => {
    const validNostrIdentity = {
      publicKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      verified: true,
      verifiedAt: new Date(),
      metadata: {
        name: 'Test User',
        about: 'Test bio',
        picture: 'https://example.com/pic.jpg',
        nip05: 'test@example.com',
        lud16: 'test@getalby.com',
      },
      relays: ['wss://relay1.example.com', 'wss://relay2.example.com'],
      lastSync: new Date(),
    };

    it('should validate correct NOSTR identity data', () => {
      const result = NostrIdentitySchema.safeParse(validNostrIdentity);
      expect(result.success).toBe(true);
    });

    it('should reject invalid public key format', () => {
      const result = NostrIdentitySchema.safeParse({
        ...validNostrIdentity,
        publicKey: 'invalid-key',
      });
      expect(result.success).toBe(false);
    });

    it('should validate minimal NOSTR identity', () => {
      const result = NostrIdentitySchema.safeParse({
        publicKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verified).toBe(false);
        expect(result.data.relays).toEqual([]);
      }
    });

    it('should reject non-hex characters in public key', () => {
      const result = NostrIdentitySchema.safeParse({
        publicKey: '1234567890abcdefg234567890abcdef1234567890abcdef1234567890abcdef',
      });
      expect(result.success).toBe(false);
    });

    it('should reject incorrect public key length', () => {
      const result = NostrIdentitySchema.safeParse({
        publicKey: '1234567890abcdef',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('NostrAuthSchema', () => {
    const validNostrAuth = {
      publicKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      signature: 'valid_signature_string',
      challenge: 'server_provided_challenge',
      timestamp: Date.now(),
    };

    it('should validate correct NOSTR auth data', () => {
      const result = NostrAuthSchema.safeParse(validNostrAuth);
      expect(result.success).toBe(true);
    });

    it('should reject invalid public key', () => {
      const result = NostrAuthSchema.safeParse({
        ...validNostrAuth,
        publicKey: 'invalid-key',
      });
      expect(result.success).toBe(false);
    });

    it('should require all fields', () => {
      const result = NostrAuthSchema.safeParse({
        publicKey: validNostrAuth.publicKey,
        // Missing signature, challenge, timestamp
      });
      expect(result.success).toBe(false);
    });
  });

  describe('NostrLoginSchema', () => {
    const validNostrLogin = {
      publicKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      signature: 'login_signature',
      challenge: 'login_challenge',
      timestamp: Date.now(),
    };

    it('should validate correct NOSTR login data', () => {
      const result = NostrLoginSchema.safeParse(validNostrLogin);
      expect(result.success).toBe(true);
    });

    it('should reject empty signature', () => {
      const result = NostrLoginSchema.safeParse({
        ...validNostrLogin,
        signature: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PrivacySettingsSchema', () => {
    it('should validate with defaults', () => {
      const result = PrivacySettingsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.profileVisibility).toBe(PrivacyLevel.PUBLIC);
        expect(result.data.emailVisibility).toBe(PrivacyLevel.PRIVATE);
        expect(result.data.showOnlineStatus).toBe(true);
        expect(result.data.analyticsOptIn).toBe(false);
      }
    });

    it('should validate custom privacy settings', () => {
      const settings = {
        profileVisibility: PrivacyLevel.FOLLOWERS_ONLY,
        emailVisibility: PrivacyLevel.PRIVATE,
        showOnlineStatus: false,
        allowDirectMessages: false,
        analyticsOptIn: true,
      };
      const result = PrivacySettingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });
  });

  describe('UserPreferencesSchema', () => {
    it('should validate with defaults', () => {
      const result = UserPreferencesSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe('en');
        expect(result.data.timezone).toBe('UTC');
        expect(result.data.currency).toBe('USD');
      }
    });

    it('should validate custom preferences', () => {
      const preferences = {
        language: 'es',
        timezone: 'America/New_York',
        currency: 'EUR',
        emailNotifications: {
          newFollowers: false,
          marketing: true,
        },
        accessibility: {
          highContrast: true,
          largeText: true,
        },
      };
      const result = UserPreferencesSchema.safeParse(preferences);
      expect(result.success).toBe(true);
    });

    it('should reject invalid currency format', () => {
      const result = UserPreferencesSchema.safeParse({
        currency: 'INVALID',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreatorStatsSchema', () => {
    it('should validate with defaults', () => {
      const result = CreatorStatsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalEarnings).toBe(0);
        expect(result.data.followerCount).toBe(0);
        expect(result.data.popularContent).toEqual([]);
      }
    });

    it('should validate custom stats', () => {
      const stats = {
        totalEarnings: 1500.50,
        totalSupports: 25,
        followerCount: 100,
        postCount: 15,
        averageSupport: 60.02,
        monthlyEarnings: 500.0,
        lastActive: new Date(),
        popularContent: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = CreatorStatsSchema.safeParse(stats);
      expect(result.success).toBe(true);
    });

    it('should reject negative earnings', () => {
      const result = CreatorStatsSchema.safeParse({
        totalEarnings: -100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SupporterStatsSchema', () => {
    it('should validate with defaults', () => {
      const result = SupporterStatsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalSpent).toBe(0);
        expect(result.data.supportStreak).toBe(0);
        expect(result.data.favoriteCreators).toEqual([]);
      }
    });

    it('should validate custom supporter stats', () => {
      const stats = {
        totalSpent: 250.75,
        totalSupports: 15,
        followingCount: 5,
        favoriteCreators: ['123e4567-e89b-12d3-a456-426614174000'],
        lastActivity: new Date(),
        supportStreak: 7,
      };
      const result = SupporterStatsSchema.safeParse(stats);
      expect(result.success).toBe(true);
    });
  });

  describe('BaseUserSchema', () => {
    const validBaseUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser123',
      displayName: 'Test User',
      role: UserRole.CREATOR,
      nostrIdentity: {
        publicKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should validate correct base user data', () => {
      const result = BaseUserSchema.safeParse(validBaseUser);
      expect(result.success).toBe(true);
    });

    it('should validate without email (NOSTR-only user)', () => {
      const result = BaseUserSchema.safeParse(validBaseUser);
      expect(result.success).toBe(true);
    });

    it('should validate with email', () => {
      const result = BaseUserSchema.safeParse({
        ...validBaseUser,
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should require NOSTR identity', () => {
      const result = BaseUserSchema.safeParse({
        ...validBaseUser,
        nostrIdentity: undefined,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = BaseUserSchema.safeParse({
        ...validBaseUser,
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid username (too short)', () => {
      const result = BaseUserSchema.safeParse({
        ...validBaseUser,
        username: 'ab',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid username (too long)', () => {
      const result = BaseUserSchema.safeParse({
        ...validBaseUser,
        username: 'a'.repeat(31),
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid username (special characters)', () => {
      const result = BaseUserSchema.safeParse({
        ...validBaseUser,
        username: 'test@user!',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty display name', () => {
      const result = BaseUserSchema.safeParse({
        ...validBaseUser,
        displayName: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject bio that is too long', () => {
      const result = BaseUserSchema.safeParse({
        ...validBaseUser,
        bio: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid website URL', () => {
      const result = BaseUserSchema.safeParse({
        ...validBaseUser,
        website: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreatorUserSchema', () => {
    const validCreatorUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'creator123',
      displayName: 'Test Creator',
      role: UserRole.CREATOR,
      nostrIdentity: {
        publicKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lightningAddress: 'creator@getalby.com',
      contentCategories: ['tech', 'art'],
      subscriptionTiers: [{
        id: '456e7890-e89b-12d3-a456-426614174000',
        name: 'Basic Tier',
        description: 'Basic access',
        price: 5.00,
        currency: 'USD',
        features: ['Access to posts', 'Discord access'],
        active: true,
      }],
      verificationBadges: ['verified'],
    };

    it('should validate correct creator user data', () => {
      const result = CreatorUserSchema.safeParse(validCreatorUser);
      expect(result.success).toBe(true);
    });

    it('should reject non-creator role', () => {
      const result = CreatorUserSchema.safeParse({
        ...validCreatorUser,
        role: UserRole.SUPPORTER,
      });
      expect(result.success).toBe(false);
    });

    it('should validate with minimal data', () => {
      const minimalCreator = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'creator123',
        displayName: 'Test Creator',
        role: UserRole.CREATOR,
        nostrIdentity: {
          publicKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = CreatorUserSchema.safeParse(minimalCreator);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contentCategories).toEqual([]);
        expect(result.data.subscriptionTiers).toEqual([]);
        expect(result.data.verificationBadges).toEqual([]);
      }
    });
  });

  describe('SupporterUserSchema', () => {
    const validSupporterUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'supporter123',
      displayName: 'Test Supporter',
      role: UserRole.SUPPORTER,
      nostrIdentity: {
        publicKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentMethods: [{
        id: '456e7890-e89b-12d3-a456-426614174000',
        type: 'lightning' as const,
        isDefault: true,
        lastUsed: new Date(),
      }],
      subscriptions: [{
        id: '789e1234-e89b-12d3-a456-426614174000',
        creatorId: '987e6543-e89b-12d3-a456-426614174000',
        tierId: '654e3210-e89b-12d3-a456-426614174000',
        status: 'active' as const,
        startDate: new Date(),
        nextBillingDate: new Date(),
      }],
    };

    it('should validate correct supporter user data', () => {
      const result = SupporterUserSchema.safeParse(validSupporterUser);
      expect(result.success).toBe(true);
    });

    it('should reject non-supporter role', () => {
      const result = SupporterUserSchema.safeParse({
        ...validSupporterUser,
        role: UserRole.CREATOR,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CreateUserSchema (NOSTR-based)', () => {
    const validCreateUser = {
      username: 'newuser123',
      displayName: 'New User',
      role: UserRole.CREATOR,
      nostrPublicKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      nostrSignature: 'signed_registration_challenge',
      nostrChallenge: 'server_provided_challenge',
    };

    it('should validate correct create user data without email', () => {
      const result = CreateUserSchema.safeParse(validCreateUser);
      expect(result.success).toBe(true);
    });

    it('should validate with optional email', () => {
      const result = CreateUserSchema.safeParse({
        ...validCreateUser,
        email: 'new@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should require NOSTR public key', () => {
      const result = CreateUserSchema.safeParse({
        ...validCreateUser,
        nostrPublicKey: undefined,
      });
      expect(result.success).toBe(false);
    });

    it('should require NOSTR signature', () => {
      const result = CreateUserSchema.safeParse({
        ...validCreateUser,
        nostrSignature: undefined,
      });
      expect(result.success).toBe(false);
    });

    it('should require NOSTR challenge', () => {
      const result = CreateUserSchema.safeParse({
        ...validCreateUser,
        nostrChallenge: undefined,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid NOSTR public key', () => {
      const result = CreateUserSchema.safeParse({
        ...validCreateUser,
        nostrPublicKey: 'invalid-key',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateUserSchema', () => {
    it('should validate partial updates', () => {
      const result = UpdateUserSchema.safeParse({
        displayName: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty update object', () => {
      const result = UpdateUserSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should validate privacy settings update', () => {
      const result = UpdateUserSchema.safeParse({
        privacySettings: {
          profileVisibility: PrivacyLevel.PRIVATE,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate email update', () => {
      const result = UpdateUserSchema.safeParse({
        email: 'newemail@example.com',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('UserSearchSchema', () => {
    it('should validate basic search', () => {
      const result = UserSearchSchema.safeParse({
        query: 'test user',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
        expect(result.data.sortBy).toBe('relevance');
      }
    });

    it('should validate advanced search parameters', () => {
      const result = UserSearchSchema.safeParse({
        query: 'creator',
        role: UserRole.CREATOR,
        verified: true,
        location: 'New York',
        categories: ['tech', 'art'],
        limit: 50,
        offset: 100,
        sortBy: 'followers',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const result = UserSearchSchema.safeParse({
        query: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid limit', () => {
      const result = UserSearchSchema.safeParse({
        query: 'test',
        limit: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const result = UserSearchSchema.safeParse({
        query: 'test',
        offset: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UserAnalyticsSchema', () => {
    const validAnalytics = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      metrics: {
        profileViews: 100,
        followersGained: 5,
        supportReceived: 250.50,
        contentEngagement: 75,
        earningsGrowth: 15.5,
      },
      generatedAt: new Date(),
    };

    it('should validate correct analytics data', () => {
      const result = UserAnalyticsSchema.safeParse(validAnalytics);
      expect(result.success).toBe(true);
    });

    it('should validate with timeframe', () => {
      const result = UserAnalyticsSchema.safeParse({
        ...validAnalytics,
        timeframe: 'week',
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative metrics', () => {
      const result = UserAnalyticsSchema.safeParse({
        ...validAnalytics,
        metrics: {
          ...validAnalytics.metrics,
          profileViews: -10,
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UserActivitySchema', () => {
    const validActivity = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: '456e7890-e89b-12d3-a456-426614174000',
      type: 'profile_update' as const,
      createdAt: new Date(),
    };

    it('should validate correct activity data', () => {
      const result = UserActivitySchema.safeParse(validActivity);
      expect(result.success).toBe(true);
    });

    it('should validate with metadata and tracking info', () => {
      const result = UserActivitySchema.safeParse({
        ...validActivity,
        metadata: { field: 'displayName', oldValue: 'Old', newValue: 'New' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
      });
      expect(result.success).toBe(true);
    });

    it('should validate NOSTR-specific activity types', () => {
      const result = UserActivitySchema.safeParse({
        ...validActivity,
        type: 'nostr_key_update',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid activity type', () => {
      const result = UserActivitySchema.safeParse({
        ...validActivity,
        type: 'invalid_type',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Validation Helper Functions', () => {
  describe('validateUsername', () => {
    it('should validate correct usernames', () => {
      expect(validateUsername('user123')).toBe(true);
      expect(validateUsername('test_user')).toBe(true);
      expect(validateUsername('user-name')).toBe(true);
      expect(validateUsername('ABC123')).toBe(true);
    });

    it('should reject invalid usernames', () => {
      expect(validateUsername('ab')).toBe(false); // too short
      expect(validateUsername('a'.repeat(31))).toBe(false); // too long
      expect(validateUsername('user@name')).toBe(false); // invalid character
      expect(validateUsername('user name')).toBe(false); // space
      expect(validateUsername('user.name')).toBe(false); // dot
    });
  });

  describe('validateNostrPubkey', () => {
    it('should validate correct NOSTR public keys', () => {
      expect(validateNostrPubkey('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')).toBe(true);
      expect(validateNostrPubkey('ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890')).toBe(true);
    });

    it('should reject invalid NOSTR public keys', () => {
      expect(validateNostrPubkey('invalid')).toBe(false); // too short
      expect(validateNostrPubkey('1234567890abcdefg234567890abcdef1234567890abcdef1234567890abcdef')).toBe(false); // invalid character
      expect(validateNostrPubkey('1234567890abcdef')).toBe(false); // too short
    });
  });

  describe('validateNostrSignature', () => {
    it('should validate correct NOSTR signatures', () => {
      const result = validateNostrSignature(
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'valid_signature',
        'test_message'
      );
      expect(result).toBe(true);
    });

    it('should reject invalid public key', () => {
      const result = validateNostrSignature(
        'invalid-key',
        'valid_signature',
        'test_message'
      );
      expect(result).toBe(false);
    });

    it('should reject empty signature', () => {
      const result = validateNostrSignature(
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '',
        'test_message'
      );
      expect(result).toBe(false);
    });

    it('should reject empty message', () => {
      const result = validateNostrSignature(
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'valid_signature',
        ''
      );
      expect(result).toBe(false);
    });
  });

  describe('sanitizeDisplayName', () => {
    it('should trim and limit display names', () => {
      expect(sanitizeDisplayName('  Test User  ')).toBe('Test User');
      expect(sanitizeDisplayName('a'.repeat(150))).toBe('a'.repeat(100));
    });
  });

  describe('sanitizeBio', () => {
    it('should trim and limit bio text', () => {
      expect(sanitizeBio('  This is a bio  ')).toBe('This is a bio');
      expect(sanitizeBio('a'.repeat(600))).toBe('a'.repeat(500));
    });
  });
});
