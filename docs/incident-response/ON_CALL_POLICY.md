# On-Call Policy

## Overview

This document defines the on-call rotation structure, escalation matrix, paging procedures, and shift handoff process for Sovren engineering. Every engineer with production access is expected to participate in on-call rotation.

---

## Rotation Schedule

On-call shifts run on a **weekly cycle**, Monday 09:00 UTC through the following Monday 09:00 UTC.

### Rotation Template

| Week | Primary On-Call | Secondary On-Call | Domain Expertise |
|------|-----------------|-------------------|-----------------|
| Week 1 | [Engineer A] | [Engineer B] | Backend / API |
| Week 2 | [Engineer B] | [Engineer C] | Payments / Lightning |
| Week 3 | [Engineer C] | [Engineer D] | Infrastructure / Docker |
| Week 4 | [Engineer D] | [Engineer A] | Frontend / NOSTR |

Replace names with actual team members. The rotation should be updated in the scheduling tool (PagerDuty / Opsgenie) at the start of each month.

### Rotation Principles

- No engineer should be on-call for more than 2 consecutive weeks without a break week.
- If an engineer is on leave, the secondary automatically becomes primary and a volunteer or the engineering lead covers secondary.
- Engineers starting on-call for the first time should shadow an experienced on-call engineer for one full week before taking primary.

---

## Escalation Matrix

Primary paging goes to the engineer currently listed as on-call primary. If the issue falls within a specific domain and the primary is not the domain owner, the primary is still responsible for coordinating — they pull in the domain owner as needed.

| Domain | Primary Owner | Secondary Owner | Escalates To |
|--------|--------------|-----------------|--------------|
| **Backend / API** | [Backend owner TBD] | [Secondary TBD] | Engineering Lead |
| **Payments / Lightning** | [Payments owner TBD] | [Secondary TBD] | Engineering Lead |
| **Infrastructure / Docker** | [Infra owner TBD] | [Secondary TBD] | Engineering Lead |
| **Security** | [Security owner TBD] | Engineering Lead | CTO |
| **Frontend / NOSTR** | [Frontend owner TBD] | [Secondary TBD] | Engineering Lead |
| **Database / Supabase** | [Backend owner TBD] | [Secondary TBD] | Engineering Lead |

Fill in owner names when roles are assigned. Until then, the on-call primary is the owner for all domains during their shift.

---

## Paging Procedures

### Alert Sources

Alerts are routed to on-call via:
- **PagerDuty / Opsgenie** — automated alerts from Grafana and uptime monitors page the on-call engineer directly (SMS, push notification, phone call for P0)
- **#alerts** Slack channel — automated Sentry and monitoring messages appear here; on-call engineer monitors this channel
- **Direct Slack message** — teammates or stakeholders may page the on-call engineer directly for things not caught by automated monitors

### Paging Sequence

```
Automated alert or manual report
        │
        ▼
  Primary On-Call
  (acknowledges within SLA)
        │
        │  Not acknowledged within 15min (P0) or 45min (P1)
        ▼
  Secondary On-Call
  (takes over primary responsibilities)
        │
        │  Not acknowledged within 15min of secondary page, or
        │  Primary + Secondary both engaged and blocked
        ▼
  Engineering Lead
  (joins bridge, provides additional resources or decision authority)
        │
        │  P0 at 2hr without mitigation, or data/security incident
        ▼
  CTO / Founders
```

### Paging Rules

- **P0**: Page primary immediately. If no acknowledgment within 15 minutes, page secondary automatically. Engineering lead is notified at declaration regardless.
- **P1**: Page primary. If no acknowledgment within 45 minutes, page secondary. Engineering lead notified at 1-hour mark if unresolved.
- **P2**: Slack message to primary. If no acknowledgment within 4 hours during business hours, escalate to secondary. No overnight pages for P2.

### Tool Configuration

Configure alerts in **PagerDuty** or **Opsgenie** (placeholder — set up before first production deployment):

1. Create a service for Sovren with escalation policy matching the sequence above.
2. Connect Grafana alerts to the service via webhook.
3. Connect Sentry to the service for P0-level error volume spikes.
4. Set override rules so that scheduled leave is respected (secondary auto-promotes).

