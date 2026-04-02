# MVP Launch Blockers -- Legal Compliance

Status: Identified during PRA2 (2026-03-28). These block **public launch** but
do NOT block a **crypto-native closed alpha** with known participants.

---

## 1. DMCA Compliance -- No Takedown Procedure

**What**: The Digital Millennium Copyright Act requires platforms hosting
user-generated content to provide a mechanism for copyright holders to request
removal of infringing material.

**Why it blocks**: Without a DMCA takedown procedure, Sovren loses safe harbor
protection under 17 USC 512. This exposes the platform to direct copyright
infringement liability for any user-uploaded content.

**What is needed**:

- Designated DMCA agent registered with the US Copyright Office
- Public-facing takedown request form or email
- Internal process to review and act on takedown notices within 24 hours
- Counter-notification process for content creators
- Repeat infringer policy

**Closed alpha OK?** Yes -- known participants, low volume, can handle manually.

---

## 2. CSAM Detection -- No Scanning/Reporting Infrastructure

**What**: Federal law (18 USC 2258A) requires electronic service providers to
report known instances of child sexual abuse material (CSAM) to NCMEC.

**Why it blocks**: Platforms that allow user-generated content or file uploads
must have detection mechanisms. Failure to report is a federal crime.

**What is needed**:

- Integration with PhotoDNA or similar hash-matching service
- Reporting pipeline to NCMEC CyberTipline
- Content moderation queue for flagged material
- Staff training on legal obligations
- Record retention per legal requirements

**Closed alpha OK?** Yes -- invite-only with identity verification, no anonymous uploads.

---

## 3. Money Transmission -- Bitcoin Lightning May Require State Licenses

**What**: Operating a service that transmits money (including cryptocurrency)
may require Money Services Business (MSB) registration with FinCEN and
individual state money transmitter licenses.

**Why it blocks**: Lightning Network payments between users, tipping, and
subscription payments may constitute money transmission depending on custody
model. Operating without required licenses is a federal and state crime.

**What is needed**:

- Legal opinion on whether Sovren's custody model constitutes money transmission
- If yes: FinCEN MSB registration + state-by-state licensing (expensive, 6-12 months)
- If no (non-custodial): documented analysis proving users maintain custody at all times
- Terms of service clearly describing the payment model

**Closed alpha OK?** Yes -- peer-to-peer Lightning payments between known parties,
no custodial holding.

---

## 4. Age Verification -- No Mechanism to Verify Age

**What**: Various federal and state laws (COPPA, state age verification laws)
require platforms to verify that users meet minimum age requirements,
particularly for platforms with adult content or financial transactions.

**Why it blocks**: COPPA applies if users under 13 can access the platform.
State laws (e.g., Louisiana, Utah, Virginia) require age verification for
certain content categories. Lightning payments may trigger additional age
requirements under financial regulations.

**What is needed**:

- Age gate during registration (minimum: self-declaration, checkbox)
- For higher assurance: third-party age verification service integration
- Privacy-preserving approach (verify age without storing ID documents)
- Terms of service with age requirements
- Process to handle discovered underage accounts

**Closed alpha OK?** Yes -- invite-only, known adult participants.

---

## 5. Dispute Resolution -- No Refund/Chargeback Process

**What**: Consumer protection laws and payment processor requirements mandate
that platforms provide dispute resolution mechanisms for purchases and payments.

**Why it blocks**: Without a refund/chargeback process, the platform violates
consumer protection regulations and will face payment processor compliance issues.
Lightning payments are irreversible by default, making this more complex.

**What is needed**:

- Clear refund policy in terms of service
- In-platform dispute resolution flow (creator-subscriber)
- Escrow or hold period for new subscriptions
- Admin escalation process for unresolved disputes
- Record keeping for financial transactions per regulatory requirements

**Closed alpha OK?** Yes -- known participants, manual dispute handling acceptable.

---

## Summary

| Blocker            | Public Launch | Closed Alpha | Estimated Effort                               |
| ------------------ | :-----------: | :----------: | ---------------------------------------------- |
| DMCA compliance    |    BLOCKED    |      OK      | 2-4 weeks                                      |
| CSAM detection     |    BLOCKED    |      OK      | 4-8 weeks + vendor                             |
| Money transmission |    BLOCKED    |      OK      | Legal opinion: 2 weeks; licensing: 6-12 months |
| Age verification   |    BLOCKED    |      OK      | 1-2 weeks                                      |
| Dispute resolution |    BLOCKED    |      OK      | 2-4 weeks                                      |

**Recommendation**: Proceed with crypto-native closed alpha while addressing
these blockers in parallel. Engage legal counsel before public launch.
