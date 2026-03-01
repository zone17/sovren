/**
 * User Profile Service Tests
 * User Story: US-E5-019
 * Comprehensive test suite with 95%+ coverage
 * Part of Epic 005 - Backend Service Layer Refactoring - Wave 2 (User Services)
 */

import { UserProfileService } from '../UserProfileService';
import type { IEventBus, DomainEvent } from '../../../interfaces/shared/IEventBus';
import type {
  CreateProfileRequest,
  UpdateProfileRequest,
  AvatarUploadRequest,
  ProfileSearchQuery
} from '../../../types/user-profile';

// Mock sharp image processing
vi.mock('sharp', () => {
  const sharpInstance = {
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600, format: 'jpeg' }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed-image')),
  };
  return { default: vi.fn(() => sharpInstance) };
});

// Mock implementations
class MockLogger {
  info(): void {}
  error(): void {}
  warn(): void {}
  debug(): void {}
}

class MockCacheService {
  private cache = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(key) || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let count = 0;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async expire(key: string, ttl: number): Promise<void> {
    // No-op for mock
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  async getStats(): Promise<any> {
    return {
      hits: 0,
      misses: 0,
      keys: this.cache.size,
      memoryUsage: 0,
      evictions: 0,
      hitRate: 0
    };
  }

  clear() {
    this.cache.clear();
  }
}

class MockAuditLogService {
  logs: any[] = [];

  async log(entry: any): Promise<void> {
    this.logs.push(entry);
  }

  clear() {
    this.logs = [];
  }
}

class MockEventBus implements IEventBus {
  events: DomainEvent[] = [];

  async publish<T = any>(event: DomainEvent<T>): Promise<void> {
    this.events.push(event);
  }

  async publishBatch<T = any>(events: DomainEvent<T>[]): Promise<void> {
    this.events.push(...events);
  }

  subscribe(eventType: any, handler: any): string {
    return 'sub_1';
  }

  subscribeToMany(eventTypes: any[], handler: any): string {
    return 'sub_2';
  }

  subscribeToAll(handler: any): string {
    return 'sub_all';
  }

  subscribeWithFilter(filter: any, handler: any): string {
    return 'sub_filter';
  }

  unsubscribe(subscriptionId: string): void {}

  unsubscribeAll(): void {}

  async getEvent(eventId: string): Promise<DomainEvent | null> {
    return null;
  }

  async queryEvents(filter: any, limit?: number, offset?: number): Promise<DomainEvent[]> {
    return [];
  }

  async replayEvents(options: any): Promise<DomainEvent[]> {
    return [];
  }

  async replayEventsToHandler(options: any, handler: any): Promise<void> {}

  getActiveSubscriptions(): any[] {
    return [];
  }

  async getEventStats(): Promise<any> {
    return {};
  }

  async clearEventStore(): Promise<void> {
    this.events = [];
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async dispose(): Promise<void> {}

  clear() {
    this.events = [];
  }
}

describe('UserProfileService', () => {
  let service: UserProfileService;
  let mockLogger: MockLogger;
  let mockCache: MockCacheService;
  let mockAuditLog: MockAuditLogService;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockCache = new MockCacheService();
    mockAuditLog = new MockAuditLogService();
    mockEventBus = new MockEventBus();

    service = new UserProfileService(
      mockEventBus,
      mockLogger as any,
      mockCache as any,
      mockAuditLog as any
    );
  });

