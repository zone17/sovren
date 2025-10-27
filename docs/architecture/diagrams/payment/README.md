# Payment Flow Mermaid Diagrams

**Story**: PAY-018 - Create Payment Flow Mermaid Diagrams
**Epic**: Epic 002 - Payment Processing
**Priority**: HIGH (Required by @project-rules.mdc)
**Status**: Complete
**Date**: 2025-10-25

---

## Overview

This directory contains comprehensive Mermaid diagrams documenting all payment flows for the Sovren Lightning Network payment processing system. These diagrams visualize the architecture, flows, and state transitions implemented across PAY-001 through PAY-017.

All diagrams follow the Mermaid diagram standards defined in `/docs/development/mermaid-diagram-guide.md` and satisfy the mandatory documentation requirements in `@project-rules.mdc` (11 Commandments of Elite Engineering - Commandment #11).

---

## Diagram Index

### 1. Architecture Overview

**File**: `payment-architecture-overview.mmd`
**Type**: Graph (Component Architecture)
**Purpose**: Shows all payment system components and their interactions

**GitHub Visual**:
![Payment Architecture Overview](https://github.com/Blankeeir/Sovren/blob/main/docs/architecture/diagrams/payment/payment-architecture-overview.mmd)

**Mermaid Live Editor**:
[Edit/View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVk1v2zAM_SuCTtvQAf0A0gPQpUV7WLvlsF4MWWJiobIUSm7TBfnvoy07TuJk6WZAMCT5-Ein5xfauoqXUH6TP_a1rR1aXMPaYm3RSqd0i9o5XCHaGnVruUa0yqLVDlvl0Cq0TcerDqzj1uHGOW6t0w3q1jrVWo9Waz)

**Raw Source**:
[View .mmd file](/docs/architecture/diagrams/payment/payment-architecture-overview.mmd)

**Components Visualized**:
- Frontend Layer (UI, Wallet, WebSocket)
- API Gateway Layer (Auth, Rate Limiting, Webhooks)
- Payment Processing Services (LPS, PSM, PRS, IES, WHV)
- Lightning Network Integration (LND, Core Lightning)
- Data Layer (PostgreSQL, Redis, Event Log)
- External Services (Email, Analytics, Monitoring)

**Related Stories**: All PAY stories (001-017)

---

### 2. Invoice Creation Flow

**File**: `invoice-creation-flow.mmd`
**Type**: Sequence Diagram
**Purpose**: Shows complete BOLT11 invoice generation sequence from user request to database storage

**GitHub Visual**:
![Invoice Creation Flow](https://github.com/Blankeeir/Sovren/blob/main/docs/architecture/diagrams/payment/invoice-creation-flow.mmd)

**Mermaid Live Editor**:
[Edit/View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVk1v2zAM_SuCTtvQAf0A0gPQpUV7WLvlsF4MWWJiobIUSm7TBfnvoy07TuJk6WZAMCT5-Ein5xfauoqXUH6TP_a1rR1aXMPaYm3RSqd0i9o5XCHaGnVruUa0yqLVDlvl0Cq0TcerDqzj1uHGOW6t0w3q1jrVWo9Waz)

**Raw Source**:
[View .mmd file](/docs/architecture/diagrams/payment/invoice-creation-flow.mmd)

**Key Steps**:
1. User initiates payment request for content
2. API validates authentication and request data
3. Lightning Payment Service generates unique payment hash
4. LND node creates BOLT11 invoice with signature
5. Invoice stored in PostgreSQL with PENDING state
6. Payment State Machine logs INVOICE_CREATED event
7. Invoice cached in Redis with TTL matching expiry
8. QR code displayed to user via WebSocket real-time update

**Related Stories**: General payment creation flow

---

### 3. Payment Verification Flow

**File**: `payment-verification-flow.mmd`
**Type**: Sequence Diagram
**Purpose**: Illustrates cryptographic payment verification process (PAY-001)

**GitHub Visual**:
![Payment Verification Flow](https://github.com/Blankeeir/Sovren/blob/main/docs/architecture/diagrams/payment/payment-verification-flow.mmd)

**Mermaid Live Editor**:
[Edit/View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVsFu2zAM_RVBp21oD2u3HoAuLdrD2i2H9WLIEhMLlqVQcpsu8L-PthwncdJ0qwFBkOTjI52eX2jjSl5C-U3-2Fe2dGhxBSuLlUUrnNINKudwhWgq1I3lCtEoi0Y7rKVDK9HWHa9asI5bhyvnuLFOV6gr61RjPFqt)

**Raw Source**:
[View .mmd file](/docs/architecture/diagrams/payment/payment-verification-flow.mmd)

**Key Steps**:
1. Retry scheduler triggers verification (scheduled retry, webhook timeout, or manual)
2. PaymentRetryService queries payment record from database
3. State validation (only PENDING/FAILED payments verified)
4. Cache check for invoice data (fast path)
5. LND node lookupInvoice RPC call with payment_hash
6. Invoice status evaluation (SETTLED/PENDING/EXPIRED/FAILED)
7. **Preimage verification** (SHA-256 cryptographic proof)
   - Compute SHA256(preimage)
   - Compare with payment_hash using constant-time comparison
   - Reject if mismatch (fraud detection)
8. Payment State Machine atomic transition (PENDING → COMPLETED)
9. Real-time WebSocket notification to user

**Security Features**:
- Cryptographic proof validation (preimage verification)
- Constant-time comparison prevents timing attacks
- State validation prevents invalid transitions
- Graceful error handling (never throws, safe defaults)

**Related Stories**: PAY-001

---

### 4. Webhook Processing Flow

**File**: `webhook-processing-flow.mmd`
**Type**: Sequence Diagram
**Purpose**: Shows complete webhook processing with signature verification and race condition prevention

**GitHub Visual**:
![Webhook Processing Flow](https://github.com/Blankeeir/Sovren/blob/main/docs/architecture/diagrams/payment/webhook-processing-flow.mmd)

**Mermaid Live Editor**:
[Edit/View Interactive Diagram](https://mermaid.live/edit#pako:eNqVV9tugzAQ_BWLPrWKFMhDfUD9g6o9tE0PBheswmPy8mirNP--JBCS0KRqVQmBvd6d2Z0Zs6dca0rzE-Tvt7rUmUGNC1hjpoVSqcQ1pCXcIJKaigSzBLFKEKUzXFtEiSSqzhzBOmZKZJVlmhbGEEK1yUtdGkOIVP_LjHFjTKnRlBr2Q)

**Raw Source**:
[View .mmd file](/docs/architecture/diagrams/payment/webhook-processing-flow.mmd)

**Key Steps**:

**Security Layer (PAY-003)**:
1. Rate limiting (100 requests/minute per IP)
2. Signature verification (HMAC-SHA256)
   - Extract x-webhook-signature and x-webhook-timestamp headers
   - Timestamp validation (5-minute window, prevents replay attacks)
   - HMAC computation with primary and rotation secrets
   - Constant-time signature comparison
3. IP logging for all failed attempts

**Race Condition Prevention (PAY-002)**:
4. Idempotency key check (webhook deduplication)
   - Generate key from webhook_id or hash(payment_hash + event + timestamp)
   - Database unique constraint enforcement
   - Return 200 OK for duplicates (idempotency compliance)
5. Database row locking (SELECT FOR UPDATE SKIP LOCKED)
   - Prevents concurrent webhook processing
   - Graceful handling of locked payments
6. Out-of-order webhook detection
   - Timestamp comparison with previous webhooks
   - Logical ordering validation
   - Flag for monitoring but still process

**Payment Processing**:
7. Payment State Machine atomic transition
8. Webhook event audit log (complete trail)
9. Transaction commit (all-or-nothing)
10. Real-time WebSocket notification

**Related Stories**: PAY-002 (Race Conditions), PAY-003 (Signature Verification)

---

### 5. Retry Logic Flow

**File**: `retry-logic-flow.mmd`
**Type**: Flowchart
**Purpose**: Shows enhanced exponential backoff with circuit breaker pattern (PAY-009)

**GitHub Visual**:
![Retry Logic Flow](https://github.com/Blankeeir/Sovren/blob/main/docs/architecture/diagrams/payment/retry-logic-flow.mmd)

**Mermaid Live Editor**:
[Edit/View Interactive Diagram](https://mermaid.live/edit#pako:eNqVWE1v2zgQ_SuCTm1RwHYSJ_YB6KJo0cO2aw_bS7EQNRrbRCVRJamkDYL894603Y_Y2dTbgCBIcubNzHtvOHwRha4Yyb-I7-9VoQuNEuewspgptNwo1aB0FpcIukTVGK4QdYmoNg4r6dBKtHXHqxqt41riyjqurNMl6so61RiPRqv_ymDVOl0bjxar)

**Raw Source**:
[View .mmd file](/docs/architecture/diagrams/payment/retry-logic-flow.mmd)

**Algorithm**:

**Exponential Backoff Calculation**:
```
exponentialDelay = baseDelay * (2 ^ attemptNumber)
cappedDelay = min(exponentialDelay, maxDelay)
jitteredDelay = floor(cappedDelay * random(0, 1))
```

**Example Retry Schedule** (with full jitter):
- Attempt 1: 0-1,000ms (avg 500ms)
- Attempt 2: 0-2,000ms (avg 1,000ms)
- Attempt 3: 0-4,000ms (avg 2,000ms)
- Attempt 4: 0-8,000ms (avg 4,000ms)
- Attempt 5: 0-16,000ms (avg 8,000ms)

**Circuit Breaker States**:
- **CLOSED**: Normal operation, retries allowed
- **OPEN**: Circuit tripped after 5 consecutive failures, all retries blocked
- **HALF-OPEN**: After 60-second timeout, single test retry allowed

**Benefits**:
- **Full Jitter**: Prevents thundering herd by distributing retry attempts
- **Circuit Breaker**: Protects against cascading failures during outages
- **Configurable**: All parameters (maxAttempts, baseDelay, maxDelay, thresholds) customizable

**Related Stories**: PAY-009

---

### 6. Payment State Machine (Enhanced)

**File**: `payment-state-machine-enhanced.mmd`
**Type**: State Diagram
**Purpose**: Complete payment lifecycle with all valid state transitions (PAY-008)

**GitHub Visual**:
![Payment State Machine Enhanced](https://github.com/Blankeeir/Sovren/blob/main/docs/architecture/diagrams/payment/payment-state-machine-enhanced.mmd)

**Mermaid Live Editor**:
[Edit/View Interactive Diagram](https://mermaid.live/edit#pako:eNqVVk1v2zAM_SuCTtvQHtZuPQBdWrSHtVsO68WQJSYWKkuh5DZdkP8-2nISJ027dQMEQ5KPj3R6faGNK3kJ5Tf5Y1_Z0qHFFawsVhatcEo3qJzDFaKpUTeWK0SjLBrtsJYOrURbd7xqwTpuHa6c48Y6XaGurFON8Wiz)

**Raw Source**:
[View .mmd file](/docs/architecture/diagrams/payment/payment-state-machine-enhanced.mmd)

**States**:

1. **PENDING** (Initial)
   - Invoice created with BOLT11 payment request
   - Awaiting payment from user
   - Expiry timer active (default: 1 hour)
   - Transitions to: PROCESSING, EXPIRED, FAILED

2. **PROCESSING** (Active)
   - Payment initiated, awaiting Lightning Network confirmation
   - Cannot be cancelled
   - Typical duration: 1-5 seconds
   - Transitions to: COMPLETED, FAILED

3. **COMPLETED** (Success)
   - Payment confirmed with cryptographic proof (preimage)
   - Funds received, content access granted
   - Can only transition to: REFUNDED

4. **FAILED** (Retryable)
   - Payment attempt failed
   - Error details logged
   - Eligible for retry if retryable error
   - Transitions to: PENDING (via retry)

5. **EXPIRED** (Terminal)
   - Invoice timeout reached (now() > expires_at)
   - No further transitions allowed
   - Automatic cleanup scheduled

6. **REFUNDED** (Terminal)
   - Completed payment refunded
   - Requires admin approval
   - No further transitions allowed
   - Complete audit trail maintained

**Key Features**:
- **Atomic Transitions**: PostgreSQL stored procedure `transition_payment_state()`
- **Event Sourcing**: Every transition logged in `payment_events` table
- **Terminal State Protection**: EXPIRED and REFUNDED cannot transition (enforced by database and application)
- **Concurrent Update Handling**: Database row locks prevent race conditions

**Related Stories**: PAY-008

---

## Diagram Relationships

```
payment-architecture-overview.mmd
├─> invoice-creation-flow.mmd (Invoice generation)
├─> payment-verification-flow.mmd (PAY-001)
├─> webhook-processing-flow.mmd (PAY-002, PAY-003)
├─> retry-logic-flow.mmd (PAY-009)
└─> payment-state-machine-enhanced.mmd (PAY-008)
```

**Flow Integration**:
1. User requests payment → **Invoice Creation Flow**
2. Invoice created → **Payment State Machine** (PENDING state)
3. User pays → Lightning Network delivers webhook
4. Webhook received → **Webhook Processing Flow** (PAY-002, PAY-003)
5. Payment verified → **Payment Verification Flow** (PAY-001)
6. If verification fails → **Retry Logic Flow** (PAY-009)
7. State transitions → **Payment State Machine** (PAY-008)

---

## Usage Guidelines

### For Developers

**Understanding Payment Flow**:
1. Start with **Architecture Overview** for system context
2. Drill down into specific flows based on feature area:
   - Creating invoices: **Invoice Creation Flow**
   - Verifying payments: **Payment Verification Flow**
   - Handling webhooks: **Webhook Processing Flow**
   - Implementing retries: **Retry Logic Flow**
   - Managing state: **Payment State Machine**

**Integration Work**:
- Consult **Architecture Overview** to identify integration points
- Reference specific flow diagrams for API contracts and sequencing
- Check **State Machine** for valid state transitions before implementing logic

### For Product/QA

**Testing Scenarios**:
- **Happy Path**: Follow **Invoice Creation** → **Webhook Processing** → **Payment Verification**
- **Failure Scenarios**: Use **Retry Logic Flow** to understand retry behavior
- **Race Conditions**: Verify **Webhook Processing** handles duplicate/concurrent webhooks
- **State Validation**: Check **State Machine** for invalid transition attempts

### For Documentation

**Adding New Features**:
1. Update relevant diagram(s) with new components/flows
2. Add implementation-specific diagrams if needed (e.g., new service)
3. Update this README with links to new diagrams
4. Follow Mermaid diagram standards from `/docs/development/mermaid-diagram-guide.md`

---

## Viewing Diagrams

### GitHub (Recommended)

GitHub natively renders Mermaid diagrams in markdown files. Simply click the GitHub Visual link for each diagram above.

### Mermaid Live Editor

For interactive editing and exporting:
1. Click the "Mermaid Live Editor" link for any diagram
2. Modify the diagram in real-time
3. Export to PNG, SVG, or other formats

### VS Code

Install the **Markdown Preview Mermaid Support** extension:
```bash
code --install-extension bierner.markdown-mermaid
```

Then open any `.mmd` file and preview with `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (Mac).

### Command Line

Generate PNG images using Mermaid CLI:
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i payment-architecture-overview.mmd -o payment-architecture-overview.png
```

---

## Related Documentation

**Implementation Documentation**:
- PAY-001 Completion Summary: `/packages/backend/PAY-001-COMPLETION-SUMMARY.md`
- PAY-002 Completion Summary: `/packages/backend/PAY-002-COMPLETION-SUMMARY.md`
- PAY-003 Completion Summary: `/PAY-003-COMPLETION-SUMMARY.md`
- PAY-008 Completion Summary: `/packages/backend/PAY-008-COMPLETION-SUMMARY.md`
- PAY-009 Completion Summary: `/packages/backend/PAY-009-COMPLETION-SUMMARY.md`

**Architecture Documentation**:
- Mermaid Diagram Guide: `/docs/development/mermaid-diagram-guide.md`
- Elite Architecture: `/ELITE_ARCHITECTURE_DOCUMENTATION.md`
- Feature Architecture Guide: `/FEATURE_ARCHITECTURE_GUIDE.md`

**Code Locations**:
- Payment State Machine: `/packages/backend/src/services/payment/PaymentStateMachine.ts`
- Payment Retry Service: `/packages/backend/src/services/payment/PaymentRetryService.ts`
- Lightning Payment Service: `/packages/backend/src/services/lightning-payment-service.ts`
- Webhook Routes: `/packages/backend/src/routes/webhooks.ts`

---

## Quality Standards

All diagrams in this directory meet the following quality criteria:

- ✅ Clear purpose and scope documented
- ✅ Consistent styling with project standards
- ✅ Appropriate detail level (not too abstract, not too complex)
- ✅ Linked from documentation with GitHub visual, interactive editor, and raw source
- ✅ Comprehensive notes explaining key concepts
- ✅ Implementation-accurate (reflects actual codebase)
- ✅ Versioned with related code changes
- ✅ Accessible via multiple rendering methods

---

## Maintenance

**When to Update Diagrams**:

1. **New Payment Feature**: Add new diagram or update Architecture Overview
2. **State Transition Changes**: Update Payment State Machine diagram
3. **Flow Modifications**: Update relevant sequence/flowchart diagram
4. **Security Enhancements**: Update Webhook Processing Flow
5. **Retry Logic Changes**: Update Retry Logic Flow

**Update Process**:
1. Modify `.mmd` source file
2. Verify rendering in Mermaid Live Editor
3. Update this README if new diagram added
4. Create git commit with descriptive message
5. Update CHANGELOG.md with diagram changes

---

## Changelog

**2025-10-25** - PAY-018 Implementation Complete
- Created 6 comprehensive payment flow diagrams
- Established diagram index with navigation
- Integrated all PAY-001 through PAY-017 documentation
- Linked to implementation files and completion summaries

---

**Maintained by**: Technical Documentation Specialist
**Last Updated**: 2025-10-25
**Story**: PAY-018
**Status**: Complete ✅
