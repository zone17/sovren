# Legal Compliance Checklist — Sovren Platform

**Generated:** March 28, 2026
**Review Cycle:** Pre-Launch / Q1 2026

---

> **IMPORTANT DISCLAIMER:** This checklist was generated from an automated compliance review (March 28, 2026). It identifies gaps for attorney review — it is NOT legal advice. Each item requires professional legal assessment for your specific jurisdiction and business model. The Lightning Network / NOSTR architecture presents novel legal questions that require specialist counsel in fintech, platform liability, and international privacy law.

---

## Priority Legend

| Code   | Meaning                                                        |
| ------ | -------------------------------------------------------------- |
| **P0** | Blocks launch — must be resolved before any public release     |
| **P1** | Must have for US operations — resolve within 30 days of launch |
| **P2** | Best practice — resolve within 90 days                         |

## Owner Legend

| Code         | Meaning                                              |
| ------------ | ---------------------------------------------------- |
| **LAWYER**   | Requires attorney drafting or legal opinion          |
| **DEV TEAM** | Requires technical implementation                    |
| **BOTH**     | Requires attorney input AND technical implementation |

---

## 1. Terms of Service Gaps

| #   | Gap                                | Current Status                                        | Required Action                                                                                                                                                                                                                                     | Owner  | Priority |
| --- | ---------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| 1.1 | No dispute resolution clause       | Missing from ToS entirely                             | Draft governing law selection (recommend Delaware or California), jurisdiction clause, binding arbitration agreement (AAA/JAMS rules), and class-action waiver. Assess enforceability in target markets.                                            | LAWYER | **P0**   |
| 1.2 | No minimum age / COPPA compliance  | Missing from ToS entirely                             | Add minimum age of 13 (or 18 given payment flows — attorney to advise). If under-13 users are possible, implement COPPA-compliant parental consent flow. Evaluate COPPA applicability given NOSTR pseudonymity.                                     | BOTH   | **P0**   |
| 1.3 | Thin limitation of liability       | Basic disclaimer present; no aggregate cap            | Add aggregate liability cap (recommend: fees paid in prior 12 months or fixed floor, e.g. $100). Add gross negligence and willful misconduct carve-out. Review enforceability by jurisdiction — some EU states void blanket waivers.                | LAWYER | **P1**   |
| 1.4 | Vague content licensing grant      | Generic license grant present                         | Define sublicensing scope explicitly for NOSTR relay propagation (content broadcast to third-party relays by design). Clarify that user grants a non-exclusive, royalty-free, sublicensable license to the extent necessary for relay distribution. | LAWYER | **P1**   |
| 1.5 | No explicit CSAM prohibition       | Prohibited content list exists but omits CSAM by name | Add explicit CSAM (child sexual abuse material) prohibition by name with statement of zero-tolerance policy and mandatory reporting obligation. Required for DMCA safe harbor and CyberTipline standing.                                            | LAWYER | **P0**   |
| 1.6 | Prohibited content list incomplete | Generic list present                                  | Add explicit prohibitions for: NCII (non-consensual intimate imagery / "revenge porn"), doxxing, swatting, coordinated inauthentic behavior. Align with 18 U.S.C. § 2252A (CSAM), SHIELD Act (NCII), and applicable state laws.                     | LAWYER | **P1**   |

---

## 2. Privacy Policy Gaps

