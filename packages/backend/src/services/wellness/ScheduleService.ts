/**
 * ScheduleService
 * Sustainable cadence recommendations and content buffer depth
 * EPIC-007: Creator Wellness System (US-E7-005, US-E7-006)
 */

import type {
  ScheduleRecommendation,
  BufferDepth,
  BufferStatus,
  DayOfWeek,
  ProductiveWindow,
} from '@shared/types/wellness';
import type { IScheduleService } from '../../interfaces/wellness/IScheduleService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';

/** Row shape returned from the creator_work_patterns Supabase table. */
interface WorkPatternRow {
  date: string;
  post_count?: number;
  content_time_mins?: number;
  engagement_time_mins?: number;
  management_time_mins?: number;
  first_activity_at?: string;
  last_activity_at?: string;
}

const DAY_NAMES: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export class ScheduleService implements IScheduleService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async getRecommendations(creatorId: string): Promise<ScheduleRecommendation> {
    // Get last 4 weeks of work patterns
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const { data: patterns } = await this.db
      .from('creator_work_patterns')
      .select('*')
      .eq('creator_id', creatorId)
      .gte('date', fourWeeksAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    const rows = (patterns || []) as unknown as WorkPatternRow[];

    // Calculate current posting rate
    const totalPosts = rows.reduce(
      (s: number, r: { post_count?: number }) => s + (r.post_count || 0),
      0
    );
    const currentPostsPerWeek = Math.round((totalPosts / 4) * 10) / 10;

    // Recommend a sustainable posting rate (capped at baseline avg if high)
    const recommendedPostsPerWeek = Math.max(2, Math.min(7, Math.round(currentPostsPerWeek * 0.8)));

    // Find optimal posting days (days with highest content creation)
    const dayActivity: Map<number, number> = new Map();
    for (const row of rows) {
      const date = new Date(row.date);
      const dayOfWeek = (date.getDay() + 6) % 7; // 0=Monday
      dayActivity.set(dayOfWeek, (dayActivity.get(dayOfWeek) || 0) + (row.content_time_mins || 0));
    }

    const sortedDays = Array.from(dayActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, recommendedPostsPerWeek)
      .map(([day]) => DAY_NAMES[day]);

    // Find optimal hours (hours with most productive activity)
    const hourActivity: Map<number, number> = new Map();
    for (const row of rows) {
      if (row.first_activity_at) {
        const hour = new Date(row.first_activity_at).getHours();
        hourActivity.set(hour, (hourActivity.get(hour) || 0) + (row.content_time_mins || 0));
      }
    }

    const optimalHours = Array.from(hourActivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour)
      .sort((a, b) => a - b);

    // Build productive windows
    const productiveWindows: ProductiveWindow[] = [];
    for (const row of rows) {
      if (row.first_activity_at && row.last_activity_at) {
        const date = new Date(row.date);
        const dayOfWeek = (date.getDay() + 6) % 7;
        const firstHour = new Date(row.first_activity_at).getHours();
        const lastHour = new Date(row.last_activity_at).getHours();
        const totalMins =
          (row.content_time_mins || 0) +
          (row.engagement_time_mins || 0) +
          (row.management_time_mins || 0);
        const maxPossibleMins = (lastHour - firstHour + 1) * 60;
        const energyScore = maxPossibleMins > 0 ? Math.min(1, totalMins / maxPossibleMins) : 0;

        if (energyScore > 0.5) {
          productiveWindows.push({
            day: DAY_NAMES[dayOfWeek],
            start: `${String(firstHour).padStart(2, '0')}:00`,
            end: `${String(Math.min(23, lastHour + 1)).padStart(2, '0')}:00`,
            energy_score: Math.round(energyScore * 10) / 10,
          });
        }
      }
    }

    // De-duplicate windows by day (keep highest energy)
    const bestWindows: Map<DayOfWeek, ProductiveWindow> = new Map();
    for (const w of productiveWindows) {
      const existing = bestWindows.get(w.day);
      if (!existing || w.energy_score > existing.energy_score) {
        bestWindows.set(w.day, w);
      }
    }

    // Get buffer depth
    const buffer = await this.getBufferDepth(creatorId);

    return {
      recommended_posts_per_week: recommendedPostsPerWeek,
      current_posts_per_week: currentPostsPerWeek,
      optimal_days: sortedDays as DayOfWeek[],
      optimal_hours: optimalHours,
      productive_windows: Array.from(bestWindows.values()),
      content_buffer_days: buffer.buffer_days,
      buffer_threshold: buffer.threshold,
      buffer_status: buffer.status,
    };
  }

  async getBufferDepth(creatorId: string): Promise<BufferDepth> {
    // Query scheduled/future content to determine buffer depth
    // For now, this checks creator_work_patterns for future-dated content
    const now = new Date();
    const { data: futureContent } = await this.db
      .from('creator_work_patterns')
      .select('date, post_count')
      .eq('creator_id', creatorId)
      .gt('date', now.toISOString().split('T')[0])
      .order('date', { ascending: true });

    const scheduled = futureContent || [];
    const scheduledPosts = scheduled.reduce(
      (s: number, r: { post_count?: number }) => s + (r.post_count || 0),
      0
    );

    // Buffer days = number of distinct future dates with posts
    const bufferDays = scheduled.filter(
      (r: { post_count?: number }) => r.post_count && r.post_count > 0
    ).length;
    const threshold = 5;

    const status: BufferStatus = bufferDays >= threshold ? 'above_threshold' : 'below_threshold';

    return {
      buffer_days: bufferDays,
      scheduled_posts: scheduledPosts,
      threshold,
      status,
      next_scheduled: scheduled.length > 0 ? `${scheduled[0].date}T10:00:00Z` : null,
      last_scheduled:
        scheduled.length > 0 ? `${scheduled[scheduled.length - 1].date}T14:00:00Z` : null,
    };
  }
}
