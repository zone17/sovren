/**
 * UserPreferencesService Test Suite
 * User Story: US-E5-020
 * Part of Epic 005 - Backend Service Refactoring
 *
 * Coverage target: 95%+
 */

import { UserPreferencesService } from '../UserPreferencesService';
import { UserPreferencesRepository } from '../../../repositories/user/UserPreferencesRepository';
import type { ICacheService } from '../../../interfaces/shared/ICacheService';
import type { IEventBus } from '../../../interfaces/shared/IEventBus';
import type { ILogger } from '../../../interfaces/shared/ILogger';
import type {
  PreferenceUpdateRequest,
  BulkPreferenceUpdateRequest,
  NotificationPreference
} from '../../../types/user-preferences';
import { DEFAULT_PREFERENCES } from '../../../types/user-preferences';
import { DomainEventType } from '../../../interfaces/shared/IEventBus';

// Mock implementations
class MockCacheService implements ICacheService {
  private cache = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get(key) || null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.cache.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async invalidate(pattern: string): Promise<number> {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    return 0;
  }

  async flush(): Promise<void> {
    this.cache.clear();
  }

  async getTtl(key: string): Promise<number> {
    return -1;
  }

  async setTtl(key: string, ttl: number): Promise<boolean> {
    return true;
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    return new Map();
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {}

  async remember<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;
    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  async getStats(): Promise<any> {
    return {};
  }

  async registerWarmupStrategy(strategy: any): Promise<void> {}
  async warmup(strategyName?: string): Promise<void> {}
  async registerInvalidationPattern(pattern: any): Promise<void> {}
  async healthCheck(): Promise<boolean> {
    return true;
  }

  async dispose(): Promise<void> {
    this.cache.clear();
  }
}

class MockEventBus implements IEventBus {
  public events: any[] = [];

  async publish(event: any): Promise<void> {
    this.events.push(event);
  }

  async publishBatch(events: any[]): Promise<void> {
    this.events.push(...events);
  }

  subscribe(eventType: any, handler: any): string {
    return 'sub_123';
  }

  subscribeToMany(eventTypes: any[], handler: any): string {
    return 'sub_456';
  }

  subscribeToAll(handler: any): string {
    return 'sub_789';
  }

  subscribeWithFilter(filter: any, handler: any): string {
    return 'sub_filter';
  }

  unsubscribe(subscriptionId: string): void {}
  unsubscribeAll(): void {}

  async getEvent(eventId: string): Promise<any> {
    return null;
  }

  async queryEvents(filter: any, limit?: number, offset?: number): Promise<any[]> {
    return [];
  }

  async replayEvents(options: any): Promise<any[]> {
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

  async dispose(): Promise<void> {
    this.events = [];
  }
}

class MockLogger implements ILogger {
  public logs: Array<{ level: string; message: string; meta?: any }> = [];

  info(message: string, meta?: any): void {
    this.logs.push({ level: 'info', message, meta });
  }

  error(message: string, error?: Error): void {
    this.logs.push({ level: 'error', message, meta: error });
  }

  warn(message: string, meta?: any): void {
    this.logs.push({ level: 'warn', message, meta });
  }

  debug(message: string, meta?: any): void {
    this.logs.push({ level: 'debug', message, meta });
  }
}

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let repository: UserPreferencesRepository;
  let cacheService: MockCacheService;
  let eventBus: MockEventBus;
  let logger: MockLogger;

