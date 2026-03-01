/**
 * BoundaryService
 * Focus hours, DND, auto-responses, availability status
 * EPIC-007: Creator Wellness System (US-E7-007)
 */

import type { CreatorBoundaries, AvailabilityStatus, DayOfWeek } from '@shared/types/wellness';
import type {
  IBoundaryService,
  BoundaryUpdateInput,
} from '../../interfaces/wellness/IBoundaryService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';

const DEFAULT_BOUNDARIES: CreatorBoundaries = {
  focus_hours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: 'UTC',
    days: [],
  },
  weekly_engagement_budget_mins: 0,
  engagement_used_mins: 0,
  dnd_mode: {
    active: false,
    auto_response_enabled: false,
    auto_response_template: '',
  },
  availability_status: 'hidden',
  availability_public: false,
  notification_batching: false,
};

export class BoundaryService implements IBoundaryService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async getBoundaries(creatorId: string): Promise<CreatorBoundaries> {
    const { data, error } = await this.db
      .from('creator_boundaries')
      .select('*')
      .eq('creator_id', creatorId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found — that's OK, return defaults
      this.logger.error('Failed to get boundaries', { creatorId, error });
      throw error;
    }

    if (!data) {
      return { ...DEFAULT_BOUNDARIES };
    }

    return this.mapRowToBoundaries(data);
  }

  async updateBoundaries(
    creatorId: string,
    input: BoundaryUpdateInput
  ): Promise<CreatorBoundaries> {
    const now = new Date().toISOString();

    // Build the upsert payload
    const payload: Record<string, any> = {
      creator_id: creatorId,
      updated_at: now,
    };

    if (input.focus_hours) {
      payload.focus_hours_enabled = input.focus_hours.enabled;
      payload.focus_hours_start = input.focus_hours.start;
      payload.focus_hours_end = input.focus_hours.end;
      payload.focus_hours_timezone = input.focus_hours.timezone;
      payload.focus_hours_days = input.focus_hours.days;
    }

    if (input.weekly_engagement_budget_mins !== undefined) {
      payload.weekly_engagement_budget_mins = input.weekly_engagement_budget_mins;
    }

    if (input.dnd_mode) {
      payload.auto_response_enabled = input.dnd_mode.auto_response_enabled;
      payload.auto_response_template = input.dnd_mode.auto_response_template;
    }

    if (input.availability_status) {
      payload.availability_status = input.availability_status;
    }

    if (input.notification_batching !== undefined) {
      payload.notification_batching = input.notification_batching;
    }

    const { data, error } = await this.db
      .from('creator_boundaries')
      .upsert(payload, { onConflict: 'creator_id' })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update boundaries', { creatorId, error });
      throw error;
    }

    this.logger.info('Boundaries updated', { creatorId });
    return this.mapRowToBoundaries(data);
  }

  private mapRowToBoundaries(row: any): CreatorBoundaries {
    return {
      focus_hours: {
        enabled: row.focus_hours_enabled || false,
        start: row.focus_hours_start || '22:00',
        end: row.focus_hours_end || '08:00',
        timezone: row.focus_hours_timezone || 'UTC',
        days: (row.focus_hours_days || []) as DayOfWeek[],
      },
      weekly_engagement_budget_mins: row.weekly_engagement_budget_mins || 0,
      engagement_used_mins: 0, // Calculated at query time from activity data
      dnd_mode: {
        active: row.dnd_active || false,
        auto_response_enabled: row.auto_response_enabled || false,
        auto_response_template: row.auto_response_template || '',
      },
      availability_status: (row.availability_status || 'hidden') as AvailabilityStatus,
      availability_public: row.availability_public || false,
      notification_batching: row.notification_batching || false,
    };
  }
}
