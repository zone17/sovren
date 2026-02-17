# ADR-021: Custodial Design for Creator Payments

## Status

Accepted

## Date

2026-02-16

## Context

EPIC-010 (Creator Network) introduces two features that require Sovren to handle Lightning payments on behalf of multiple parties:

1. **Collaborative Content Revenue Splitting** (US-E10-004) — When multiple creators collaborate on content, incoming Lightning payments must be split according to configured ratios (e.g., 60/40).
2. **Creator Marketplace Escrow** (US-E10-005) — When a supporter purchases a service from a creator, funds should be held until the service is delivered, then released to the creator.

Both features conflict with the non-custodial philosophy stated in PRD Section 8.4. As identified in the architect review (Risk 2: Lightning Payment Custodial Design Conflicts -- HIGH), Lightning payments are push-only and near-instant -- there is no native escrow mechanism. Any solution that holds funds temporarily or splits incoming payments requires either custodial behavior or a workaround.

This decision has regulatory, trust, and technical implications. If Sovren holds user funds (even temporarily), it may qualify as a Money Transmitter under FinCEN regulations (31 CFR 1010.100(ff)), requiring state-by-state licensing in the US. This would add significant compliance burden for what is intended to be a decentralized platform.

The PRD user story US-013 (Creator Payout) already describes creators withdrawing earnings to their Lightning wallet, implying the platform holds a balance -- but this can be interpreted as bookkeeping rather than custody if funds flow directly.

## Decision Drivers

- **Regulatory risk**: Custodial models trigger Money Transmitter License (MTL) requirements across US states. FinCEN guidance treats holding user funds as money transmission. Non-custodial models avoid this entirely.
- **User experience**: HODL invoices require both the sender and receiver to be online during the payment window. Platform custody allows asynchronous payments (pay now, creator receives later). Supporters expect "pay and forget" simplicity.
- **Technical complexity**: Multi-party Lightning payments (multiple invoices per transaction) add payment failure surface area. HODL invoices require careful timeout management. Custodial wallets are simpler to implement but require secure fund management.
- **Creator trust and fund safety**: Creators must trust that their earnings are safe. Non-custodial models preserve trust ("Sovren never holds your money"). Custodial models require transparent accounting and audit trails.
- **Platform revenue model compatibility**: Sovren takes a platform fee on transactions. This is simplest when the platform receives the payment first and forwards the remainder. Non-custodial models require the fee to be collected separately or embedded in the invoice amount.
- **Decentralization philosophy**: Sovren's core value proposition is creator sovereignty. Full custody contradicts this. The solution should minimize custodial surface area.

## Considered Options

1. **HODL Invoices (Non-Custodial Escrow)**
2. **Explicit Platform Custody (Platform Wallet)**
3. **Non-Custodial Multi-Invoice Splitting**
4. **Hybrid: HODL Invoices for Escrow + Multi-Invoice for Splits**

## Decision Outcome

Chosen option: **"Hybrid: HODL Invoices for Escrow + Multi-Invoice for Splits"** (Option 4), because it minimizes custodial surface area while maintaining good user experience. The platform never holds a balance of user funds. Revenue splits happen at payment time via multiple invoices, and marketplace escrow uses HODL invoices with time-locked release.

### Implementation Design

#### Revenue Splitting (Collaborative Content)

When a supporter pays for collaborative content:

1. The platform calculates the split ratios (e.g., Creator A: 55%, Creator B: 35%, Platform: 10%).
2. The platform generates **multiple Lightning invoices** -- one per recipient -- each for their share amount.
3. The supporter's wallet pays all invoices atomically (if WebLN supports it) or sequentially.
4. If any invoice fails, the entire payment is considered failed and the supporter is refunded via the successfully-paid invoices' creators (or the payment is retried).

**Fallback for wallets that cannot pay multiple invoices**: The platform generates a single invoice to itself, then immediately forwards splits to creator wallets. This is a **brief custodial window** (seconds, not hours) and is disclosed to the user. The platform does not maintain a running balance.

#### Marketplace Escrow

When a supporter purchases a creator service:

