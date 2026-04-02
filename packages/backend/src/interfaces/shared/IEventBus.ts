/**
 * Event Bus Interface
 * Central event-driven communication system
 * Part of Epic 005 - Backend Service Refactoring
 */

import crypto from 'crypto';

export enum DomainEventType {
  // Payment Events
  PAYMENT_RECEIVED = 'payment.received',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  INVOICE_CREATED = 'invoice.created',
  INVOICE_EXPIRED = 'invoice.expired',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  SUBSCRIPTION_TRIAL_STARTED = 'subscription.trial_started',
  SUBSCRIPTION_TRIAL_ENDING = 'subscription.trial_ending',
  SUBSCRIPTION_TRIAL_ENDED = 'subscription.trial_ended',
  SUBSCRIPTION_ACTIVATED = 'subscription.activated',
  SUBSCRIPTION_PAYMENT_FAILED = 'subscription.payment_failed',
  SUBSCRIPTION_GRACE_PERIOD_STARTED = 'subscription.grace_period_started',
  SUBSCRIPTION_UPGRADED = 'subscription.upgraded',
  SUBSCRIPTION_DOWNGRADED = 'subscription.downgraded',
  SUBSCRIPTION_DOWNGRADE_SCHEDULED = 'subscription.downgrade_scheduled',
  SUBSCRIPTION_PLAN_CHANGED = 'subscription.plan_changed',
  SUBSCRIPTION_PAUSED = 'subscription.paused',
  SUBSCRIPTION_RESUMED = 'subscription.resumed',
  SUBSCRIPTION_CANCELED = 'subscription.canceled',
  SUBSCRIPTION_CANCELLATION_SCHEDULED = 'subscription.cancellation_scheduled',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',
  SUBSCRIPTION_PAYMENT_METHOD_UPDATED = 'subscription.payment_method_updated',

  // Refund Events
  REFUND_INITIATED = 'refund.initiated',
  REFUND_AUTHORIZED = 'refund.authorized',
  REFUND_DENIED = 'refund.denied',
  REFUND_COMPLETED = 'refund.completed',
  REFUND_FAILED = 'refund.failed',
  REFUND_CANCELED = 'refund.canceled',
  REFUND_REVERSED = 'refund.reversed',

  // Content Events
  CONTENT_CREATED = 'content.created',
  CONTENT_PUBLISHED = 'content.published',
  CONTENT_UPDATED = 'content.updated',
  CONTENT_DELETED = 'content.deleted',
  CONTENT_MONETIZED = 'content.monetized',
  CONTENT_VIEWED = 'content.viewed',

  // User Events
  USER_REGISTERED = 'user.registered',
  USER_VERIFIED = 'user.verified',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_LOGGED_IN = 'user.logged_in',
  USER_LOGGED_OUT = 'user.logged_out',

  // Analytics Events
  METRIC_THRESHOLD_REACHED = 'metric.threshold.reached',
  ANOMALY_DETECTED = 'anomaly.detected',
  REPORT_GENERATED = 'report.generated',

  // System Events
  SERVICE_STARTED = 'service.started',
  SERVICE_STOPPED = 'service.stopped',
  SERVICE_ERROR = 'service.error',
  SERVICE_HEALTHY = 'service.healthy',
  SERVICE_UNHEALTHY = 'service.unhealthy',

  // Community / Creator Network Events (Slice 8)
  COMMUNITY_USER_FOLLOWED = 'community.user.followed',
  COMMUNITY_COMMENT_CREATED = 'community.comment.created',
  COMMUNITY_MENTORSHIP_REQUESTED = 'community.mentorship.requested',
  COMMUNITY_MENTORSHIP_ACCEPTED = 'community.mentorship.accepted',
  COMMUNITY_MENTORSHIP_DECLINED = 'community.mentorship.declined',
  COMMUNITY_CIRCLE_JOINED = 'community.circle.joined',
  COMMUNITY_CIRCLE_POST_CREATED = 'community.circle.post.created',
}

