/**
 * Shared fire-and-forget domain event emission helper (#708).
 * Extracted from CreatorCircleService, MentorshipService, FollowService, NotificationPersistenceService.
 */

import type { IEventBus } from '../interfaces/shared/IEventBus';
import type { ILogger } from '../interfaces/shared/ILogger';
import type { DomainEventType } from '../interfaces/shared/IEventBus';
import crypto from 'crypto';

/**
 * Emit a domain event in a fire-and-forget manner.
 * Errors are logged but never propagated — notification failures must NOT block the main operation.
 */
export function emitDomainEvent(
  eventBus: IEventBus,
  logger: ILogger,
  type: DomainEventType,
  aggregateId: string,
  aggregateType: string,
  payload: Record<string, unknown>,
  source: string
): void {
  void eventBus
    .publish({
      id: `evt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
      type,
      aggregateId,
      aggregateType,
      payload,
      metadata: {
        timestamp: new Date(),
        version: '1.0.0',
        source,
      },
    })
    .catch((err) => {
      logger.error(`${source}: event emission failed (non-blocking)`, {
        err,
        type,
        aggregateId,
      });
    });
}
