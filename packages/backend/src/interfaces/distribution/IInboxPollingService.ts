/**
 * Inbox Polling Service Interface
 * EPIC-009B: Unified Inbox — BullMQ batch polling
 */

export interface IInboxPollingService {
  /** Start batch polling schedulers for all platforms */
  startPolling(): Promise<void>;

  /** Stop all polling schedulers */
  stopPolling(): Promise<void>;

  /** Update poll interval for a creator-platform pair based on session activity */
  updatePollInterval(creatorId: string, platform: string, active: boolean): Promise<void>;

  /** Manually trigger a poll for a specific creator-platform */
  pollNow(creatorId: string, platform: string): Promise<void>;
}