  beforeEach(() => {
    repository = new UserPreferencesRepository();
    cacheService = new MockCacheService();
    eventBus = new MockEventBus();
    logger = new MockLogger();

    service = new UserPreferencesService(
      repository,
      cacheService,
      eventBus,
      logger
    );
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('getPreferences', () => {
    it('should create default preferences for new user', async () => {
      const userId = 'user123';
      const preferences = await service.getPreferences(userId);

      expect(preferences).toBeDefined();
      expect(preferences.userId).toBe(userId);
      expect(preferences.version).toBe(1);
      expect(preferences.notifications).toEqual([]);
      expect(preferences.privacy).toBeDefined();
      expect(preferences.content).toBeDefined();
      expect(preferences.display).toBeDefined();
      expect(preferences.communication).toBeDefined();
      expect(preferences.accessibility).toBeDefined();
      expect(preferences.dataExport).toBeDefined();
    });

    it('should return cached preferences on second call', async () => {
      const userId = 'user456';

      const first = await service.getPreferences(userId);
      const second = await service.getPreferences(userId);

      expect(first).toEqual(second);
      expect(logger.logs.filter(l => l.message.includes('Cache hit'))).toHaveLength(1);
    });

    it('should throw error for invalid user ID', async () => {
      await expect(service.getPreferences('')).rejects.toThrow('Invalid user ID');
      await expect(service.getPreferences('   ')).rejects.toThrow('Invalid user ID');
    });
  });

  describe('getSpecificPreferences', () => {
    it('should get notification preferences', async () => {
      const userId = 'user789';
      const notifications = await service.getNotificationPreferences(userId);

      expect(Array.isArray(notifications)).toBe(true);
    });

    it('should get privacy settings', async () => {
      const userId = 'user101';
      const privacy = await service.getPrivacySettings(userId);

      expect(privacy).toBeDefined();
      expect(privacy.profileVisibility).toBeDefined();
      expect(privacy.activityVisibility).toBeDefined();
    });

    it('should get content preferences', async () => {
      const userId = 'user102';
      const content = await service.getContentPreferences(userId);

      expect(content).toBeDefined();
      expect(content.languages).toBeDefined();
      expect(content.topics).toBeDefined();
    });

    it('should get display preferences', async () => {
      const userId = 'user103';
      const display = await service.getDisplayPreferences(userId);

      expect(display).toBeDefined();
      expect(display.theme).toBeDefined();
      expect(display.fontSize).toBeDefined();
    });

    it('should get communication preferences', async () => {
      const userId = 'user104';
      const communication = await service.getCommunicationPreferences(userId);

      expect(communication).toBeDefined();
      expect(communication.emailNotifications).toBeDefined();
    });

    it('should get accessibility settings', async () => {
      const userId = 'user105';
      const accessibility = await service.getAccessibilitySettings(userId);

      expect(accessibility).toBeDefined();
      expect(accessibility.screenReader).toBeDefined();
    });

    it('should get data export preferences', async () => {
      const userId = 'user106';
      const dataExport = await service.getDataExportPreferences(userId);

      expect(dataExport).toBeDefined();
      expect(dataExport.format).toBeDefined();
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences successfully', async () => {
      const userId = 'user200';

      // Create initial preferences
      await service.getPreferences(userId);

      // Update
      const request: PreferenceUpdateRequest = {
        userId,
        updates: {
          display: {
            theme: 'dark',
            fontSize: 'large',
            fontFamily: 'system-ui',
            layout: 'comfortable',
            density: 'default'
          }
        }
      };

      const updated = await service.updatePreferences(request);

      expect(updated.display.theme).toBe('dark');
      expect(updated.display.fontSize).toBe('large');
      expect(updated.version).toBe(2);
    });

    it('should invalidate cache after update', async () => {
      const userId = 'user201';

      await service.getPreferences(userId);

      const request: PreferenceUpdateRequest = {
        userId,
        updates: {
          display: { ...DEFAULT_PREFERENCES.display, theme: 'dark' }
        }
      };

      await service.updatePreferences(request);

      const cached = await cacheService.get(`user:preferences:${userId}`);
      expect(cached).toBeNull();
    });

    it('should emit event after update', async () => {
      const userId = 'user202';

      await service.getPreferences(userId);

      const request: PreferenceUpdateRequest = {
        userId,
        updates: {
          display: { ...DEFAULT_PREFERENCES.display, theme: 'dark' }
        }
      };

      await service.updatePreferences(request);

      expect(eventBus.events).toHaveLength(1);
      expect(eventBus.events[0].type).toBe(DomainEventType.USER_UPDATED);
    });

    it('should track changes in history', async () => {
      const userId = 'user203';

      await service.getPreferences(userId);

      const request: PreferenceUpdateRequest = {
        userId,
        updates: {
          display: { ...DEFAULT_PREFERENCES.display, theme: 'dark' }
        },
        reason: 'User preference change'
      };

      await service.updatePreferences(request);

      const history = await service.getPreferenceHistory(userId);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].field).toBe('display');
    });

    it('should reject invalid preference values', async () => {
      const userId = 'user204';

      const request: PreferenceUpdateRequest = {
        userId,
        updates: {
          display: {
            theme: 'invalid' as any,
            fontSize: 'medium',
            fontFamily: 'system-ui',
            layout: 'comfortable',
            density: 'default'
          }
        }
      };

      await expect(service.updatePreferences(request)).rejects.toThrow(
        'Preference validation failed'
      );
    });
  });