| #   | Gap                                        | Current Status                                  | Required Action                                                                                                                                                                                                                                                                                                    | Owner  | Priority |
| --- | ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------- |
| 2.1 | No cookie policy                           | No disclosure of session cookie use             | Add cookie policy section disclosing HttpOnly session cookies, their purpose, duration, and absence of third-party tracking cookies. Required under GDPR Recital 30, ePrivacy Directive, and CCPA. Even "necessary" cookies require disclosure.                                                                    | LAWYER | **P1**   |
| 2.2 | No CCPA compliance section                 | No California-specific rights disclosed         | Add CCPA/CPRA section covering: right to know, right to delete, right to opt out of sale/sharing, right to correct, non-discrimination right. Add "Do Not Sell or Share My Personal Information" link if any data sharing with third parties occurs. Assess whether revenue thresholds trigger CCPA applicability. | LAWYER | **P1**   |
| 2.3 | GDPR contact inadequate                    | "Reach out via NOSTR" listed as privacy contact | Replace with a specific email address (e.g., privacy@[domain].com) that routes to a designated privacy contact. Consider appointing a Data Protection Officer (DPO) if processing at scale in the EEA. GDPR Art. 13 requires identifiable controller contact details.                                              | BOTH   | **P1**   |
| 2.4 | 30-day soft-delete retention not disclosed | Retention period undisclosed in privacy policy  | Add explicit retention schedule to privacy policy: disclose the 30-day grace period before hard deletion, what data is retained during that period, and what is purged. GDPR Art. 13(2)(a) requires retention period disclosure.                                                                                   | LAWYER | **P1**   |
| 2.5 | No lawful basis for processing identified  | No legal basis stated in privacy policy         | For each data category, identify and disclose the GDPR lawful basis (Art. 6): consent, contract performance, legitimate interests, or legal obligation. Payment data likely requires contract performance; marketing requires consent. Attorney to assess.                                                         | LAWYER | **P1**   |
| 2.6 | No DPA or EEA representative identified    | No EU/EEA representative appointed              | If processing EEA residents' data without an EU establishment, appoint an Art. 27 GDPR representative in an EU member state. Assess whether a Data Processing Agreement (DPA) is needed with Supabase, Vercel, or other processors.                                                                                | BOTH   | **P1**   |

---

## 3. Payment Compliance (HIGHEST RISK)

> **Attorney Note:** The Lightning Network architecture — where the platform facilitates Bitcoin Lightning payments between users without holding funds — sits in a legally uncertain zone. The core question is whether this constitutes money transmission requiring a state-by-state Money Services Business (MSB) license and FinCEN registration. This analysis is time-sensitive and must precede any payment feature launch. Penalties for unlicensed money transmission include criminal liability.

| #   | Gap                                       | Current Status                         | Required Action                                                                                                                                                                                                                                                        | Owner  | Priority |
| --- | ----------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| 3.1 | No KYC/AML policy                         | No KYC or AML procedures exist         | Engage fintech counsel to determine KYC/AML obligations for non-custodial Lightning facilitator model. If MSB classification applies, implement FinCEN-compliant CIP (Customer Identification Program). At minimum, document the legal position.                       | LAWYER | **P0**   |
| 3.2 | No OFAC screening                         | No sanctions screening in payment flow | Implement OFAC SDN list screening before processing any payment, regardless of MSB determination. Facilitation of payments to sanctioned parties is a liability even for non-custodial platforms. Treasury OFAC penalties apply to facilitated transactions.           | BOTH   | **P0**   |
| 3.3 | No money transmission licensing analysis  | No legal opinion on record             | Obtain written attorney opinion on whether the platform constitutes a Money Services Business under 31 C.F.R. § 1010.100(ff) and applicable state money transmission laws (NY BitLicense, CA DFPI, TX, WA, FL, etc.). Document the analysis and conclusion.            | LAWYER | **P0**   |
| 3.4 | No 1099-K reporting disclosure            | Not disclosed in ToS or Privacy Policy | Add disclosure that the platform may be required to issue IRS Form 1099-K for users exceeding $600 in payment receipts (2024+ threshold). Collect taxpayer information (W-9 / W-8BEN) from payees if reporting obligations apply. Attorney to advise on applicability. | BOTH   | **P1**   |
| 3.5 | No Bitcoin property tax disclosure        | No tax characterization disclosed      | Add disclosure that Bitcoin and Lightning Network payments are treated as property transactions by the IRS (Notice 2014-21), and users are responsible for tracking cost basis and reporting capital gains. Recommend users consult a tax professional.                | LAWYER | **P1**   |
| 3.6 | No capital gains implications notice      | Not disclosed                          | Add a brief disclosure that each Lightning payment may constitute a taxable disposition of Bitcoin for US users, potentially triggering capital gains or losses. This is a best-practice user protection.                                                              | LAWYER | **P2**   |
| 3.7 | "All payments final" with no dispute path | ToS states payments are final          | Add a limited dispute mechanism or at minimum a clearly documented process for reporting fraudulent transactions. Assess whether "all sales final" for digital content meets FTC unfairness standards. Attorney to advise on minimum viable dispute path.              | BOTH   | **P1**   |

---

## 4. Content Moderation

