# Phase 5: Payment Services - CRITICAL PATH Implementation

## ⚠️ CRITICAL: Payment Services Require 100% Test Coverage

This phase involves financial transactions and MUST be implemented with extreme care, security audits, and 100% test coverage.

## Execution Order (STRICTLY SEQUENTIAL)

### STEP 1: InvoiceService (BLOCKING - Must Complete First)

#### US-E5-024: InvoiceService

**File**: `InvoiceService.ts`
**Coverage Required**: 100% (NOT 95%)
**Security**: MANDATORY audit before next service

```typescript
interface IInvoiceService {
  // Invoice lifecycle
  create(draft: InvoiceDraft): Promise<Invoice>;
  update(id: string, updates: Partial<Invoice>): Promise<Invoice>;
  finalize(id: string): Promise<Invoice>;
  void(id: string, reason: string): Promise<void>;

  // Financial calculations
  calculateSubtotal(items: InvoiceItem[]): Promise<Money>;
  calculateTax(amount: Money, jurisdiction: string): Promise<TaxCalculation>;
  calculateDiscounts(invoice: Invoice, discounts: Discount[]): Promise<Money>;
  prorate(subscription: Subscription, change: SubscriptionChange): Promise<ProrationResult>;

  // Document generation
  generatePDF(invoiceId: string): Promise<Buffer>;
  generateHTML(invoiceId: string): Promise<string>;

  // Delivery
  sendInvoice(invoiceId: string, recipient: string): Promise<void>;
  scheduleReminder(invoiceId: string, date: Date): Promise<void>;

  // Payment tracking
  recordPayment(invoiceId: string, payment: Payment): Promise<void>;
  recordPartialPayment(invoiceId: string, amount: Money): Promise<void>;
  markAsPaid(invoiceId: string): Promise<void>;

  // Queries
  getInvoice(id: string): Promise<Invoice>;
  getInvoicesByCustomer(customerId: string, options: QueryOptions): Promise<Invoice[]>;
  getOverdueInvoices(): Promise<Invoice[]>;
  getInvoiceMetrics(dateRange: DateRange): Promise<InvoiceMetrics>;
}
```

**Requirements**:

- Immutable invoice records after finalization
- Accurate tax calculation with jurisdiction support
- Proration to the second for subscriptions
- Audit trail for all modifications
- PDF generation with templates
- Multi-currency support
- Compliance with accounting standards

**Critical Tests**:

- Tax calculation accuracy
- Proration calculations
- Currency conversion
- Rounding rules
- Immutability after finalization
- Payment application
- Concurrency handling

---

### STEP 2: Core Payment Services (Parallel After InvoiceService)

#### US-E5-025: PaymentProcessingService

**File**: `PaymentProcessingService.ts`
**Coverage Required**: 100%

```typescript
interface IPaymentProcessingService {
  // Payment processing
  processPayment(payment: PaymentRequest): Promise<PaymentResult>;
  authorizePayment(amount: Money, method: PaymentMethod): Promise<Authorization>;
  capturePayment(authId: string): Promise<CaptureResult>;

  // Provider management
  initializeStripe(): Promise<void>;
  initializeLightning(): Promise<void>;
  getProviderStatus(provider: PaymentProvider): Promise<ProviderStatus>;

  // Payment methods
  addPaymentMethod(customerId: string, method: PaymentMethodData): Promise<PaymentMethod>;
  removePaymentMethod(methodId: string): Promise<void>;
  setDefaultPaymentMethod(customerId: string, methodId: string): Promise<void>;

  // Security & compliance
  validateCard(cardData: CardData): Promise<ValidationResult>;
  tokenizeCard(cardData: CardData): Promise<Token>;
  verify3DS(paymentId: string): Promise<ThreeDSResult>;

  // Idempotency
  processIdempotent(idempotencyKey: string, payment: PaymentRequest): Promise<PaymentResult>;
}
```

**Requirements**:

- PCI DSS compliance
- Idempotent payment processing
- Multi-provider support (Stripe, Lightning)
- Retry logic with exponential backoff
- Webhook signature verification
- Rate limiting per customer
- Fraud detection integration

#### US-E5-030: CurrencyService

