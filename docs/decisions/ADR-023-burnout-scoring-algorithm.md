# ADR-023: Burnout Risk Scoring Algorithm

> **Note:** Originally numbered ADR-019 in `docs/adr/`. Renumbered to ADR-023 here because ADR-019
> in `docs/decisions/` is `ADR-019-bullmq-job-queue-standard.md` (a different decision).


## Status

Accepted

## Date

2026-02-15

## Context

EPIC-007 (Creator Wellness) requires a burnout risk scoring engine (US-E7-003) that assesses creator burnout risk based on work patterns, posting frequency, engagement metrics, and rest patterns. The algorithm must be:

1. **Transparent** — Creators see exactly what factors contribute to their score
2. **Personalized** — Based on the creator's own baseline, not absolute thresholds
3. **Configurable** — Creators can adjust sensitivity if they find the score too aggressive or too lenient
4. **Testable** — Deterministic with known inputs producing known outputs
5. **Non-punitive** — The score is for the creator's benefit only; never used for platform decisions

We considered three approaches:

- **A) Simple rule-based system**: If X > threshold, score += N. Easy to implement but rigid and not personalized.
- **B) Weighted sum with personal baseline**: 5 factors, each with configurable weight, measured against the creator's personal rolling average. Transparent, personalized, testable.
- **C) ML model**: Train on creator patterns to predict burnout. More accurate long-term but opaque, requires training data, and harder to explain to creators.

## Decision

**Option B: Weighted sum of 5 factors, normalized to 0-100 scale, measured against personal baselines.**

### Algorithm

Each factor produces a contribution value between 0.0 and 1.0, where 0.0 means "no concern" and 1.0 means "maximum concern."

| Factor                  | Weight | Trigger Condition                                                | Contribution Calculation                                              |
| ----------------------- | ------ | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Work hours trend        | 0.25   | Weekly hours > 120% of personal baseline                         | `min(1.0, max(0, (current_hours / baseline_hours - 1.0) / 0.5))`      |
| Posting frequency spike | 0.20   | Posts/week > 150% of 4-week rolling average                      | `min(1.0, max(0, (current_posts / avg_posts - 1.0) / 1.0))`           |
| Engagement drop         | 0.20   | Engagement rate < 70% of 4-week average                          | `min(1.0, max(0, (1.0 - current_engagement / avg_engagement) / 0.3))` |
| Hour regularity         | 0.15   | High standard deviation of daily start/end times (>1hr triggers) | `min(1.0, max(0, (stddev_hours - 1.0) / 3.0))`                        |
| Rest day deficit        | 0.20   | < 2 days with < 30min of tracked activity per week               | `min(1.0, max(0, (2 - rest_days) / 2.0))`                             |

**Final score** = `round(sum(factor_contribution * factor_weight) * 100)`

**Levels**:

- Low: 0-25
- Moderate: 26-50
- High: 51-75
- Critical: 76-100

### Baseline Calibration

- First 14 days of data establish the personal baseline.
- Before baseline is ready, no score is calculated (API returns `baseline_ready: false`).
- Baseline updates as a 4-week rolling average, so it adapts to sustained changes.
- Creators who deliberately work more (e.g., launch week) see their baseline shift over time, reducing false alarms.

### Configurability

Creators can adjust threshold sensitivity via `PUT /api/v2/wellness/risk-score/sensitivity`:

- `relaxed` — Factor trigger thresholds increase by 25% (harder to trigger)
- `normal` — Default thresholds (as specified above)
- `sensitive` — Factor trigger thresholds decrease by 25% (easier to trigger)

This multiplies the trigger thresholds, not the weights, preserving the relative importance of factors.

## Test Scenarios

From the PRD (US-E7-003):

| Scenario         | Input                                                                     | Expected Score | Expected Level |
| ---------------- | ------------------------------------------------------------------------- | -------------- | -------------- |
| A: Healthy       | 40hrs/week, regular hours, 2 rest days, baseline posts, normal engagement | ~15            | Low            |
| B: Moderate risk | 60hrs/week, 3x normal posting, stable engagement                          | ~40            | Moderate       |
| C: Critical      | 70hrs/week, irregular hours, 0 rest days, engagement dropping             | ~85            | Critical       |

## Consequences

**Positive:**

- Creators understand exactly why their score is what it is (full factor breakdown in API response)
- Easy to unit test with deterministic inputs
- No ML training pipeline required
- Configurable sensitivity avoids one-size-fits-all frustration

**Negative:**

- Less nuanced than an ML approach — may miss complex patterns
- Weight selection is somewhat arbitrary (can be tuned based on user feedback post-launch)
- 14-day cold start means new creators get no score initially

**Mitigation:**

- Weights can be adjusted in configuration without code changes
- ML approach can be layered on top later as training data accumulates
- During cold start, show wellness tips and resource library instead of score
