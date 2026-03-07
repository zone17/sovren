# Payment System Guide

**Epic 005 Backend Service Refactoring - Lightning Network Payments**

---

## Lightning Integration

### Invoice Generation

```typescript
export class LightningService {
  async createInvoice(amount: number, description: string): Promise<Invoice> {
    const response = await this.lnd.addInvoice({
      value: amount,
      memo: description,
      expiry: 3600, // 1 hour
    });

    return {
      paymentRequest: response.payment_request,
      paymentHash: response.payment_hash,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }
}
```

### Payment Verification

```typescript
export class PaymentService {
  async verifyPayment(paymentHash: string): Promise<boolean> {
    const invoice = await this.lightning.lookupInvoice(paymentHash);
    return invoice.state === 'SETTLED';
  }
}
```

---

## Subscription Management

### Creating Subscription

```typescript
export class SubscriptionService {
  async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    // 1. Create Lightning invoice
    const invoice = await this.lightning.createInvoice(data.amount, `Subscription: ${data.tier}`);

    // 2. Create subscription record
    const subscription = await this.repository.create({
      ...data,
      invoice: invoice.paymentRequest,
      paymentHash: invoice.paymentHash,
      status: 'pending',
      expiresAt: invoice.expiresAt,
    });

    // 3. Emit event
    await this.eventBus.emit('subscription.created', subscription);

    return subscription;
  }
}
```

### Auto-Renewal

```typescript
export class SubscriptionRenewalService {
  async processRenewals(): Promise<void> {
    const expiringSubscriptions = await this.repository.findExpiring(
      new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
    );

    for (const subscription of expiringSubscriptions) {
      await this.renewSubscription(subscription.id);
    }
  }

  private async renewSubscription(id: string): Promise<void> {
    const subscription = await this.repository.findById(id);

    // Create new invoice
    const invoice = await this.lightning.createInvoice(
      subscription.amount,
      `Renewal: ${subscription.tier}`
    );

    // Update subscription
    await this.repository.update(id, {
      invoice: invoice.paymentRequest,
      paymentHash: invoice.paymentHash,
      status: 'pending_renewal',
    });

    // Notify user
    await this.eventBus.emit('subscription.renewal_required', {
      subscriptionId: id,
      invoice: invoice.paymentRequest,
    });
  }
}
```

---

## Currency Conversion

### Multi-Currency Support

```typescript
export class CurrencyService {
  async convertToSats(amount: number, currency: string): Promise<number> {
    if (currency === 'BTC') return amount;

    const rate = await this.getExchangeRate(currency);
    return Math.round((amount / rate) * 100_000_000); // Convert to satoshis
  }

  async convertFromSats(sats: number, currency: string): Promise<number> {
    if (currency === 'BTC') return sats;

    const rate = await this.getExchangeRate(currency);
    return (sats / 100_000_000) * rate;
  }

  private async getExchangeRate(currency: string): Promise<number> {
    const cached = await this.cache.get(`rate:BTC:${currency}`);
    if (cached) return cached;

    const rate = await this.fetchExchangeRate(currency);
    await this.cache.set(`rate:BTC:${currency}`, rate, 300); // 5 min TTL

    return rate;
  }
}
```

---

## Webhook Handling

### HMAC Verification

```typescript
export class WebhookService {
  verifySignature(payload: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET!)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
```

---

**Next**: [Deployment Guide](/docs/development/deployment-guide.md)

**Last Updated**: 2025-10-27