1. The platform creates a **HODL invoice** via the LND/CLN backend. The invoice locks the payment in an HTLC (Hash Time-Locked Contract) without settling.
2. The supporter pays the HODL invoice. Funds are locked in the Lightning channel (neither the supporter nor the platform holds them).
3. When the creator marks the service as delivered (or the supporter confirms receipt), the platform **reveals the preimage**, settling the invoice to the creator's wallet.
4. If the service is not delivered within the timeout period (configurable, default 72 hours), the HTLC expires and funds return to the supporter automatically.
5. Disputes within the timeout window are resolved by the platform withholding the preimage until resolution. The platform acts as an **arbiter**, not a custodian.

#### Platform Fee Collection

- For splits: The platform fee is one of the split recipients (its own invoice).
- For escrow: The platform fee is deducted before the HODL invoice amount. The creator's HODL invoice is for `(amount - fee)`. The fee invoice settles immediately.

### Positive Consequences

- No Money Transmitter License required in the primary flow (multi-invoice splits and HODL escrow are non-custodial)
- Aligns with Sovren's decentralization philosophy -- the platform never holds a running balance of user funds
- HODL invoice escrow is trustless and enforced by the Lightning protocol itself (HTLC timelock)
- Creator trust is preserved: funds flow directly to creator wallets in the split case, and are protocol-locked (not platform-locked) in the escrow case
- Platform fee collection is clean and atomic

### Negative Consequences

- Multi-invoice payments increase UX complexity: supporters may see multiple payment prompts if their wallet does not support batch payments
- HODL invoices require both parties to have channels with sufficient inbound liquidity; the platform may need to provide liquidity hints or channel management
- The multi-invoice fallback path (platform receives and forwards) introduces a brief custodial window that, at scale, could attract regulatory scrutiny
- HODL invoice timeout management adds operational complexity (monitoring locked HTLCs, handling timeouts, dispute resolution)
- Not all Lightning implementations support HODL invoices equally well (LND has mature support; CLN support is via plugin)

## Pros and Cons of the Options

### Option 1: HODL Invoices (Non-Custodial Escrow)

Use HODL invoices for both revenue splitting and marketplace escrow. The platform creates HODL invoices, holds the preimage, and reveals it when conditions are met.

- Good, because fully non-custodial -- the platform never receives funds
- Good, because avoids Money Transmitter License requirements
- Good, because trustless -- enforced by Lightning protocol HTLCs with automatic timeout refunds
- Bad, because HODL invoices tie up channel liquidity for the duration of the hold (problematic for long escrow periods)
- Bad, because both sender and receiver must have online Lightning nodes during the settlement window
- Bad, because revenue splitting with HODL invoices is awkward -- would require multiple HODL invoices with coordinated preimage reveal, adding failure modes
- Bad, because maximum hold time is limited by HTLC timelock (typically hours to days, not weeks)

### Option 2: Explicit Platform Custody (Platform Wallet)

The platform receives all payments into its own Lightning wallet, maintains creator balances in a database, and creators withdraw on demand.

- Good, because simplest to implement -- single invoice per payment, balance tracking in database
- Good, because supporters have the best UX -- pay one invoice, done
- Good, because supports asynchronous payments (creator does not need to be online)
- Good, because enables advanced features easily (refunds, partial releases, subscription billing)
- Bad, because **requires Money Transmitter License** in most US states -- significant compliance cost and legal risk
- Bad, because contradicts Sovren's non-custodial philosophy and creator sovereignty narrative
- Bad, because creates a honeypot -- platform wallet holding aggregate creator funds is a high-value attack target
- Bad, because creator trust depends entirely on platform integrity (counterparty risk)
- Bad, because fund loss (hack, insolvency) means creators lose earnings with no protocol-level protection

### Option 3: Non-Custodial Multi-Invoice Splitting

For every payment, generate multiple Lightning invoices (one per creator + one for platform fee). No HODL invoices. Supporters pay all invoices. No escrow capability.

- Good, because fully non-custodial -- funds go directly from supporter to each creator
- Good, because no regulatory exposure -- platform never touches funds
- Good, because simple protocol-level implementation (standard BOLT11 invoices)
- Bad, because **no escrow capability** -- marketplace services cannot be protected
- Bad, because multi-invoice payment UX is poor -- supporters must pay 2-4 separate invoices per transaction
- Bad, because atomic multi-payment is not guaranteed -- if one invoice fails mid-payment, partial payments occur
- Bad, because all creators must have online Lightning nodes to generate invoices at payment time