**File**: `CurrencyService.ts`
**Coverage Required**: 95%

```typescript
interface ICurrencyService {
  // Exchange rates
  getExchangeRate(from: Currency, to: Currency): Promise<number>;
  convertAmount(amount: Money, toCurrency: Currency): Promise<Money>;
  getHistoricalRate(from: Currency, to: Currency, date: Date): Promise<number>;

  // Formatting
  formatMoney(amount: Money, locale?: string): string;
  parseMoney(input: string, currency: Currency): Money;

  // Bitcoin/Lightning specific
  satoshisToBTC(sats: bigint): string;
  btcToSatoshis(btc: string): bigint;
  generateLightningInvoice(amount: Money, memo: string): Promise<string>;
}
```

---

### STEP 3: SubscriptionService (After Payment Processing)

#### US-E5-026: SubscriptionService

**File**: `SubscriptionService.ts`
**Coverage Required**: 100%

```typescript
interface ISubscriptionService {
  // Lifecycle management
  create(subscription: SubscriptionDraft): Promise<Subscription>;
  activate(subscriptionId: string): Promise<void>;
  pause(subscriptionId: string, until?: Date): Promise<void>;
  resume(subscriptionId: string): Promise<void>;
  cancel(subscriptionId: string, immediately?: boolean): Promise<void>;

  // Plan changes
  changePlan(subscriptionId: string, newPlanId: string): Promise<ChangeResult>;
  addAddon(subscriptionId: string, addonId: string): Promise<void>;
  removeAddon(subscriptionId: string, addonId: string): Promise<void>;

  // Billing
  processRenewal(subscriptionId: string): Promise<RenewalResult>;
  handleFailedPayment(subscriptionId: string): Promise<DunningResult>;
  applyCredit(subscriptionId: string, credit: Credit): Promise<void>;

  // Trial management
  startTrial(subscriptionId: string, days: number): Promise<void>;
  endTrial(subscriptionId: string): Promise<void>;
  convertTrial(subscriptionId: string): Promise<void>;

  // Queries
  getActiveSubscriptions(customerId: string): Promise<Subscription[]>;
  getUpcomingRenewals(days: number): Promise<Subscription[]>;
  getChurnedSubscriptions(dateRange: DateRange): Promise<Subscription[]>;
}
```

**Requirements**:

- Accurate billing cycles
- Proration on plan changes
- Dunning management (retry failed payments)
- Grace periods
- Trial conversion tracking
- Webhook integration for renewals
- Grandfathering old plans

---

### STEP 4: RefundService (After SubscriptionService)

#### US-E5-027: RefundService

**File**: `RefundService.ts`
**Coverage Required**: 100%

```typescript
interface IRefundService {
  // Refund processing
  createRefund(request: RefundRequest): Promise<Refund>;
  processRefund(refundId: string): Promise<RefundResult>;
  approveRefund(refundId: string, approverId: string): Promise<void>;
  rejectRefund(refundId: string, reason: string): Promise<void>;

  // Partial refunds
  calculatePartialRefund(invoice: Invoice, amount: Money): Promise<RefundCalculation>;
  applyPartialRefund(invoiceId: string, amount: Money): Promise<Refund>;

  // Provider integration
  refundStripePayment(paymentId: string, amount?: Money): Promise<StripeRefund>;
  refundLightningPayment(paymentHash: string): Promise<LightningRefund>;

  // Audit & compliance
  getRefundHistory(customerId: string): Promise<Refund[]>;
  getRefundMetrics(dateRange: DateRange): Promise<RefundMetrics>;
  exportRefundReport(dateRange: DateRange): Promise<RefundReport>;
}
```

**Requirements**:

- Approval workflow for large refunds (>$500)
- Partial refund support
- Provider-specific refund logic
- Audit trail with reasons
- Automatic subscription cancellation option
- Fraud prevention checks
- Accounting integration

---

### STEP 5: Supporting Services (Parallel)

#### US-E5-028: PaymentAnalyticsService

**File**: `PaymentAnalyticsService.ts`
**Coverage Required**: 95%