  describe('updateSpecificPreferences', () => {
    it('should update notification preferences', async () => {
      const userId = 'user300';

      const notifications: NotificationPreference[] = [
        {
          eventType: 'payment_received',
          email: true,
          push: true,
          inApp: true
        }
      ];

      const updated = await service.updateNotificationPreferences(userId, notifications);

      expect(updated.notifications).toEqual(notifications);
    });

    it('should update privacy settings', async () => {
      const userId = 'user301';

      const updated = await service.updatePrivacySettings(userId, {
        profileVisibility: 'private'
      });

      expect(updated.privacy.profileVisibility).toBe('private');
    });

    it('should update content preferences', async () => {
      const userId = 'user302';

      const updated = await service.updateContentPreferences(userId, {
        languages: ['en', 'es']
      });

      expect(updated.content.languages).toEqual(['en', 'es']);
    });

    it('should update display preferences', async () => {
      const userId = 'user303';

      const updated = await service.updateDisplayPreferences(userId, {
        theme: 'dark'
      });

      expect(updated.display.theme).toBe('dark');
    });

    it('should update communication preferences', async () => {
      const userId = 'user304';

      const updated = await service.updateCommunicationPreferences(userId, {
        emailNotifications: false
      });

      expect(updated.communication.emailNotifications).toBe(false);
    });

    it('should update accessibility settings', async () => {
      const userId = 'user305';

      const updated = await service.updateAccessibilitySettings(userId, {
        screenReader: true
      });

      expect(updated.accessibility.screenReader).toBe(true);
    });

    it('should update data export preferences', async () => {
      const userId = 'user306';

      const updated = await service.updateDataExportPreferences(userId, {
        format: 'csv'
      });

      expect(updated.dataExport.format).toBe('csv');
    });
  });

  describe('bulkUpdatePreferences', () => {
    it('should update multiple preference categories atomically', async () => {
      const userId = 'user400';

      const request: BulkPreferenceUpdateRequest = {
        userId,
        updates: [
          {
            category: 'display',
            value: { ...DEFAULT_PREFERENCES.display, theme: 'dark' }
          },
          {
            category: 'privacy',
            value: { ...DEFAULT_PREFERENCES.privacy, profileVisibility: 'private' }
          }
        ],
        atomic: true
      };

      const updated = await service.bulkUpdatePreferences(request);

      expect(updated.display.theme).toBe('dark');
      expect(updated.privacy.profileVisibility).toBe('private');
    });

    it('should throw error if no updates provided', async () => {
      const userId = 'user401';

      const request: BulkPreferenceUpdateRequest = {
        userId,
        updates: [],
        atomic: true
      };

      await expect(service.bulkUpdatePreferences(request)).rejects.toThrow(
        'No updates provided'
      );
    });

    it('should validate all updates before applying', async () => {
      const userId = 'user402';

      const request: BulkPreferenceUpdateRequest = {
        userId,
        updates: [
          {
            category: 'display',
            value: { theme: 'invalid' as any }
          }
        ],
        atomic: true
      };

      await expect(service.bulkUpdatePreferences(request)).rejects.toThrow(
        'validation failed'
      );
    });
  });

  describe('applyPreset', () => {
    it('should apply beginner preset', async () => {
      const userId = 'user500';

      const updated = await service.applyPreset(userId, 'beginner');

      expect(updated.preset).toBe('beginner');
      expect(updated.display.layout).toBe('comfortable');
      expect(updated.communication.frequency).toBe('daily');
    });

    it('should apply creator preset', async () => {
      const userId = 'user501';

      const updated = await service.applyPreset(userId, 'creator');

      expect(updated.preset).toBe('creator');
      expect(updated.display.theme).toBe('dark');
      expect(updated.communication.frequency).toBe('realtime');
    });

    it('should apply power_user preset', async () => {
      const userId = 'user502';

      const updated = await service.applyPreset(userId, 'power_user');

      expect(updated.preset).toBe('power_user');
      expect(updated.privacy.profileVisibility).toBe('followers_only');
      expect(updated.display.layout).toBe('compact');
    });

    it('should throw error for invalid preset', async () => {
      const userId = 'user503';

      await expect(
        service.applyPreset(userId, 'invalid' as any)
      ).rejects.toThrow('Invalid preset');
    });
  });

