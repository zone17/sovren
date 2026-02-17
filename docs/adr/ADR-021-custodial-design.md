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

## References

- Architect Review, Risk 2: "Lightning Payment Custodial Design Conflicts -- HIGH"
- PRD Section 8.4: Non-custodial philosophy
- PRD US-E10-004: Collaborative content revenue splitting
- PRD US-E10-005: Creator marketplace with escrow
- PRD US-013: Creator payout / withdrawal
- FinCEN 31 CFR 1010.100(ff): Money Transmitter definition
- LND HODL Invoice API: `AddHoldInvoice`, `SettleInvoice`, `CancelInvoice`
- Lightning BOLT11 specification for standard invoice generation