```typescript
interface IPaymentAnalyticsService {
  // Revenue metrics
  calculateMRR(): Promise<Money>;
  calculateARR(): Promise<Money>;
  calculateLTV(customerId: string): Promise<Money>;

  // Growth metrics
  getGrowthRate(period: Period): Promise<number>;
  getChurnRate(period: Period): Promise<number>;
  getRetentionCurve(cohort: string): Promise<RetentionData>;

  // Payment performance
  getPaymentSuccessRate(dateRange: DateRange): Promise<number>;
  getAveragePaymentTime(): Promise<Duration>;
  getFailureReasons(dateRange: DateRange): Promise<FailureAnalysis>;

  // Forecasting
  forecastRevenue(months: number): Promise<RevenueForecast>;
  predictChurn(customerId: string): Promise<ChurnProbability>;
}
```

#### US-E5-029: WebhookService

**File**: `WebhookService.ts`
**Coverage Required**: 100%

```typescript
interface IWebhookService {
  // Webhook handling
  handleStripeWebhook(payload: string, signature: string): Promise<void>;
  handleLightningWebhook(payload: string): Promise<void>;

  // Verification
  verifySignature(payload: string, signature: string, secret: string): boolean;
  validateTimestamp(timestamp: number): boolean;

  // Processing
  processWebhookEvent(event: WebhookEvent): Promise<void>;
  retryFailedWebhook(webhookId: string): Promise<void>;

  // Queue management
  addToQueue(event: WebhookEvent): Promise<void>;
  processQueue(): Promise<void>;
  moveToDeadLetter(webhookId: string): Promise<void>;
}
```

---

### STEP 6: Integration Testing (Final)

#### US-E5-031: Payment Integration Testing

**File**: `PaymentIntegrationTests.ts`
**Coverage Required**: 100%

**Test Scenarios**:

1. Complete payment flow (invoice → payment → receipt)
2. Subscription lifecycle (create → renew → cancel)
3. Refund processing (full and partial)
4. Failed payment recovery
5. Plan changes with proration
6. Multi-currency transactions
7. Webhook processing
8. Concurrent payment handling
9. Provider failover
10. Security penetration testing

---

## Implementation Requirements

### Security Requirements (MANDATORY)

1. **Data Protection**
   - Encrypt sensitive data at rest
   - Use TLS for all external communications
   - Never log full card numbers or CVV
   - Token-based card storage

2. **PCI DSS Compliance**
   - Minimize cardholder data exposure
   - Use provider tokenization
   - Regular security scans
   - Audit logging for all operations

3. **Idempotency**
   - All payment operations must be idempotent
   - Use idempotency keys with 24-hour TTL
   - Prevent duplicate charges

4. **Rate Limiting**
   - Per-customer limits
   - Fraud detection triggers
   - Webhook delivery throttling

### Database Schema