  describe('resetPreferences', () => {
    it('should reset preferences to defaults', async () => {
      const userId = 'user600';

      // Set custom preferences
      await service.applyPreset(userId, 'power_user');

      // Reset
      const reset = await service.resetPreferences(userId);

      expect(reset.preset).toBe('custom');
      expect(reset.display.theme).toBe('auto');
      expect(reset.privacy.profileVisibility).toBe('public');
    });
  });

  describe('deletePreferences', () => {
    it('should delete user preferences', async () => {
      const userId = 'user700';

      // Create preferences
      await service.getPreferences(userId);

      // Delete
      const deleted = await service.deletePreferences(userId);

      expect(deleted).toBe(true);

      // Verify deletion
      const exists = await repository.exists(userId);
      expect(exists).toBe(false);
    });

    it('should emit event after deletion', async () => {
      const userId = 'user701';

      await service.getPreferences(userId);
      eventBus.events = [];

      await service.deletePreferences(userId);

      expect(eventBus.events).toHaveLength(1);
      expect(eventBus.events[0].payload.action).toBe('preferences_deleted');
    });
  });

  describe('validatePreferences', () => {
    it('should validate valid preferences', async () => {
      const result = await service.validatePreferences({
        display: {
          theme: 'dark',
          fontSize: 'medium',
          fontFamily: 'system-ui',
          layout: 'comfortable',
          density: 'default'
        }
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid theme', async () => {
      const result = await service.validatePreferences({
        display: {
          theme: 'invalid' as any,
          fontSize: 'medium',
          fontFamily: 'system-ui',
          layout: 'comfortable',
          density: 'default'
        }
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('display.theme');
    });

    it('should reject empty languages array', async () => {
      const result = await service.validatePreferences({
        content: {
          languages: [],
          topics: [],
          contentTypes: [],
          sensitiveContent: 'blur',
          autoplayVideos: false,
          showSpoilers: false
        }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'content.languages')).toBe(true);
    });

    it('should warn when all notifications disabled', async () => {
      const result = await service.validatePreferences({
        communication: {
          emailNotifications: false,
          pushNotifications: false,
          smsNotifications: false,
          marketingEmails: false,
          productUpdates: false,
          newsletters: false,
          weeklyDigest: false,
          monthlyReport: false,
          frequency: 'never'
        }
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getPreferenceHistory', () => {
    it('should return preference change history', async () => {
      const userId = 'user800';

      // Create and update preferences
      await service.getPreferences(userId);
      await service.updateDisplayPreferences(userId, { theme: 'dark' });
      await service.updatePrivacySettings(userId, { profileVisibility: 'private' });

      const history = await service.getPreferenceHistory(userId);

      expect(history.length).toBe(2);
    });

    it('should support pagination', async () => {
      const userId = 'user801';

      await service.getPreferences(userId);
      await service.updateDisplayPreferences(userId, { theme: 'dark' });
      await service.updateDisplayPreferences(userId, { fontSize: 'large' });
      await service.updateDisplayPreferences(userId, { layout: 'compact' });

      const page1 = await service.getPreferenceHistory(userId, 2, 0);
      const page2 = await service.getPreferenceHistory(userId, 2, 2);

      expect(page1.length).toBe(2);
      expect(page2.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getFieldHistory', () => {
    it('should return history for specific field', async () => {
      const userId = 'user900';

      await service.getPreferences(userId);
      await service.updateDisplayPreferences(userId, { theme: 'dark' });
      await service.updateDisplayPreferences(userId, { fontSize: 'large' });

      const history = await service.getFieldHistory(userId, 'display');

      expect(history.length).toBe(2);
      expect(history.every(h => h.field === 'display')).toBe(true);
    });
  });

  describe('exportPreferences', () => {
    it('should export preferences in JSON format', async () => {
      const userId = 'user1000';

      await service.getPreferences(userId);

      const exported = await service.exportPreferences(userId, 'json');

      expect(exported.userId).toBe(userId);
      expect(exported.format).toBe('json');
      expect(exported.preferences).toBeDefined();
      expect(exported.exportedAt).toBeInstanceOf(Date);
    });

    it('should include history when requested', async () => {
      const userId = 'user1001';

      await service.getPreferences(userId);
      await service.updateDisplayPreferences(userId, { theme: 'dark' });

      const exported = await service.exportPreferences(userId, 'json', true);

      expect(exported.history).toBeDefined();
      expect(exported.history!.length).toBeGreaterThan(0);
    });
  });

  describe('importPreferences', () => {
    it('should import valid preferences', async () => {
      const userId = 'user1100';

      const exportData = await service.exportPreferences(userId, 'json');

      exportData.preferences.display.theme = 'dark';

      const imported = await service.importPreferences(userId, exportData);

      expect(imported.display.theme).toBe('dark');
    });

    it('should reject import with user ID mismatch', async () => {
      const userId1 = 'user1101';
      const userId2 = 'user1102';

      const exportData = await service.exportPreferences(userId1, 'json');

      await expect(
        service.importPreferences(userId2, exportData)
      ).rejects.toThrow('User ID mismatch');
    });

    it('should reject invalid imported preferences', async () => {
      const userId = 'user1103';

      const exportData = structuredClone(await service.exportPreferences(userId, 'json'));
      exportData.preferences.display.theme = 'invalid' as any;

      await expect(
        service.importPreferences(userId, exportData)
      ).rejects.toThrow('Import validation failed');
    });
  });

  describe('getAvailablePresets', () => {
    it('should return available presets', async () => {
      const presets = await service.getAvailablePresets();

      expect(presets.length).toBe(3);
      expect(presets.map(p => p.name)).toEqual(['beginner', 'creator', 'power_user']);
    });
  });

  describe('hasCustomPreferences', () => {
    it('should return false for non-existent preferences', async () => {
      const userId = 'user1200';

      const hasCustom = await service.hasCustomPreferences(userId);

      expect(hasCustom).toBe(false);
    });

    it('should return false for default preferences', async () => {
      const userId = 'user1201';

      await service.getPreferences(userId);

      const hasCustom = await service.hasCustomPreferences(userId);

      expect(hasCustom).toBe(false);
    });

    it('should return true after customization', async () => {
      const userId = 'user1202';

      await service.getPreferences(userId);
      await service.updateDisplayPreferences(userId, { theme: 'dark' });

      const hasCustom = await service.hasCustomPreferences(userId);

      expect(hasCustom).toBe(true);
    });
  });

  describe('getDefaults', () => {
    it('should return default preferences', async () => {
      const defaults = await service.getDefaults();

      expect(defaults.version).toBe(1);
      expect(defaults.display.theme).toBe('auto');
      expect(defaults.privacy.profileVisibility).toBe('public');
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      const userId = 'user1300';

      // Mock repository to throw error
      vi.spyOn(repository, 'update').mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateDisplayPreferences(userId, { theme: 'dark' })
      ).rejects.toThrow('Database error');
    });

    it('should continue on history entry failure', async () => {
      const userId = 'user1301';

      vi.spyOn(repository, 'addHistoryEntry').mockRejectedValue(new Error('History error'));

      // Should not throw
      await service.updateDisplayPreferences(userId, { theme: 'dark' });

      expect(logger.logs.some(l => l.message.includes('Failed to add history entry'))).toBe(true);
    });

    it('should continue on event emission failure', async () => {
      const userId = 'user1302';

      vi.spyOn(eventBus, 'publish').mockRejectedValue(new Error('Event error'));

      // Should not throw
      await service.updateDisplayPreferences(userId, { theme: 'dark' });

      expect(logger.logs.some(l => l.message.includes('Failed to emit'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent updates', async () => {
      const userId = 'user1400';

      await service.getPreferences(userId);

      // Simulate concurrent updates
      const updates = [
        service.updateDisplayPreferences(userId, { theme: 'dark' }),
        service.updatePrivacySettings(userId, { profileVisibility: 'private' }),
        service.updateContentPreferences(userId, { languages: ['en', 'es'] })
      ];

      const results = await Promise.all(updates);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.userId === userId)).toBe(true);
    });

    it('should handle empty updates object', async () => {
      const userId = 'user1401';

      const request: PreferenceUpdateRequest = {
        userId,
        updates: {}
      };

      const updated = await service.updatePreferences(request);

      expect(updated.userId).toBe(userId);
    });
  });
});