| #   | Gap                                             | Current Status                                     | Required Action                                                                                                                                                                                                                                                                                                                                                                                | Owner    | Priority |
| --- | ----------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| 4.1 | No DMCA safe harbor agent registered            | No Copyright Agent on record at copyright.gov      | Register a Copyright Agent with the U.S. Copyright Office (copyright.gov/dmca-directory) immediately. Required to claim 17 U.S.C. § 512(c) safe harbor. Annual renewal required. Filing fee is nominal (~$6).                                                                                                                                                                                  | LAWYER   | **P0**   |
| 4.2 | No inbound DMCA takedown procedure              | No takedown process published                      | Publish a DMCA takedown notice procedure on the platform (typically a dedicated `/dmca` or `/copyright` page). Include: agent contact info, required elements of a valid notice (17 U.S.C. § 512(c)(3)), and acknowledgment of receipt process.                                                                                                                                                | BOTH     | **P0**   |
| 4.3 | No counter-notice process                       | Missing from DMCA procedure                        | Add counter-notice procedure allowing users to contest wrongful takedowns (17 U.S.C. § 512(g)). Include: required elements, 10-14 business day restoration timeline, and statement of putback process. Required for full § 512 safe harbor protection.                                                                                                                                         | LAWYER   | **P1**   |
| 4.4 | No CSAM / NCMEC CyberTipline reporting pipeline | No reporting pipeline exists                       | Implement mandatory CyberTipline reporting pipeline for detected CSAM under 18 U.S.C. § 2258A. This is a federal criminal obligation — failure to report known CSAM to NCMEC (cybertipline.org) exposes officers and the company to criminal liability. Must include: automated detection hooks into reporting flow, logging, and legal hold procedures. This is non-negotiable before launch. | BOTH     | **P0**   |
| 4.5 | No standalone content policy page               | Prohibited content exists in ToS only              | Create a user-facing Community Guidelines / Content Policy page separate from the ToS. Should cover: prohibited content categories, enforcement actions (warning / suspension / termination), appeals process, and transparency reporting intentions.                                                                                                                                          | BOTH     | **P1**   |
| 4.6 | No user-facing content reporting flow           | Backend AutomatedContentModerationDashboard exists | Build a user-accessible "Report Content" flow connected to the existing moderation backend. Users must be able to report: CSAM, NCII, harassment, copyright infringement, and spam. Required for DMCA safe harbor (knowledge standard) and general platform liability management.                                                                                                              | DEV TEAM | **P0**   |

---

## 5. Accessibility

| #   | Gap                                          | Current Status                             | Required Action                                                                                                                                                                                                                                                        | Owner | Priority |
| --- | -------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- |
| 5.1 | No WCAG conformance statement                | No public accessibility statement          | Publish a WCAG 2.1 AA accessibility conformance statement. Include: conformance level claimed, known limitations, and contact method for reporting barriers. Required for ADA Title III web accessibility compliance (per DOJ 2024 final rule, effective 2026).        | BOTH  | **P1**   |
| 5.2 | No VPAT published                            | No VPAT exists                             | Create a Voluntary Product Accessibility Template (VPAT) documenting WCAG 2.1 AA conformance by success criterion. Important for enterprise/government customers and demonstrates good-faith compliance effort.                                                        | BOTH  | **P2**   |
| 5.3 | No accessibility barrier remediation process | No documented process                      | Document and publish the process for users to report accessibility barriers and the SLA for response (recommended: 5 business days acknowledgment, 30-day remediation target). Required under DOJ 2024 ADA web rule for covered entities.                              | BOTH  | **P2**   |
| 5.4 | Current compliance gap                       | ~78% WCAG 2.1 AA conformance (up from 56%) | The remaining ~22% gap must be assessed for severity. Any Level A failures are particularly high-risk. Attorney to advise on whether current conformance level is sufficient to proceed with launch given DOJ 2024 final rule effective date and platform's user base. | BOTH  | **P1**   |

---

## Summary Action Items

The following items are numbered for tracking. Each is assigned a primary owner and priority.

### P0 — Blocks Launch (Must resolve before any public release)

| #    | Action                                                                                                                                          | Owner    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A-01 | Draft and publish a dispute resolution clause (governing law, jurisdiction, binding arbitration, class-action waiver) in the Terms of Service   | LAWYER   |
| A-02 | Add minimum age requirement and COPPA compliance language to Terms of Service; implement age gate if minors may access payment features         | BOTH     |
| A-03 | Add explicit CSAM prohibition by name to Terms of Service and align with CyberTipline reporting obligations                                     | LAWYER   |
| A-04 | Obtain written legal opinion on Money Services Business classification under federal and state law for the Lightning Network facilitation model | LAWYER   |
| A-05 | Determine KYC/AML obligations; document legal position or begin CIP implementation                                                              | LAWYER   |
| A-06 | Implement OFAC SDN list screening in the payment processing flow                                                                                | BOTH     |
| A-07 | Register a DMCA Copyright Agent with the U.S. Copyright Office (copyright.gov)                                                                  | LAWYER   |
| A-08 | Publish a DMCA takedown procedure on the platform                                                                                               | BOTH     |
| A-09 | Implement a CSAM detection-to-CyberTipline reporting pipeline (18 U.S.C. § 2258A compliance)                                                    | BOTH     |
| A-10 | Build a user-facing content reporting flow connected to the existing moderation backend                                                         | DEV TEAM |