### Option 4: Hybrid (HODL Invoices for Escrow + Multi-Invoice for Splits)

Use multi-invoice splitting for collaborative content revenue and HODL invoices for marketplace escrow. Each mechanism is used where it fits best.

- Good, because minimizes custodial surface area (no running balances, brief fallback window only)
- Good, because each mechanism is used in its natural strength (HODL for conditional release, multi-invoice for direct splits)
- Good, because escrow is trustless and protocol-enforced
- Good, because revenue splits flow directly to creators in the primary path
- Good, because platform fee is collected atomically in both paths
- Bad, because two different payment mechanisms increase implementation and testing complexity
- Bad, because the multi-invoice fallback introduces a brief custodial moment
- Bad, because requires Lightning node infrastructure that supports both standard and HODL invoices (LND recommended)
- Bad, because supporters using wallets without multi-pay support fall back to the custodial path

## Technical Notes

### Lightning Node Requirements

- **LND 0.15+** recommended for mature HODL invoice support via `AddHoldInvoice` / `SettleInvoice` / `CancelInvoice` RPCs
- CLN requires the `holdinvoice` plugin
- The platform runs its own Lightning node for HODL invoice management and fee collection

### HODL Invoice Lifecycle

```
Supporter pays → HTLC locked in channel → Platform holds preimage
                                              │
                    ┌─────────────────────────┤
                    ▼                         ▼
              Service delivered          Timeout expires
              Platform reveals           HTLC auto-cancels
              preimage → Creator         Funds return to
              receives funds             supporter
```

### Multi-Invoice Payment Flow

```
Collaborative content purchased:
  Supporter wallet
    ├─── Invoice 1 (55%) ──→ Creator A wallet
    ├─── Invoice 2 (35%) ──→ Creator B wallet
    └─── Invoice 3 (10%) ──→ Platform wallet (fee)
```

### Fallback Path (Single Invoice + Forward)

```
Supporter wallet ──→ Platform wallet ──→ Creator A (55%)
                          │           ──→ Creator B (35%)
                          └── Platform retains (10% fee)

Custodial window: ~seconds (automated forwarding)
Disclosed to user: "Payment routed through Sovren for splitting"
```

### Regulatory Safeguard

The brief custodial fallback window should be documented in terms of service. Legal counsel should review whether automated, seconds-long forwarding constitutes "money transmission" in relevant jurisdictions. The primary multi-invoice path avoids this question entirely.

## Migration Strategy

The current codebase uses a single-invoice model via `LightningService` backed by LNbits. Migrating to the hybrid HODL + multi-invoice model described in this ADR should be done incrementally across three phases, with each phase independently deployable and backward-compatible.

### Phase 1: Multi-Invoice Revenue Splitting

**Goal**: Enable collaborative content payments without changing the existing single-creator payment flow.

**Changes required**:

1. **Extend `LightningService.createInvoice`** to accept an array of split recipients (`{ creatorId, ratio }[]`) alongside the existing single-creator parameters. When a single creator is specified, behavior is unchanged.
2. **Add a `createMultiInvoice` method** that generates one BOLT11 invoice per split recipient (including the platform fee invoice) and returns them as a batch. The `PaymentPersistence` interface gains a `saveInvoiceBatch` method that persists all invoices atomically.
3. **Implement the single-invoice fallback path**: When the supporter's wallet does not support multi-pay (detected via WebLN capability probing or user opt-in), generate a single invoice to the platform wallet, then forward splits via `LightningService.makePayment`. Record the brief custodial window in the payment metadata (`{ custodialFallback: true, forwardedAt: timestamp }`).
4. **Add split tracking to `PaymentPersistence`**: New `PaymentSplit` record type linking a parent payment to its child forwarded payments, with status tracking (`pending | forwarded | failed`).

**Data migration**: None. Existing invoices and payments remain valid. New fields are additive.

**Backward compatibility**: All existing single-invoice payment flows (tips, subscriptions, content purchases) continue to work without modification. The split logic only activates for collaborative content with multiple creators.

**Rollback**: Remove the multi-invoice code paths. Since Phase 1 is additive and existing flows are untouched, rollback is a code revert with no data migration needed.

### Phase 2: HODL Invoice Escrow for Marketplace

**Goal**: Add protocol-enforced escrow for creator marketplace service purchases.