Slack integration:
- `#alerts` — all automated monitoring alerts (Grafana, Sentry, uptime checks)
- `#incidents` — incident coordination (see INCIDENT_PLAYBOOK.md)
- On-call engineer should have Slack push notifications enabled 24/7 during their shift.

---

## On-Call Responsibilities

During an on-call shift, the primary engineer is responsible for:

1. **Monitoring**: Check `#alerts` at the start of each working day. Acknowledge any overnight alerts that did not auto-page.
2. **Triage**: For every alert, determine severity and decide within 5 minutes whether to declare an incident.
3. **First response**: For P0 and P1, begin investigation immediately. Do not wait for more information before declaring.
4. **Communication**: Keep stakeholders informed. Even a "I'm investigating, no update yet" message every 30 minutes is better than silence.
5. **Documentation**: Log all significant actions taken during incident investigation in the Slack thread. This becomes the basis for the post-mortem timeline.
6. **Handoff**: At end of shift, complete the handoff procedure below.

The on-call engineer is NOT expected to:
- Resolve every issue alone — pulling in teammates is encouraged and expected
- Work longer than their normal working hours for P2 incidents
- Skip sleep for P2 incidents — page the secondary if a P2 escalates overnight

---

## Handoff Procedure

A clean handoff prevents incidents from falling through the cracks between shifts. Complete this at the end of every on-call week.

### Outgoing On-Call Engineer

1. **Post a handoff summary** in `#incidents` (or `#engineering` if no active incidents):

   ```
   ON-CALL HANDOFF — Week ending YYYY-MM-DD
   Outgoing: [your name]
   Incoming: [next engineer's name]

   Active incidents:
   - [None / List any open P1/P2 with status]

   Elevated risk areas:
   - [Recent deployments to watch]
   - [Known flaky alerts or noisy monitors]
   - [Anything you'd want to know if you were taking over]

   Changes made during shift:
   - [Any runbook updates, alert tuning, configuration changes]

   Action items handed off:
   - [Any P2 issues in progress that need continued monitoring]
   ```

2. Update the on-call schedule in PagerDuty / Opsgenie to reflect the incoming engineer.

3. If there is an active incident at shift change: the outgoing IC remains on the incident until mitigation is confirmed, then formally hands the IC role to the incoming engineer with a brief sync call or voice note.

### Incoming On-Call Engineer

1. Read the handoff summary.
2. Check `#alerts` for any unacknowledged alerts from the past 2 hours.
3. Verify you are correctly configured as the active responder in PagerDuty / Opsgenie.
4. Reply to the handoff summary confirming receipt: "Handoff received, I'm on."

---

## On-Call Compensation and Expectations

_Placeholder — fill in based on company policy._

- On-call engineers are expected to be reachable and able to begin responding within the SLA windows above.
- Off-hours P0 responses qualify for [compensation policy TBD].
- Engineers should not be scheduled for on-call during planned leave. Submit leave in the schedule tool at least 1 week in advance.

---

## Runbooks Index

Link to runbooks from this document as they are created:

| Scenario | Runbook |
|----------|---------|
| API health check failing | [docs/deployment/DEPLOYMENT_GUIDE.md](../deployment/DEPLOYMENT_GUIDE.md) |
| Disaster recovery | [docs/deployment/DISASTER_RECOVERY.md](../deployment/DISASTER_RECOVERY.md) |
| Docker backend rollback | [docs/deployment/DISASTER_RECOVERY.md#docker-backend-rollback](../deployment/DISASTER_RECOVERY.md) |
| Vercel frontend rollback | [docs/deployment/DISASTER_RECOVERY.md#vercel-frontend-rollback](../deployment/DISASTER_RECOVERY.md) |
| Incident declaration | [docs/incident-response/INCIDENT_PLAYBOOK.md](./INCIDENT_PLAYBOOK.md) |
| Secrets rotation | [docs/deployment/SECRETS_MANAGEMENT.md](../deployment/SECRETS_MANAGEMENT.md) |
