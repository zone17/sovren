# ADR-005: Lightning Network for Payments

**Date**: 2025-10-27
**Status**: Accepted
**Epic**: Epic 005 - Backend Service Refactoring
**Related ADRs**: [ADR-015 (Idempotency Keys)](./ADR-015-idempotency-keys.md), [ADR-014 (Circuit Breaker)](./ADR-014-circuit-breaker-pattern.md)

## Context

Sovren is a creator monetization platform requiring fast, low-cost payments. Traditional payment methods present significant challenges:

- **High Fees**: Credit cards charge 2.9% + $0.30 per transaction (prohibitive for micro-payments)
- **Slow Settlements**: 2-7 business days for creator payouts
- **Geographic Restrictions**: Many creators in underbanked regions excluded
- **Chargebacks**: Fraudulent chargebacks cost creators revenue and time
- **Minimum Amounts**: Can't support micro-payments (<$1) economically
- **KYC/AML Overhead**: Complex compliance requirements

**Use Case Requirements**:
- Support payments from $0.01 to $10,000
- Instant settlement to creators (seconds, not days)
- Global accessibility without geographic restrictions
- Minimal fees (<1% ideally)
- No chargebacks or payment reversals
- Simple integration for developers

## Decision

We will use **Bitcoin Lightning Network** as the primary payment rail for all creator monetization.

**Key Specifications**:
- **BOLT11 Invoices**: Standard invoice format for payments
- **WebLN Integration**: Browser extension support for seamless UX
- **Multi-Node Support**: Connect to multiple Lightning nodes for redundancy
- **Payment Verification**: Cryptographic proof of payment
- **Instant Settlement**: Creators receive funds within seconds

**Implementation**:
```typescript
@injectable()
class LightningService implements ILightningService {
  constructor(
    @inject(TYPES.LndClient) private lnd: LndClient,
    @inject(TYPES.CacheService) private cache: ICacheService,
    @inject(TYPES.EventBus) private eventBus: IEventBus
  ) {}

  async createInvoice(params: InvoiceParams): Promise<Invoice> {
    // Generate BOLT11 invoice
    const invoice = await this.lnd.addInvoice({
      value: params.amountSats,
      memo: `Sovren: ${params.description}`,
      expiry: params.expirySeconds || 3600, // 1 hour default
    });

    const invoiceData = {
      id: invoice.payment_hash,
      bolt11: invoice.payment_request,
      amountSats: params.amountSats,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (params.expirySeconds || 3600) * 1000),
    };

    // Cache for quick lookup
    await this.cache.set(
      `invoice:${invoice.payment_hash}`,
      invoiceData,
      CACHE_TTL.lightning_invoice
    );

    return invoiceData;
  }

  async checkPaymentStatus(paymentHash: string): Promise<PaymentStatus> {
    // Check cache first
    const cached = await this.cache.get<Invoice>(`invoice:${paymentHash}`);
    if (cached?.status === 'paid') return 'paid';

    // Query Lightning node
    const invoice = await this.lnd.lookupInvoice({ r_hash: paymentHash });

    if (invoice.state === 'SETTLED') {
      // Payment received!
      await this.handlePaymentReceived(invoice);
      return 'paid';
    }

    return invoice.state === 'CANCELED' ? 'expired' : 'pending';
  }

  private async handlePaymentReceived(invoice: LndInvoice) {
    // Update cache
    await this.cache.set(`invoice:${invoice.r_hash}`, {
      status: 'paid',
      paidAt: new Date(),
    }, CACHE_TTL.lightning_invoice);

    // Emit event for other services
    await this.eventBus.publish({
      type: 'payment.completed',
      payload: {
        paymentHash: invoice.r_hash,
        amountSats: invoice.value,
        settleDate: new Date(),
      },
    });
  }

  // WebLN browser support
  async sendPayment(bolt11: string): Promise<PaymentResult> {
    if (window.webln) {
      await window.webln.enable();
      const result = await window.webln.sendPayment(bolt11);
      return result;
    }

    throw new Error('WebLN not available');
  }
}
```

**Payment Flow**:
```
1. User purchases content → createInvoice(100 sats)
2. Display BOLT11 invoice + QR code
3. User pays with Lightning wallet
4. LND receives payment → webhook notification
5. checkPaymentStatus confirms payment
6. Emit 'payment.completed' event
7. Content unlocked automatically
```

## Consequences

### Positive

1. **Instant Settlements**: Creators receive funds in seconds
   - No 2-7 day wait for payouts
   - Immediate access to earnings
   - Better cash flow for creators

2. **Minimal Fees**: ~0.1% fee vs 2.9% for credit cards
   - $0.10 payment costs ~$0.0001 in Lightning fees
   - Creators keep 99.9% of revenue
   - Enables micro-payments economically

