/**
 * User Preferences Repository
 * Data access layer for user preferences
 * User Story: US-E5-020
 * Part of Epic 005 - Backend Service Refactoring
 */

import type {
  UserPreferences,
  PreferenceChangeHistory
} from '../../types/user-preferences';

/**
 * Repository interface for user preferences data access
 */
export interface IUserPreferencesRepository {
  findById(userId: string): Promise<UserPreferences | null>;
  create(preferences: UserPreferences): Promise<UserPreferences>;
  update(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences>;
  delete(userId: string): Promise<boolean>;
  exists(userId: string): Promise<boolean>;

  // History operations
  addHistoryEntry(entry: PreferenceChangeHistory): Promise<void>;
  getHistory(userId: string, limit?: number, offset?: number): Promise<PreferenceChangeHistory[]>;
  getFieldHistory(userId: string, field: string, limit?: number): Promise<PreferenceChangeHistory[]>;
}

/**
 * In-memory implementation of UserPreferencesRepository
 * For production, this would connect to PostgreSQL/Supabase
 */
export class UserPreferencesRepository implements IUserPreferencesRepository {
  private preferences: Map<string, UserPreferences> = new Map();
  private history: Map<string, PreferenceChangeHistory[]> = new Map();

  async findById(userId: string): Promise<UserPreferences | null> {
    return this.preferences.get(userId) || null;
  }

  async create(preferences: UserPreferences): Promise<UserPreferences> {
    this.preferences.set(preferences.userId, preferences);
    return preferences;
  }

  async update(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const existing = await this.findById(userId);
    if (!existing) {
      throw new Error(`Preferences not found for user: ${userId}`);
    }

    const updated: UserPreferences = {
      ...existing,
      ...updates,
      userId,
      updatedAt: new Date(),
      version: existing.version + 1
    };

    this.preferences.set(userId, updated);
    return updated;
  }

  async delete(userId: string): Promise<boolean> {
    const deleted = this.preferences.delete(userId);
    if (deleted) {
      this.history.delete(userId);
    }
    return deleted;
  }

  async exists(userId: string): Promise<boolean> {
    return this.preferences.has(userId);
  }

  async addHistoryEntry(entry: PreferenceChangeHistory): Promise<void> {
    const userHistory = this.history.get(entry.userId) || [];
    userHistory.push(entry);
    this.history.set(entry.userId, userHistory);
  }

  async getHistory(
    userId: string,
    limit = 100,
    offset = 0
  ): Promise<PreferenceChangeHistory[]> {
    const userHistory = this.history.get(userId) || [];
    return userHistory
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
      .slice(offset, offset + limit);
  }

  async getFieldHistory(
    userId: string,
    field: string,
    limit = 100
  ): Promise<PreferenceChangeHistory[]> {
    const userHistory = this.history.get(userId) || [];
    return userHistory
      .filter(entry => entry.field === field)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())
      .slice(0, limit);
  }
}
