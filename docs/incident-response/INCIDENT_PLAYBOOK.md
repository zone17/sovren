# Incident Response Playbook

## Overview

This playbook defines how the Sovren engineering team detects, declares, manages, and resolves incidents. All engineers are expected to be familiar with this document before participating in on-call rotations.

---

## Severity Classification

| Severity | Definition | Example |
|----------|------------|---------|
| **P0 — Critical** | Complete service outage or data loss. All users affected. Revenue impact or security breach in progress. | API fully down, payment processing halted, user data exposed |
| **P1 — High** | Major feature unavailable or severely degraded for a significant subset of users. Revenue impact possible. | Lightning payments failing for >20% of users, auth broken for new signups, NOSTR relay connectivity lost |
| **P2 — Medium** | Non-critical feature degraded or minor data inconsistency. Workaround available. No immediate revenue impact. | Analytics dashboard not loading, notification delivery delayed, non-blocking UI errors |

---

## Response Time Expectations

| Severity | Acknowledge | First Update | Update Cadence | Resolution Target |
|----------|-------------|--------------|----------------|-------------------|
| **P0** | 15 minutes | 30 minutes | Every 60 minutes | 4 hours |
| **P1** | 1 hour | 2 hours | Every 4 hours | 24 hours |
| **P2** | 4 hours | 8 hours | Daily | 72 hours |

Response times are measured from the moment the incident is declared (not from detection time). Off-hours P0 incidents page the on-call engineer immediately. P1 off-hours incidents page on the next business day unless they escalate to P0.

---

## Declaration Process

### Step 1: Detect