3. **Global Access**: No geographic restrictions
   - Anyone with internet can send/receive
   - No need for US bank account
   - Supports underbanked creators worldwide

4. **No Chargebacks**: Payments are final and irreversible
   - Creators protected from fraudulent chargebacks
   - No payment reversals
   - Simplified accounting

5. **Privacy-Preserving**: No KYC required for small amounts
   - Users don't need to provide credit card info
   - Lightning doesn't expose personal data
   - Pseudonymous payments

6. **Open Protocol**: Not controlled by any company
   - Censorship-resistant payments
   - Can't be shut down by payment processor
   - Aligns with NOSTR decentralization philosophy

### Negative

1. **Volatility**: Bitcoin price fluctuates
   - Mitigation: Instant conversion to stablecoins if desired
   - Display amounts in sats + fiat equivalent
   - Educate creators on volatility management

2. **Learning Curve**: Users need Lightning wallet
   - Mitigation: Clear onboarding tutorials
   - WebLN for seamless browser payments
   - Support for popular wallets (Alby, Wallet of Satoshi, Phoenix)

3. **Liquidity Management**: Need to maintain Lightning channels
   - Requires initial capital in channels
   - Channel rebalancing needed
   - Mitigation: Use Lightning Service Providers (LSPs)

4. **Regulatory Uncertainty**: Bitcoin regulations evolving
   - Some jurisdictions restrict cryptocurrency
   - Mitigation: Provide fiat on-ramp partners for compliant regions
   - Monitor regulatory developments

5. **Network Limitations**: Lightning has routing limits
   - Large payments (>$1000) may fail
   - Mitigation: Support on-chain Bitcoin for large amounts
   - Most creator payments <$100 (well within limits)

## Alternatives Considered

### 1. Traditional Credit Card Processing (Stripe)
**Pros**:
- Familiar to users
- Wide acceptance
- Fiat currency (no volatility)

**Cons**:
- 2.9% + $0.30 fees
- 7-day payouts to creators
- Chargebacks (6-month window)
- KYC requirements
- Geographic restrictions

**Why Rejected**: Fees too high for creator economy. Slow settlements hurt creators.

### 2. On-Chain Bitcoin
**Pros**:
- More mature than Lightning
- Higher transaction limits
- No channel management

**Cons**:
- High fees ($2-10 per transaction)
- Slow confirmations (10-60 minutes)
- Not suitable for micro-payments
- Doesn't scale to high transaction volume

**Why Rejected**: Too slow and expensive for daily creator payments. Lightning solves these issues.

### 3. Ethereum/Stablecoins (USDC on Polygon)
**Pros**:
- Stablecoin (no volatility)
- Programmable payments (smart contracts)
- Fast transactions

**Cons**:
- Still requires gas fees
- More complex setup
- Ethereum wallet needed
- Less aligned with Bitcoin/NOSTR philosophy

**Why Rejected**: Lightning provides better UX and lower fees. Bitcoin aligns with NOSTR community values.

### 4. PayPal / Venmo
**Pros**:
- Very familiar to users
- Easy integration
- Fiat currency

**Cons**:
- High fees (similar to credit cards)
- Account freezes common for crypto-related business
- Limited international support
- Centralized control

**Why Rejected**: History of freezing accounts related to crypto/content. Not censorship-resistant.

## Implementation Notes

**Invoice Expiry Strategy**:
```typescript
const INVOICE_EXPIRY = {
  content_purchase: 1 * 60 * 60,      // 1 hour
  subscription_monthly: 24 * 60 * 60, // 24 hours
  tip_creator: 30 * 60,               // 30 minutes
};
```

**Multi-Node Redundancy**:
```typescript
class LightningService {
  private nodes = [
    { client: lnd1, priority: 1 },
    { client: lnd2, priority: 2 },
  ];

  async createInvoice(params: InvoiceParams) {
    for (const node of this.nodes) {
      try {
        return await node.client.addInvoice(params);
      } catch (error) {
        this.logger.warn(`Node ${node.priority} failed, trying next`);
      }
    }
    throw new Error('All Lightning nodes unavailable');
  }
}
```

**Webhook Verification**:
```typescript
// Verify LND webhook authenticity
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
```

## Related Documentation

- [Lightning Integration Guide](/docs/features/lightning-integration.md)
- [Payment Flow Diagram](/docs/architecture/diagrams/epic-005-payment-flow.mmd)
- [Creator Payout Guide](/docs/user-guides/creator-payouts.md)
- [WebLN Integration](/docs/api/webln-integration.md)

## Revision History

- **2025-10-27**: Initial decision documented for Epic 005