### P1 — Required for US Operations (Resolve within 30 days of launch)

| #    | Action                                                                                                               | Owner  |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| A-11 | Strengthen limitation of liability clause: add aggregate cap and gross negligence carve-out                          | LAWYER |
| A-12 | Clarify content licensing grant to explicitly address NOSTR relay sublicensing scope                                 | LAWYER |
| A-13 | Add NCII and doxxing to the prohibited content list                                                                  | LAWYER |
| A-14 | Add cookie policy section to Privacy Policy disclosing session cookie use                                            | LAWYER |
| A-15 | Add CCPA/CPRA compliance section and "Do Not Sell" mechanism to Privacy Policy                                       | LAWYER |
| A-16 | Replace NOSTR privacy contact with a specific, monitored email address                                               | BOTH   |
| A-17 | Disclose the 30-day soft-delete retention period in the Privacy Policy                                               | LAWYER |
| A-18 | Identify and document GDPR lawful basis for each data processing category                                            | LAWYER |
| A-19 | Assess need for EU Art. 27 representative and Data Processing Agreements with vendors                                | BOTH   |
| A-20 | Add IRS 1099-K reporting disclosure to Terms of Service; assess W-9 collection obligations                           | BOTH   |
| A-21 | Add Bitcoin property tax characterization notice to Terms of Service                                                 | LAWYER |
| A-22 | Add a limited payment dispute / fraud reporting mechanism                                                            | BOTH   |
| A-23 | Publish DMCA counter-notice procedure                                                                                | LAWYER |
| A-24 | Create standalone Community Guidelines / Content Policy page                                                         | BOTH   |
| A-25 | Publish a WCAG 2.1 AA conformance statement; assess severity of remaining 22% gap                                    | BOTH   |
| A-26 | Attorney review: assess whether current ~78% WCAG conformance is sufficient for launch given DOJ 2024 ADA final rule | LAWYER |

### P2 — Best Practice (Resolve within 90 days)

| #    | Action                                                                             | Owner  |
| ---- | ---------------------------------------------------------------------------------- | ------ |
| A-27 | Add capital gains / taxable Bitcoin disposition disclosure to Terms of Service     | LAWYER |
| A-28 | Create and publish a VPAT documenting WCAG 2.1 AA conformance by success criterion | BOTH   |
| A-29 | Document and publish the accessibility barrier remediation process and SLA         | BOTH   |

---

## Appendix: Key Legal References

| Statute / Regulation          | Domain         | Relevance                                                   |
| ----------------------------- | -------------- | ----------------------------------------------------------- |
| 17 U.S.C. § 512 (DMCA)        | Copyright      | Safe harbor requires registered agent + published procedure |
| 18 U.S.C. § 2258A             | CSAM Reporting | Criminal obligation to report known CSAM to NCMEC           |
| 31 C.F.R. § 1010.100(ff)      | AML/BSA        | MSB definition for money services businesses                |
| IRS Notice 2014-21            | Tax            | Bitcoin treated as property; capital gains apply            |
| GDPR (EU) 2016/679            | Privacy        | Lawful basis, DPO, Art. 27 representative, retention        |
| CCPA/CPRA (Cal.)              | Privacy        | Do Not Sell, consumer rights, $600K revenue threshold       |
| COPPA (15 U.S.C. § 6501)      | Child Safety   | Under-13 consent requirements                               |
| ADA Title III / DOJ 2024 Rule | Accessibility  | WCAG 2.1 AA required for web services (effective 2026)      |
| SHIELD Act (NY)               | NCII           | Non-consensual intimate imagery prohibition                 |
| NY BitLicense (23 NYCRR 200)  | Payments       | NY-specific virtual currency business license               |

---

_Document owner: Legal Counsel_
_Next review date: 30 days post-launch or upon material platform change_
_Prepared by: Automated compliance review — Wave 5 Legal/Compliance Audit, March 28, 2026_