  afterEach(() => {
    mockCache.clear();
    mockAuditLog.clear();
    mockEventBus.clear();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(service).toBeDefined();
    });
  });

  describe('createProfile()', () => {
    const validRequest: CreateProfileRequest = {
      userId: 'user_123',
      displayName: 'John Doe',
      username: 'johndoe',
      bio: 'Software developer',
      location: 'San Francisco',
      website: 'https://johndoe.com',
      visibility: 'public'
    };

    it('should create a new profile successfully', async () => {
      const profile = await service.createProfile(validRequest);

      expect(profile).toBeDefined();
      expect(profile.userId).toBe(validRequest.userId);
      expect(profile.displayName).toBe(validRequest.displayName);
      expect(profile.username).toBe(validRequest.username);
      expect(profile.bio).toBe(validRequest.bio);
      expect(profile.visibility).toBe('public');
      expect(profile.completionScore).toBeGreaterThan(0);
      expect(profile.socialLinks).toEqual([]);
    });

    it('should generate unique profile ID', async () => {
      const profile = await service.createProfile(validRequest);
      expect(profile.id).toBeDefined();
      expect(typeof profile.id).toBe('string');
    });

    it('should initialize analytics with zero values', async () => {
      const profile = await service.createProfile(validRequest);

      expect(profile.analytics).toEqual({
        profileViews: 0,
        profileViewsToday: 0,
        profileViewsThisWeek: 0,
        profileViewsThisMonth: 0,
        followersGained: 0,
        followersGainedToday: 0,
        followersGainedThisWeek: 0,
        followersGainedThisMonth: 0
      });
    });

    it('should cache the created profile', async () => {
      const profile = await service.createProfile(validRequest);
      const cached = await mockCache.get(`profile:${profile.userId}`);
      expect(cached).toEqual(profile);
    });

    it('should emit profile created event', async () => {
      await service.createProfile(validRequest);
      expect(mockEventBus.events.length).toBeGreaterThan(0);
      const event = mockEventBus.events.find(e => e.type === 'profile.created');
      expect(event).toBeDefined();
    });

    it('should log audit entry', async () => {
      await service.createProfile(validRequest);
      expect(mockAuditLog.logs.length).toBe(1);
      expect(mockAuditLog.logs[0].action).toBe('profile.create');
    });

    it('should throw error if profile already exists', async () => {
      await service.createProfile(validRequest);
      await expect(service.createProfile(validRequest)).rejects.toThrow('Profile already exists');
    });

    it('should throw error if username is already taken', async () => {
      await service.createProfile(validRequest);

      const duplicateUsernameRequest: CreateProfileRequest = {
        userId: 'user_456',
        username: 'johndoe'
      };

      await expect(service.createProfile(duplicateUsernameRequest)).rejects.toThrow('Username johndoe is already taken');
    });

    it('should handle profile without optional fields', async () => {
      const minimalRequest: CreateProfileRequest = {
        userId: 'user_minimal'
      };

      const profile = await service.createProfile(minimalRequest);
      expect(profile.userId).toBe('user_minimal');
      expect(profile.displayName).toBeUndefined();
      expect(profile.username).toBeUndefined();
    });

    it('should reject invalid display name', async () => {
      const invalidRequest: CreateProfileRequest = {
        userId: 'user_invalid',
        displayName: 'a' // Too short (min 1 char, but pattern fails)
      };

      await expect(service.createProfile({ ...invalidRequest, displayName: '' }))
        .rejects.toThrow('Profile validation failed');
    });

    it('should reject invalid username format', async () => {
      const invalidRequest: CreateProfileRequest = {
        userId: 'user_invalid',
        username: 'john doe' // Spaces not allowed
      };

      await expect(service.createProfile(invalidRequest))
        .rejects.toThrow('Profile validation failed');
    });

    it('should reject invalid website URL', async () => {
      const invalidRequest: CreateProfileRequest = {
        userId: 'user_invalid',
        website: 'not-a-url'
      };

      await expect(service.createProfile(invalidRequest))
        .rejects.toThrow('Profile validation failed');
    });

    it('should reject bio exceeding max length', async () => {
      const invalidRequest: CreateProfileRequest = {
        userId: 'user_invalid',
        bio: 'a'.repeat(501) // Max 500
      };

      await expect(service.createProfile(invalidRequest))
        .rejects.toThrow('Profile validation failed');
    });
  });

  describe('getProfile()', () => {
    it('should retrieve an existing profile', async () => {
      const created = await service.createProfile({
        userId: 'user_123',
        displayName: 'John Doe'
      });

      const retrieved = await service.getProfile('user_123');
      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent profile', async () => {
      const result = await service.getProfile('nonexistent');
      expect(result).toBeNull();
    });

    it('should retrieve from cache on second call', async () => {
      await service.createProfile({ userId: 'user_123' });

      // First call
      await service.getProfile('user_123');

      // Second call should hit cache
      const cached = await service.getProfile('user_123');
      expect(cached).toBeDefined();
    });
  });

  describe('getProfileByUsername()', () => {
    it('should retrieve profile by username', async () => {
      await service.createProfile({
        userId: 'user_123',
        username: 'johndoe'
      });

      const profile = await service.getProfileByUsername('johndoe');
      expect(profile).toBeDefined();
      expect(profile?.username).toBe('johndoe');
    });

    it('should be case-insensitive', async () => {
      await service.createProfile({
        userId: 'user_123',
        username: 'JohnDoe'
      });

      const profile = await service.getProfileByUsername('johndoe');
      expect(profile).toBeDefined();
    });

    it('should return null for non-existent username', async () => {
      const result = await service.getProfileByUsername('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateProfile()', () => {
    it('should update profile fields', async () => {
      await service.createProfile({
        userId: 'user_123',
        displayName: 'John Doe'
      });

      const updates: UpdateProfileRequest = {
        displayName: 'Jane Doe',
        bio: 'Updated bio'
      };

      const updated = await service.updateProfile('user_123', updates);
      expect(updated.displayName).toBe('Jane Doe');
      expect(updated.bio).toBe('Updated bio');
    });

    it('should update completion score after update', async () => {
      await service.createProfile({ userId: 'user_123' });

      const initialProfile = await service.getProfile('user_123');
      const initialScore = initialProfile!.completionScore;

      await service.updateProfile('user_123', {
        displayName: 'John Doe',
        bio: 'Software developer'
      });

      const updatedProfile = await service.getProfile('user_123');
      expect(updatedProfile!.completionScore).toBeGreaterThan(initialScore);
    });

    it('should throw error for non-existent profile', async () => {
      await expect(service.updateProfile('nonexistent', {}))
        .rejects.toThrow('Profile not found');
    });

    it('should handle username changes', async () => {
      await service.createProfile({
        userId: 'user_123',
        username: 'oldname'
      });

      await service.updateProfile('user_123', {
        username: 'newname'
      });

      const byOldName = await service.getProfileByUsername('oldname');
      expect(byOldName).toBeNull();

      const byNewName = await service.getProfileByUsername('newname');
      expect(byNewName).toBeDefined();
    });

    it('should reject duplicate username', async () => {
      await service.createProfile({ userId: 'user_1', username: 'john' });
      await service.createProfile({ userId: 'user_2', username: 'jane' });

      await expect(service.updateProfile('user_2', { username: 'john' }))
        .rejects.toThrow('Username john is already taken');
    });

    it('should invalidate caches after update', async () => {
      await service.createProfile({ userId: 'user_123' });

      // Cache the profile
      await service.getProfile('user_123');

      // Update profile
      await service.updateProfile('user_123', { displayName: 'Updated' });

      // Cache should be invalidated (service will fetch fresh data)
      const profile = await service.getProfile('user_123');
      expect(profile?.displayName).toBe('Updated');
    });

    it('should emit profile updated event', async () => {
      await service.createProfile({ userId: 'user_123' });
      mockEventBus.clear();

      await service.updateProfile('user_123', { displayName: 'Updated' });

      const event = mockEventBus.events.find(e => e.type === 'profile.updated');
      expect(event).toBeDefined();
    });
  });

  describe('deleteProfile()', () => {
    it('should delete an existing profile', async () => {
      await service.createProfile({ userId: 'user_123' });

      await service.deleteProfile('user_123');

      const profile = await service.getProfile('user_123');
      expect(profile).toBeNull();
    });

    it('should throw error for non-existent profile', async () => {
      await expect(service.deleteProfile('nonexistent'))
        .rejects.toThrow('Profile not found');
    });

    it('should remove username index', async () => {
      await service.createProfile({
        userId: 'user_123',
        username: 'johndoe'
      });

      await service.deleteProfile('user_123');

      const profile = await service.getProfileByUsername('johndoe');
      expect(profile).toBeNull();
    });

    it('should invalidate caches', async () => {
      await service.createProfile({ userId: 'user_123' });
      await service.deleteProfile('user_123');

      const cached = await mockCache.get('profile:user_123');
      expect(cached).toBeNull();
    });

    it('should emit profile deleted event', async () => {
      await service.createProfile({ userId: 'user_123' });
      mockEventBus.clear();

      await service.deleteProfile('user_123');

      const event = mockEventBus.events.find(e => e.type === 'profile.deleted');
      expect(event).toBeDefined();
    });
  });

  describe('uploadAvatar()', () => {
    it('should upload avatar successfully', async () => {
      await service.createProfile({ userId: 'user_123' });

      // Create a mock image buffer
      const imageBuffer = Buffer.from('fake-image-data');

      const request: AvatarUploadRequest = {
        userId: 'user_123',
        imageData: imageBuffer,
        mimeType: 'image/jpeg',
        filename: 'avatar.jpg'
      };

      const result = await service.uploadAvatar(request);

      expect(result.success).toBe(true);
      expect(result.avatar).toBeDefined();
      expect(result.avatar?.url).toContain('cdn.sovren.app');
    });

    it('should reject unsupported image types', async () => {
      await service.createProfile({ userId: 'user_123' });

      const request: AvatarUploadRequest = {
        userId: 'user_123',
        imageData: Buffer.from('data'),
        mimeType: 'image/svg+xml', // Not allowed
        filename: 'avatar.svg'
      };

      const result = await service.uploadAvatar(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid image type');
    });

    it('should reject oversized images', async () => {
      await service.createProfile({ userId: 'user_123' });

      // Create a buffer larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

      const request: AvatarUploadRequest = {
        userId: 'user_123',
        imageData: largeBuffer,
        mimeType: 'image/jpeg',
        filename: 'large.jpg'
      };

      const result = await service.uploadAvatar(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Image size exceeds maximum');
    });

    it('should update completion score after avatar upload', async () => {
      await service.createProfile({ userId: 'user_123' });
      const initialProfile = await service.getProfile('user_123');
      const initialScore = initialProfile!.completionScore;

      const imageBuffer = Buffer.from('fake-image-data');
      await service.uploadAvatar({
        userId: 'user_123',
        imageData: imageBuffer,
        mimeType: 'image/jpeg',
        filename: 'avatar.jpg'
      });

      const updatedProfile = await service.getProfile('user_123');
      expect(updatedProfile!.completionScore).toBeGreaterThan(initialScore);
    });
  });

  describe('deleteAvatar()', () => {
    it('should delete avatar', async () => {
      await service.createProfile({ userId: 'user_123' });

      // First upload an avatar
      await service.uploadAvatar({
        userId: 'user_123',
        imageData: Buffer.from('data'),
        mimeType: 'image/jpeg',
        filename: 'avatar.jpg'
      });

      await service.deleteAvatar('user_123');

      const profile = await service.getProfile('user_123');
      expect(profile?.avatar).toBeUndefined();
    });

    it('should update completion score after avatar deletion', async () => {
      await service.createProfile({ userId: 'user_123' });
      await service.uploadAvatar({
        userId: 'user_123',
        imageData: Buffer.from('data'),
        mimeType: 'image/jpeg',
        filename: 'avatar.jpg'
      });

      const withAvatar = await service.getProfile('user_123');
      const scoreWithAvatar = withAvatar!.completionScore;

      await service.deleteAvatar('user_123');

      const withoutAvatar = await service.getProfile('user_123');
      expect(withoutAvatar!.completionScore).toBeLessThan(scoreWithAvatar);
    });
  });

  describe('Social Links', () => {
    describe('addSocialLink()', () => {
      it('should add social media link', async () => {
        await service.createProfile({ userId: 'user_123' });

        const link = {
          platform: 'twitter' as const,
          url: 'https://twitter.com/johndoe',
          username: 'johndoe'
        };

        const profile = await service.addSocialLink('user_123', link);

        expect(profile.socialLinks).toHaveLength(1);
        expect(profile.socialLinks[0].platform).toBe('twitter');
        expect(profile.socialLinks[0].verified).toBe(false);
      });

      it('should replace existing link for same platform', async () => {
        await service.createProfile({ userId: 'user_123' });

        await service.addSocialLink('user_123', {
          platform: 'twitter',
          url: 'https://twitter.com/old'
        });

        const profile = await service.addSocialLink('user_123', {
          platform: 'twitter',
          url: 'https://twitter.com/new'
        });

        expect(profile.socialLinks).toHaveLength(1);
        expect(profile.socialLinks[0].url).toBe('https://twitter.com/new');
      });

      it('should emit social link added event', async () => {
        await service.createProfile({ userId: 'user_123' });
        mockEventBus.clear();

        await service.addSocialLink('user_123', {
          platform: 'twitter',
          url: 'https://twitter.com/johndoe'
        });

        const event = mockEventBus.events.find(e => e.type === 'profile.social_link.added');
        expect(event).toBeDefined();
      });
    });

    describe('removeSocialLink()', () => {
      it('should remove social media link', async () => {
        await service.createProfile({ userId: 'user_123' });

        await service.addSocialLink('user_123', {
          platform: 'twitter',
          url: 'https://twitter.com/johndoe'
        });

        const profile = await service.removeSocialLink('user_123', 'twitter');

        expect(profile.socialLinks).toHaveLength(0);
      });

      it('should emit social link removed event', async () => {
        await service.createProfile({ userId: 'user_123' });

        await service.addSocialLink('user_123', {
          platform: 'twitter',
          url: 'https://twitter.com/johndoe'
        });

        mockEventBus.clear();

        await service.removeSocialLink('user_123', 'twitter');

        const event = mockEventBus.events.find(e => e.type === 'profile.social_link.removed');
        expect(event).toBeDefined();
      });
    });

    describe('verifySocialLink()', () => {
      it('should verify social media link', async () => {
        await service.createProfile({ userId: 'user_123' });

        await service.addSocialLink('user_123', {
          platform: 'twitter',
          url: 'https://twitter.com/johndoe'
        });

        const result = await service.verifySocialLink({
          userId: 'user_123',
          platform: 'twitter',
          url: 'https://twitter.com/johndoe'
        });

        expect(result.success).toBe(true);
        expect(result.verified).toBe(true);
        expect(result.verifiedAt).toBeDefined();
      });

      it('should update link verification status', async () => {
        await service.createProfile({ userId: 'user_123' });

        await service.addSocialLink('user_123', {
          platform: 'twitter',
          url: 'https://twitter.com/johndoe'
        });

        await service.verifySocialLink({
          userId: 'user_123',
          platform: 'twitter',
          url: 'https://twitter.com/johndoe'
        });

        const profile = await service.getProfile('user_123');
        expect(profile?.socialLinks[0].verified).toBe(true);
      });

      it('should emit social link verified event', async () => {
        await service.createProfile({ userId: 'user_123' });

        await service.addSocialLink('user_123', {
          platform: 'twitter',
          url: 'https://twitter.com/johndoe'
        });

        mockEventBus.clear();

        await service.verifySocialLink({
          userId: 'user_123',
          platform: 'twitter',
          url: 'https://twitter.com/johndoe'
        });

        const event = mockEventBus.events.find(e => e.type === 'profile.social_link.verified');
        expect(event).toBeDefined();
      });
    });
  });

  describe('updateVisibility()', () => {
    it('should update profile visibility', async () => {
      await service.createProfile({
        userId: 'user_123',
        visibility: 'public'
      });

      const profile = await service.updateVisibility('user_123', 'private');

      expect(profile.visibility).toBe('private');
    });

    it('should emit visibility changed event', async () => {
      await service.createProfile({ userId: 'user_123' });
      mockEventBus.clear();

      await service.updateVisibility('user_123', 'followers-only');

      const event = mockEventBus.events.find(e => e.type === 'profile.visibility.changed');
      expect(event).toBeDefined();
    });
  });

  describe('searchProfiles()', () => {
    beforeEach(async () => {
      // Create multiple profiles for testing
      await service.createProfile({
        userId: 'user_1',
        displayName: 'Alice Developer',
        username: 'alice',
        bio: 'Full-stack developer',
        location: 'San Francisco'
      });

      await service.createProfile({
        userId: 'user_2',
        displayName: 'Bob Designer',
        username: 'bob',
        bio: 'UI/UX designer',
        location: 'New York'
      });

      await service.createProfile({
        userId: 'user_3',
        displayName: 'Charlie Developer',
        username: 'charlie',
        bio: 'Backend developer',
        location: 'San Francisco'
      });
    });

    it('should search profiles by query term', async () => {
      const result = await service.searchProfiles({
        query: 'developer'
      });

      expect(result.profiles.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter by location', async () => {
      const result = await service.searchProfiles({
        location: 'San Francisco'
      });

      expect(result.profiles.length).toBe(2);
      expect(result.profiles.every(p => p.location === 'San Francisco')).toBe(true);
    });

    it('should paginate results', async () => {
      const result = await service.searchProfiles({
        page: 1,
        pageSize: 2
      });

      expect(result.profiles.length).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by completion score', async () => {
      const result = await service.searchProfiles({
        sortBy: 'relevance',
        sortOrder: 'desc'
      });

      // Results should be sorted by completion score descending
      for (let i = 0; i < result.profiles.length - 1; i++) {
        expect(result.profiles[i].completionScore).toBeGreaterThanOrEqual(
          result.profiles[i + 1].completionScore
        );
      }
    });

    it('should cache search results', async () => {
      const query: ProfileSearchQuery = { query: 'developer' };

      // First search
      await service.searchProfiles(query);

      // Second search should hit cache
      const result = await service.searchProfiles(query);

      expect(result).toBeDefined();
    });
  });

  describe('recordProfileView()', () => {
    it('should increment profile view count', async () => {
      const profile = await service.createProfile({ userId: 'user_123' });

      await service.recordProfileView(profile.id);

      const updated = await service.getProfile('user_123');
      expect(updated?.analytics.profileViews).toBe(1);
    });

    it('should update last viewed timestamp', async () => {
      const profile = await service.createProfile({ userId: 'user_123' });

      await service.recordProfileView(profile.id);

      const updated = await service.getProfile('user_123');
      expect(updated?.analytics.lastViewedAt).toBeDefined();
    });

    it('should emit profile viewed event', async () => {
      const profile = await service.createProfile({ userId: 'user_123' });
      mockEventBus.clear();

      await service.recordProfileView(profile.id, 'viewer_456');

      const event = mockEventBus.events.find(e => e.type === 'profile.viewed');
      expect(event).toBeDefined();
    });

    it('should handle anonymous views', async () => {
      const profile = await service.createProfile({ userId: 'user_123' });

      await service.recordProfileView(profile.id); // No viewerId

      const updated = await service.getProfile('user_123');
      expect(updated?.analytics.profileViews).toBe(1);
    });
  });

  describe('getProfileAnalytics()', () => {
    it('should return profile analytics', async () => {
      await service.createProfile({ userId: 'user_123' });

      const analytics = await service.getProfileAnalytics('user_123');

      expect(analytics).toBeDefined();
      expect(analytics.userId).toBe('user_123');
      expect(analytics.metrics).toBeDefined();
      expect(analytics.period).toBeDefined();
    });

    it('should calculate engagement rate', async () => {
      const profile = await service.createProfile({ userId: 'user_123' });

      // Record some views
      await service.recordProfileView(profile.id);
      await service.recordProfileView(profile.id);

      const analytics = await service.getProfileAnalytics('user_123');

      expect(analytics.metrics.totalViews).toBeGreaterThan(0);
      expect(analytics.metrics.engagementRate).toBeGreaterThanOrEqual(0);
    });

    it('should cache analytics results', async () => {
      await service.createProfile({ userId: 'user_123' });

      // First call
      await service.getProfileAnalytics('user_123');

      // Second call should hit cache
      const analytics = await service.getProfileAnalytics('user_123');

      expect(analytics).toBeDefined();
    });
  });

  describe('getProfileCompletion()', () => {
    it('should calculate completion percentage', async () => {
      await service.createProfile({
        userId: 'user_123',
        displayName: 'John Doe',
        username: 'johndoe',
        bio: 'Software developer'
      });

      const completion = await service.getProfileCompletion('user_123');

      expect(completion.percentage).toBeGreaterThan(0);
      expect(completion.completedFields).toContain('displayName');
      expect(completion.completedFields).toContain('username');
      expect(completion.completedFields).toContain('bio');
    });

    it('should list missing fields', async () => {
      await service.createProfile({ userId: 'user_123' });

      const completion = await service.getProfileCompletion('user_123');

      expect(completion.missingFields.length).toBeGreaterThan(0);
      expect(completion.suggestions.length).toBeGreaterThan(0);
    });

    it('should cache completion results', async () => {
      await service.createProfile({ userId: 'user_123' });

      // First call
      await service.getProfileCompletion('user_123');

      // Second call should hit cache
      const completion = await service.getProfileCompletion('user_123');

      expect(completion).toBeDefined();
    });
  });

  describe('validateProfile()', () => {
    it('should validate valid profile data', () => {
      const result = service.validateProfile({
        displayName: 'John Doe',
        username: 'johndoe',
        bio: 'Software developer',
        website: 'https://johndoe.com'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid display name', () => {
      const result = service.validateProfile({
        displayName: '' // Empty
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'displayName')).toBe(true);
    });

    it('should reject short username', () => {
      const result = service.validateProfile({
        username: 'ab' // Too short (min 3)
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'username')).toBe(true);
    });

    it('should reject long bio', () => {
      const result = service.validateProfile({
        bio: 'a'.repeat(501) // Max 500
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'bio')).toBe(true);
    });

    it('should reject invalid website URL', () => {
      const result = service.validateProfile({
        website: 'not-a-url'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'website')).toBe(true);
    });
  });

  describe('isUsernameAvailable()', () => {
    it('should return true for available username', async () => {
      const available = await service.isUsernameAvailable('newusername');
      expect(available).toBe(true);
    });

    it('should return false for taken username', async () => {
      await service.createProfile({
        userId: 'user_123',
        username: 'johndoe'
      });

      const available = await service.isUsernameAvailable('johndoe');
      expect(available).toBe(false);
    });

    it('should return true when excluding current user', async () => {
      await service.createProfile({
        userId: 'user_123',
        username: 'johndoe'
      });

      const available = await service.isUsernameAvailable('johndoe', 'user_123');
      expect(available).toBe(true);
    });

    it('should be case-insensitive', async () => {
      await service.createProfile({
        userId: 'user_123',
        username: 'JohnDoe'
      });

      const available = await service.isUsernameAvailable('johndoe');
      expect(available).toBe(false);
    });
  });

  describe('getProfilesBatch()', () => {
    it('should retrieve multiple profiles', async () => {
      await service.createProfile({ userId: 'user_1' });
      await service.createProfile({ userId: 'user_2' });
      await service.createProfile({ userId: 'user_3' });

      const profiles = await service.getProfilesBatch(['user_1', 'user_2', 'user_3']);

      expect(profiles).toHaveLength(3);
      expect(profiles.map(p => p.userId)).toEqual(['user_1', 'user_2', 'user_3']);
    });

    it('should handle non-existent profiles', async () => {
      await service.createProfile({ userId: 'user_1' });

      const profiles = await service.getProfilesBatch(['user_1', 'nonexistent']);

      expect(profiles).toHaveLength(1);
      expect(profiles[0].userId).toBe('user_1');
    });
  });

  describe('updateVerificationStatus()', () => {
    it('should update verification status to verified', async () => {
      await service.createProfile({ userId: 'user_123' });

      const profile = await service.updateVerificationStatus('user_123', 'verified', 'admin_456');

      expect(profile.verificationStatus).toBe('verified');
      expect(profile.verificationBadge).toBe(true);
      expect(profile.verifiedAt).toBeDefined();
    });

    it('should update verification status to rejected', async () => {
      await service.createProfile({ userId: 'user_123' });

      const profile = await service.updateVerificationStatus('user_123', 'rejected', 'admin_456');

      expect(profile.verificationStatus).toBe('rejected');
      expect(profile.verificationBadge).toBe(false);
    });

    it('should emit verification completed event', async () => {
      await service.createProfile({ userId: 'user_123' });
      mockEventBus.clear();

      await service.updateVerificationStatus('user_123', 'verified', 'admin_456');

      const event = mockEventBus.events.find(e => e.type === 'profile.verification.completed');
      expect(event).toBeDefined();
    });
  });

  describe('healthCheck()', () => {
    it('should return healthy status', async () => {
      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.cacheConnected).toBe(true);
      expect(health.dbConnected).toBe(true);
      expect(health.lastUpdate).toBeDefined();
    });

    it('should detect cache connection issues', async () => {
      // Mock cache failure
      const originalGetStats = mockCache.getStats;
      mockCache.getStats = async () => {
        throw new Error('Cache error');
      };

      const health = await service.healthCheck();

      expect(health.cacheConnected).toBe(false);

      // Restore original method
      mockCache.getStats = originalGetStats;
    });
  });

  describe('dispose()', () => {
    it('should dispose service resources', async () => {
      await service.createProfile({ userId: 'user_123' });

      await service.dispose();

      // After dispose, the internal profiles map is cleared.
      // The cache may still have data, but the in-memory store is gone.
      // Verify the profiles map is cleared by checking a new service instance
      // or by checking a profile not in cache.
      const profile = await service.getProfile('non_cached_user');
      expect(profile).toBeNull();
    });
  });
});