**Prerequisites**: LND 0.15+ deployed with HODL invoice RPC support (`AddHoldInvoice`, `SettleInvoice`, `CancelInvoice`). This is an infrastructure change — the current LNbits integration does not support HODL invoices natively.

**Changes required**:

1. **Add an LND gRPC client** alongside the existing LNbits HTTP client. The `LightningService` constructor accepts an optional `lndGrpcClient` for HODL invoice operations. LNbits remains the default for standard invoices.
2. **Add `createHodlInvoice` method** that generates a HODL invoice via LND, stores the preimage securely (encrypted at rest), and tracks the HTLC state (`held | settled | canceled | expired`).
3. **Extend `PaymentPersistence`** with `saveHodlInvoice` and `updateHodlState` methods. HODL invoices are stored separately from standard invoices to avoid conflating their lifecycle states.
4. **Add an escrow resolution service** that handles: (a) creator marks service delivered -- platform reveals preimage to settle; (b) supporter confirms receipt -- same settlement flow; (c) timeout expiry -- platform cancels the invoice (HTLC auto-refunds); (d) dispute -- platform withholds preimage until resolution.
5. **Add HTLC monitoring**: A background job polls or subscribes to LND's `SubscribeInvoices` stream to detect timeout expirations and update escrow state accordingly.

**Data migration**: New `hodl_invoices` and `escrow_states` persistence collections. No modification to existing invoice/payment data.

**Backward compatibility**: Standard payments (tips, subscriptions, collaborative splits from Phase 1) continue through LNbits unchanged. HODL invoices are only created for marketplace escrow transactions. The two payment paths are isolated.

**Rollback**: Disable marketplace escrow feature flag. Any in-flight HODL invoices will either settle (if service is delivered before rollback) or expire via HTLC timeout (funds auto-return to supporter). No funds are at risk during rollback.

### Phase 3: Full Custodial Support (Optional, Conditional)

**Goal**: If regulatory and business conditions warrant it, add optional platform custody for creators who prefer asynchronous payout over direct Lightning payments.

**This phase is intentionally deferred.** It should only proceed if:
- Legal counsel confirms Money Transmitter License requirements are met or exemptions apply
- Creator demand for asynchronous payouts justifies the compliance cost
- The platform has sufficient operational maturity for secure fund management

**High-level changes** (to be detailed in a follow-up ADR if pursued):

1. Platform wallet with per-creator balance tracking in the database
2. Creator withdrawal flow (on-demand or scheduled payouts via existing `processPayout`)
3. Transparent accounting dashboard showing held balances, pending payouts, and fee deductions
4. Regular automated reconciliation between Lightning node balance and database balance records
5. Security audit of fund management: hot/cold wallet split, withdrawal limits, multi-sig for large amounts

**Data migration**: Would require migrating creator payment preferences and building balance ledger tables. Detailed in a future ADR.

**Backward compatibility**: Opt-in only. Creators who prefer non-custodial (Phase 1/2) flows retain their existing behavior.

### Migration Sequence Summary

```
Current State          Phase 1                Phase 2                Phase 3
─────────────          ───────                ───────                ───────
Single invoice    →    + Multi-invoice    →   + HODL invoices   →   + Platform custody
per payment            for splits             for escrow             (opt-in)
LNbits only            LNbits only            + LND gRPC             + Balance ledger
No splits              Collaborative splits   Marketplace escrow     Async payouts
No escrow              Fallback path          Direct settlement      Creator withdrawals
```

Each phase can be deployed independently. Phase 2 does not depend on Phase 1 being complete (they address different features), though deploying Phase 1 first is recommended to validate the multi-payment infrastructure before adding HODL complexity. Phase 3 is conditional and requires a separate ADR.

## References

- Architect Review, Risk 2: "Lightning Payment Custodial Design Conflicts -- HIGH"
- PRD Section 8.4: Non-custodial philosophy
- PRD US-E10-004: Collaborative content revenue splitting
- PRD US-E10-005: Creator marketplace with escrow
- PRD US-013: Creator payout / withdrawal
- FinCEN 31 CFR 1010.100(ff): Money Transmitter definition
- LND HODL Invoice API: `AddHoldInvoice`, `SettleInvoice`, `CancelInvoice`
- Lightning BOLT11 specification for standard invoice generation