```sql
-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES users(id),
  status ENUM('draft', 'sent', 'paid', 'overdue', 'void'),
  currency VARCHAR(3) NOT NULL,
  subtotal DECIMAL(19,4) NOT NULL,
  tax DECIMAL(19,4) NOT NULL DEFAULT 0,
  total DECIMAL(19,4) NOT NULL,
  due_date DATE,
  paid_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  finalized_at TIMESTAMP,
  CHECK (total >= 0)
);

-- Invoice items
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(19,4) NOT NULL,
  unit_price DECIMAL(19,4) NOT NULL,
  total DECIMAL(19,4) NOT NULL,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  metadata JSONB
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id),
  amount DECIMAL(19,4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status ENUM('pending', 'processing', 'succeeded', 'failed'),
  provider ENUM('stripe', 'lightning', 'paypal'),
  provider_id VARCHAR(255),
  method_type VARCHAR(50),
  idempotency_key VARCHAR(255) UNIQUE,
  failure_reason TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES users(id),
  plan_id UUID REFERENCES plans(id),
  status ENUM('trialing', 'active', 'past_due', 'canceled', 'paused'),
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_end TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Refunds
CREATE TABLE refunds (
  id UUID PRIMARY KEY,
  payment_id UUID REFERENCES payments(id),
  amount DECIMAL(19,4) NOT NULL,
  reason TEXT,
  status ENUM('pending', 'approved', 'processing', 'completed', 'failed'),
  approved_by UUID REFERENCES users(id),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Testing Strategy

#### Unit Tests (100% Required)

```typescript
describe('InvoiceService', () => {
  describe('Financial Calculations', () => {
    it('should calculate tax correctly for all jurisdictions');
    it('should handle multiple tax rates');
    it('should round correctly to 4 decimal places');
    it('should prorate to the second');
    it('should handle currency conversion');
  });

  describe('Immutability', () => {
    it('should prevent updates after finalization');
    it('should create audit log for all changes');
    it('should maintain version history');
  });

  describe('Concurrency', () => {
    it('should handle concurrent payment applications');
    it('should prevent double-payment');
    it('should maintain consistency under load');
  });
});
```

#### Integration Tests

- Test with real Stripe test mode
- Test Lightning Network on testnet
- Verify webhook processing
- Test failure scenarios
- Load test payment processing

#### Security Tests

- SQL injection attempts
- XSS in invoice descriptions
- Rate limiting enforcement
- Token validation
- Signature verification

### Feature Flags

All payment services MUST be behind feature flags:

```typescript
const FEATURE_FLAGS = {
  PAYMENTS_ENABLED: false,
  STRIPE_ENABLED: false,
  LIGHTNING_ENABLED: false,
  SUBSCRIPTIONS_ENABLED: false,
  REFUNDS_ENABLED: false,
  AUTO_DUNNING: false,
};
```

### Rollback Procedures

Each service must have documented rollback:

1. **Database Rollback**

   ```sql
   -- Down migration for each service
   DROP TABLE IF EXISTS table_name CASCADE;
   ```

2. **Code Rollback**
   - Git revert commits
   - Feature flag disable
   - Provider webhook disable

3. **Data Recovery**
   - Backup before deployment
   - Point-in-time recovery
   - Transaction replay capability

## Quality Gates (MANDATORY)

### Per-Service Requirements

- ✅ 100% test coverage (payment services)
- ✅ Security audit passed
- ✅ PCI DSS compliance verified
- ✅ Idempotency tested
- ✅ Load testing completed
- ✅ Rollback procedure tested
- ✅ Feature flags configured
- ✅ Documentation complete

### Phase Completion Criteria

- All 8 services implemented
- 100% test coverage average
- Zero security vulnerabilities
- Performance benchmarks met:
  - Payment processing < 3s
  - Invoice generation < 500ms
  - Webhook processing < 1s
- Compliance verified
- Disaster recovery tested

## Execution Timeline

### Critical Path Schedule

1. **Hour 1-2**: InvoiceService (BLOCKING)
2. **Hour 3-4**: PaymentProcessingService + CurrencyService
3. **Hour 5**: SubscriptionService
4. **Hour 6**: RefundService
5. **Hour 7**: Analytics + Webhook Services
6. **Hour 8**: Integration Testing

**Total Duration**: 8 hours (sequential, no shortcuts)

## Risk Mitigation

### High-Risk Areas

1. **Payment Processing**: Double-charge prevention
2. **Refunds**: Approval workflow critical
3. **Subscriptions**: Billing cycle accuracy
4. **Currency**: Exchange rate precision
5. **Webhooks**: Replay attack prevention

### Mitigation Strategies

- Mandatory code review by 2 engineers
- Staging environment testing
- Progressive rollout (1% → 10% → 50% → 100%)
- Real-time monitoring and alerts
- Automatic rollback on error spike

## Success Metrics

- Zero payment errors in production
- 100% webhook delivery rate
- <0.1% payment failure rate
- Zero security incidents
- Full compliance audit pass
- All integration tests passing

---

## ⚠️ FINAL CHECKLIST

Before ANY payment service goes live:

- [ ] 100% test coverage verified
- [ ] Security audit completed
- [ ] PCI compliance checked
- [ ] Load testing performed
- [ ] Rollback tested
- [ ] Documentation reviewed
- [ ] Legal/compliance approval
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] On-call rotation established

**NEVER COMPROMISE ON PAYMENT SECURITY OR TESTING**

---

**Phase Start**: ${new Date().toISOString()}
**Critical Path Duration**: 8 hours minimum
**Quality Standard**: MAXIMUM (100/100)
**Risk Level**: CRITICAL
**Required Approvals**: Engineering Lead, Security, Legal
