/**
 * Cross-Platform Analytics Service Interface
 * EPIC-009: Multi-Platform Hub
 */

import type { PlatformOverview, ContentComparison, PlatformROI } from '@shared/types/distribution';

export interface ICrossPlatformAnalyticsService {
  /** Get aggregate overview across all connected platforms */
  getOverview(creatorId: string): Promise<PlatformOverview>;

  /** Compare performance of same content across platforms */
  getContentComparison(creatorId: string, contentId: string): Promise<ContentComparison[]>;

  /** Get ROI (engagement per hour) per platform */
  getROI(creatorId: string): Promise<PlatformROI[]>;
}
