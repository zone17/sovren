# Event Bus Guide

**Epic 005 Backend Service Refactoring - Event-Driven Architecture**

---

## Event Types

### Domain Events

```typescript
// packages/backend/src/types/events.ts

export interface DomainEvent {
  type: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Payment Events
export interface PaymentCreatedEvent extends DomainEvent {
  type: 'payment.created';
  paymentId: string;
  userId: string;
  amount: number;
}

export interface PaymentCompletedEvent extends DomainEvent {
  type: 'payment.completed';
  paymentId: string;
  preimage: string;
}

// Subscription Events
export interface SubscriptionCreatedEvent extends DomainEvent {
  type: 'subscription.created';
  subscriptionId: string;
  userId: string;
  creatorId: string;
}

export interface SubscriptionRenewedEvent extends DomainEvent {
  type: 'subscription.renewed';
  subscriptionId: string;
  expiresAt: Date;
}
```

---

## Publishing Events

### Emit Pattern

```typescript
export class PaymentService {
  async createPayment(data: CreatePaymentData): Promise<Payment> {
    const payment = await this.repository.create(data);

    // Emit event after successful operation
    await this.eventBus.emit('payment.created', {
      type: 'payment.created',
      paymentId: payment.id,
      userId: payment.userId,
      amount: payment.amount,
      timestamp: new Date()
    });

    return payment;
  }

  async completePayment(id: string, preimage: string): Promise<void> {
    await this.repository.update(id, {
      status: 'completed',
      preimage
    });

    await this.eventBus.emit('payment.completed', {
      type: 'payment.completed',
      paymentId: id,
      preimage,
      timestamp: new Date()
    });
  }
}
```

---

## Subscribing to Events

### Event Handlers

```typescript
export class NotificationService {
  async initialize(): Promise<void> {
    // Subscribe to payment events
    this.eventBus.on('payment.created', this.handlePaymentCreated.bind(this));
    this.eventBus.on('payment.completed', this.handlePaymentCompleted.bind(this));

    // Subscribe to subscription events
    this.eventBus.on('subscription.created', this.handleSubscriptionCreated.bind(this));
  }

  private async handlePaymentCreated(event: PaymentCreatedEvent): Promise<void> {
    await this.sendEmail({
      to: event.userId,
      subject: 'Payment Created',
      template: 'payment-created',
      data: event
    });
  }

  private async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    await this.sendEmail({
      to: event.userId,
      subject: 'Payment Successful',
      template: 'payment-completed',
      data: event
    });
  }
}
```

---

## Error Handling

### Failed Event Handlers

```typescript
export class EventBusService implements IEventBus {
  async emit(eventType: string, payload: any): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];

    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (error) {
        this.logger.error('Event handler failed', {
          eventType,
          error: error.message,
          payload
        });

        // Optional: Dead letter queue
        await this.deadLetterQueue.add({
          eventType,
          payload,
          error: error.message,
          timestamp: new Date()
        });
      }
    }
  }
}
```

---

**Next**: [Caching Guide](/docs/development/caching-guide.md)

**Last Updated**: 2025-10-27