An incident may be detected via:
- Automated alert (Grafana, Sentry, uptime monitor)
- User report (Slack #alerts, GitHub issue, direct message)
- Engineer observation during routine work

### Step 2: Assess

Before declaring, spend no more than **5 minutes** assessing:
- Is this reproducible?
- How many users are affected?
- Is data integrity at risk?
- Is there an active security threat?

If in doubt, declare an incident. It is always better to over-declare and downgrade than to delay response.

### Step 3: Declare

1. Post in **#incidents** Slack channel:
   ```
   INCIDENT DECLARED — [P0/P1/P2]
   Summary: <one sentence description>
   Affected: <what is broken / who is affected>
   Declared by: <your name>
   IC: <incident commander — you, or tag someone>
   Bridge: <link to Slack thread or video call>
   ```

2. Assign roles (see Command Structure below).

3. Update the status page if P0 or customer-facing P1.

### Step 4: Investigate and Mitigate

Work toward the fastest path to mitigation, not the root cause. A rollback or feature flag disable is always preferable to a hot-patch under pressure.

### Step 5: Resolve

1. Verify the issue is resolved via health checks and monitoring.
2. Post resolution notice in #incidents and update the status page.
3. Retain all logs, Sentry events, and Grafana snapshots before they expire.
4. Schedule a post-mortem within **48 hours** for P0 and **1 week** for P1.

---

## Command Structure

Every declared incident has two assigned roles. For small teams, one person may fill both roles for P1/P2 incidents.

### Incident Commander (IC)

- Owns the incident from declaration to post-mortem scheduling.
- Makes the call on mitigation strategies (rollback vs. hotfix vs. feature-flag).
- Controls the pace of communication — prevents engineers from going silent.
- Does **not** need to be the most technical person in the room.

Responsibilities:
- Keep the incident timeline updated in the Slack thread.
- Assign investigation tasks explicitly ("@engineer-a: check Supabase logs from 14:00–14:30 UTC").
- Call escalations when the resolution target is at risk.
- Declare the incident resolved and schedule the post-mortem.

### Comms Lead

- Drafts all external-facing communications (status page, email, Discord announcements).
- Posts the update cadence messages in #incidents so the IC stays focused on resolution.
- Is the single point of contact for stakeholder questions during the incident.

Responsibilities:
- Maintain the Slack thread with timestamped updates.
- Post status page updates on the cadence defined above.
- Draft post-incident customer communication if data or revenue was affected.

---

## Communication Channels

| Channel | Purpose |
|---------|---------|
| **#incidents** (Slack) | Primary incident coordination. All declaration, update, and resolution messages go here. |
| **#alerts** (Slack) | Automated monitoring alerts feed into this channel. Engineers watch this channel during on-call. |
| **#engineering** (Slack) | Engineering-wide notifications for P0 incidents affecting team velocity. |
| **Status page** | Customer-facing status. Update for all P0 and customer-facing P1 incidents. |
| **Email** | Reserved for P0 incidents with data or payment impact requiring formal customer notification. |

For P0 incidents, open a dedicated Slack thread under the declaration message. All investigation discussion happens in that thread. This keeps #incidents readable and the timeline intact.

---

## Escalation Paths

```
Detection
    │
    ▼
On-Call Engineer (Primary)
    │  Not acknowledged within SLA, or
    │  IC requests additional resources
    ▼
Secondary On-Call
    │  Still not resolved, or
    │  P0 approaching 2hr without mitigation
    ▼
Engineering Lead
    │  Data breach, legal exposure, or
    │  P0 at 4hr without resolution
    ▼
CTO / Founders
```

Escalation is not a failure — it is required protocol when the resolution target is at risk.

---

## Tooling Reference

| Tool | Purpose | Access |
|------|---------|--------|
| **Grafana** | System metrics, API latency, error rates, infrastructure dashboards | Internal |
| **Sentry** | Error tracking, stack traces, user impact counts, release tracking | Internal |
| **Supabase Dashboard** | Database health, connection pool, row-level logs, auth events | Internal |
| **GitHub Actions** | CI/CD pipeline status, deployment history, rollback triggers | GitHub org |
| **Vercel Dashboard** | Frontend deployment status, instant rollback to previous deployment | Vercel |

During a P0 incident, open these in the following order:
1. Sentry — understand the error surface and user impact
2. Grafana — correlate with system metrics to find the layer causing the failure
3. Supabase Dashboard — check database health if the error points to persistence
4. GitHub Actions / Vercel — if the incident began shortly after a deployment, rollback

---

## Blameless Post-Mortem Template

Post-mortems are blameless. The goal is to improve the system, not assign fault. Use this template for all P0 post-mortems and recommended for P1.

File post-mortems in `docs/incident-response/post-mortems/YYYY-MM-DD-short-title.md`.

---

```markdown
# Post-Mortem: [Short Title]

**Date:** YYYY-MM-DD
**Severity:** P0 / P1
**Duration:** HH:MM (from declaration to resolution)
**Incident Commander:** [Name]
**Comms Lead:** [Name]
**Participants:** [Names]

---

## Summary

<!-- 2–4 sentences. What broke, how it was detected, how it was resolved. -->

---

## Timeline

All times in UTC.

| Time | Event |
|------|-------|
| HH:MM | Incident first detected (alert or report) |
| HH:MM | Incident declared by [name] |
| HH:MM | IC and Comms Lead assigned |
| HH:MM | [Key investigation milestone] |
| HH:MM | Mitigation applied |
| HH:MM | Service confirmed restored |
| HH:MM | Incident resolved |

---

## Root Cause

<!-- The specific technical cause. Be precise. "Database connection pool exhausted due to
     a missing connection release in the payment service" not "database issue". -->

---

## Impact

- **User impact:** [Estimated number of users affected, what they could not do]
- **Revenue impact:** [Estimated revenue impact if any]
- **Data impact:** [Was any data lost, corrupted, or exposed?]
- **Duration:** [How long the issue was user-visible]

---

## What Went Well

<!-- List things that worked as intended: alerts fired, runbooks helped, rollback was fast. -->

-
-

---

## What Went Wrong

<!-- List things that slowed detection or resolution. No blame — focus on system and process gaps. -->

-
-

---

## Action Items

| Item | Owner | Due Date | Priority |
|------|-------|----------|----------|
| [Concrete change to prevent recurrence] | [Name] | YYYY-MM-DD | P0/P1/P2 |
| [Alert or monitoring improvement] | [Name] | YYYY-MM-DD | P0/P1/P2 |
| [Runbook or documentation gap] | [Name] | YYYY-MM-DD | P0/P1/P2 |

---

## Lessons Learned

<!-- 1–3 key takeaways that the team should remember or apply to future work. -->

-
-
```

---

## Quick Reference Card

```
P0: Page immediately → IC + Comms → 15min ack → 60min updates → status page
P1: Page primary → 1hr ack → 4hr updates
P2: Ticket + async → 4hr ack → daily updates

Declare in #incidents → assign IC + Comms → investigate → mitigate → resolve → post-mortem

Mitigation order: rollback > feature flag > hotfix
Escalate: primary → secondary → eng lead → CTO
```