export interface EventMetadata {
  userId?: string;
  timestamp: Date;
  version: string;
  correlationId?: string;
  causationId?: string;
  source: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DomainEvent<T = any> {
  id: string;
  type: DomainEventType;
  aggregateId: string;
  aggregateType: string;
  payload: T;
  metadata: EventMetadata;
}

export type EventHandler<T = any> = (event: DomainEvent<T>) => void | Promise<void>;

export interface EventFilter {
  types?: DomainEventType[];
  aggregateTypes?: string[];
  userId?: string;
  after?: Date;
  before?: Date;
}

export interface EventSubscription {
  id: string;
  eventTypes: DomainEventType[];
  handler: EventHandler;
  filter?: EventFilter;
  createdAt: Date;
}

export interface EventReplayOptions {
  from: Date;
  to: Date;
  filter?: EventFilter;
  batchSize?: number;
  delayMs?: number;
}

/**
 * Event Bus for decoupled service communication
 * Implements publish-subscribe pattern with event replay
 */
export interface IEventBus {
  // Publishing
  publish<T = any>(event: DomainEvent<T>): Promise<void>;
  publishBatch<T = any>(events: DomainEvent<T>[]): Promise<void>;

  /**
   * Alias for publish — used by notification and content services.
   * Accepts a string event name + payload for simpler event dispatch.
   */
  emit(event: string, data?: unknown): Promise<void>;

  // Subscribing
  subscribe(eventType: DomainEventType, handler: EventHandler): string;
  subscribeToMany(eventTypes: DomainEventType[], handler: EventHandler): string;
  subscribeToAll(handler: EventHandler): string;
  subscribeWithFilter(filter: EventFilter, handler: EventHandler): string;
  unsubscribe(subscriptionId: string): void;
  unsubscribeAll(): void;

  // Event Query
  getEvent(eventId: string): Promise<DomainEvent | null>;
  queryEvents(filter: EventFilter, limit?: number, offset?: number): Promise<DomainEvent[]>;

  // Replay
  replayEvents(options: EventReplayOptions): Promise<DomainEvent[]>;
  replayEventsToHandler(options: EventReplayOptions, handler: EventHandler): Promise<void>;

  // Management
  getActiveSubscriptions(): EventSubscription[];
  getEventStats(): Promise<{ [key in DomainEventType]?: number }>;
  clearEventStore(): Promise<void>;

  // Health
  isHealthy(): Promise<boolean>;
  dispose(): Promise<void>;
}

/**
 * Event builder helper for consistent event creation
 */
export class DomainEventBuilder<T = any> {
  private event: Partial<DomainEvent<T>> = {
    id: this.generateId(),
    metadata: {
      timestamp: new Date(),
      version: '1.0.0',
      source: 'unknown',
    },
  };

  private generateId(): string {
    return `evt_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
  }

  withType(type: DomainEventType): this {
    this.event.type = type;
    return this;
  }

  withAggregateId(id: string): this {
    this.event.aggregateId = id;
    return this;
  }

  withAggregateType(type: string): this {
    this.event.aggregateType = type;
    return this;
  }

  withPayload(payload: T): this {
    this.event.payload = payload;
    return this;
  }

  withUserId(userId: string): this {
    if (!this.event.metadata) {
      this.event.metadata = {} as EventMetadata;
    }
    this.event.metadata.userId = userId;
    return this;
  }

  withCorrelationId(correlationId: string): this {
    if (!this.event.metadata) {
      this.event.metadata = {} as EventMetadata;
    }
    this.event.metadata.correlationId = correlationId;
    return this;
  }

  withSource(source: string): this {
    if (!this.event.metadata) {
      this.event.metadata = {} as EventMetadata;
    }
    this.event.metadata.source = source;
    return this;
  }

  build(): DomainEvent<T> {
    if (!this.event.type || !this.event.aggregateId || !this.event.aggregateType) {
      throw new Error('DomainEvent requires type, aggregateId, and aggregateType');
    }
    return this.event as DomainEvent<T>;
  }
}
