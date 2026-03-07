# Phase 7: API Specification

All endpoints require authentication via Bearer token (existing `authenticate` middleware) unless noted otherwise. Creator-only endpoints additionally require `requireCreator` middleware.

Base URLs:

- Wellness: `/api/v2/wellness`
- Content Shield: `/api/v2/shield`

---

## Wellness API (`/api/v2/wellness`)

### Work Patterns

#### `POST /api/v2/wellness/patterns`

Record a work activity event (manual logging).

**Auth**: Creator required

**Request Body**:

```json
{
  "type": "content_creation" | "engagement" | "management",
  "duration_mins": 45,
  "timestamp": "2026-02-15T10:30:00Z",
  "metadata": {
    "activity": "writing_article",
    "content_id": "optional-content-id"
  }
}
```

**Response** `201`:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "creator_id": "nostr-pubkey",
    "type": "content_creation",
    "duration_mins": 45,
    "timestamp": "2026-02-15T10:30:00Z",
    "created_at": "2026-02-15T10:31:00Z"
  }
}
```

**Validation**: Zod schema — type is enum, duration_mins is positive integer (max 1440), timestamp is ISO 8601.

**Rate Limit**: 100 requests/hour per creator.

---

#### `GET /api/v2/wellness/patterns`

Retrieve aggregated work patterns for a time period.

**Auth**: Creator required

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | `7d` \| `30d` \| `90d` | `7d` | Aggregation window |

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "period": "7d",
    "total_hours": 38.5,
    "daily_average_hours": 5.5,
    "breakdown": {
      "content_creation": { "hours": 18.0, "percentage": 46.8 },
      "engagement": { "hours": 12.5, "percentage": 32.5 },
      "management": { "hours": 8.0, "percentage": 20.7 }
    },
    "daily": [
      {
        "date": "2026-02-09",
        "total_hours": 6.2,
        "content_creation_mins": 180,
        "engagement_mins": 120,
        "management_mins": 72
      }
    ],
    "rest_days": 2,
    "baseline_established": true
  }
}
```

---

#### `GET /api/v2/wellness/patterns/heatmap`

Return hourly heatmap data showing work activity density.

**Auth**: Creator required

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | `7d` \| `30d` | `7d` | Heatmap window |

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "period": "7d",
    "heatmap": [
      {
        "day": 0,
        "hour": 9,
        "intensity": 0.85,
        "total_mins": 180
      }
    ],
    "peak_hours": [9, 10, 14, 15],
    "quiet_hours": [0, 1, 2, 3, 4, 5, 6]
  }
}
```

`day`: 0 (Monday) through 6 (Sunday). `hour`: 0-23. `intensity`: 0.0-1.0 normalized.

---

### Burnout Risk Score

#### `GET /api/v2/wellness/risk-score`

Return the current burnout risk assessment.

**Auth**: Creator required

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "score": 42,
    "level": "moderate",
    "factors": {
      "work_hours_trend": { "value": 0.35, "weight": 0.25, "detail": "Working 115% of baseline" },
      "posting_frequency": { "value": 0.5, "weight": 0.2, "detail": "Posting 140% of 4-week avg" },
      "engagement_drop": { "value": 0.2, "weight": 0.2, "detail": "Engagement at 85% of avg" },
      "hour_regularity": { "value": 0.6, "weight": 0.15, "detail": "High schedule variance" },
      "rest_day_deficit": {
        "value": 0.45,
        "weight": 0.2,
        "detail": "1 rest day this week (target: 2)"
      }
    },
    "baseline_ready": true,
    "baseline_days_remaining": 0,
    "history": [
      { "week": "2026-W06", "score": 38, "level": "moderate" },
      { "week": "2026-W05", "score": 25, "level": "low" }
    ],
    "recommendations": [
      "Consider taking tomorrow off — you've worked 6 consecutive days",
      "Your posting frequency is above sustainable pace"
    ],
    "updated_at": "2026-02-15T00:00:00Z"
  }
}
```

**Levels**: `low` (0-25), `moderate` (26-50), `high` (51-75), `critical` (76-100).

If baseline not yet established (<14 days of data), `baseline_ready` is `false`, `baseline_days_remaining` shows days left, and `score` is `null`.

---

#### `PUT /api/v2/wellness/risk-score/sensitivity`

Adjust burnout score sensitivity thresholds.

**Auth**: Creator required

**Request Body**:

```json
{
  "sensitivity": "relaxed" | "normal" | "sensitive"
}
```

- `relaxed` — Factor trigger thresholds increase by 25% (harder to trigger alerts)
- `normal` — Default thresholds
- `sensitive` — Factor trigger thresholds decrease by 25% (easier to trigger alerts)

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "sensitivity": "relaxed",
    "updated_at": "2026-02-15T10:00:00Z"
  }
}
```

Historical scores remain unchanged; only future score computations use the new sensitivity.

---

### Sustainable Scheduling

#### `GET /api/v2/wellness/schedule/recommendations`

Return optimal posting frequency and best times.

**Auth**: Creator required

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "recommended_posts_per_week": 4,
    "current_posts_per_week": 7,
    "optimal_days": ["monday", "wednesday", "friday", "sunday"],
    "optimal_hours": [10, 14],
    "productive_windows": [
      { "day": "monday", "start": "09:00", "end": "12:00", "energy_score": 0.9 }
    ],
    "content_buffer_days": 3,
    "buffer_threshold": 5,
    "buffer_status": "below_threshold"
  }
}
```

---

#### `GET /api/v2/wellness/buffer-depth`

Return content buffer depth (scheduled future content).

**Auth**: Creator required

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "buffer_days": 3,
    "scheduled_posts": 4,
    "threshold": 5,
    "status": "below_threshold",
    "next_scheduled": "2026-02-16T10:00:00Z",
    "last_scheduled": "2026-02-18T14:00:00Z"
  }
}
```

---

### Creator Boundaries

#### `GET /api/v2/wellness/boundaries`

Retrieve current boundary configuration.

**Auth**: Creator required

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "focus_hours": {
      "enabled": true,
      "start": "22:00",
      "end": "08:00",
      "timezone": "America/New_York",
      "days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    },
    "weekly_engagement_budget_mins": 120,
    "engagement_used_mins": 85,
    "dnd_mode": {
      "active": false,
      "auto_response_enabled": true,
      "auto_response_template": "I'm currently in focus mode. I'll respond when I'm back!"
    },
    "availability_status": "hidden",
    "availability_public": false,
    "notification_batching": true
  }
}
```

**Defaults**: `availability_status: "hidden"`, `availability_public: false` (BR-006b: opt-in).

---

#### `PUT /api/v2/wellness/boundaries`

Save boundary configuration.

**Auth**: Creator required

**Request Body**:

```json
{
  "focus_hours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "timezone": "America/New_York",
    "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
  },
  "weekly_engagement_budget_mins": 120,
  "dnd_mode": {
    "auto_response_enabled": true,
    "auto_response_template": "I'm currently in focus mode."
  },
  "availability_status": "creating",
  "notification_batching": true
}
```

**Response** `200`: Same shape as GET response with updated values.

---

### Wellness Pulse Check-Ins

#### `POST /api/v2/wellness/pulse`

Record a wellness pulse check-in.

**Auth**: Creator required

**Request Body**:

```json
{
  "energy": 4,
  "motivation": 3,
  "stress": 2
}
```

All values 1-5 integer scale (1=lowest, 5=highest; for stress 1=low stress, 5=high stress).

**Response** `201`:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "energy": 4,
    "motivation": 3,
    "stress": 2,
    "composite_score": 3.67,
    "created_at": "2026-02-15T10:00:00Z"
  }
}
```

`composite_score` = `(energy + motivation + (6 - stress)) / 3` (normalized so higher = better).

---

#### `GET /api/v2/wellness/pulse/history`

Retrieve pulse check-in history.

**Auth**: Creator required

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | `30d` \| `90d` \| `all` | `90d` | History window |

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "uuid",
        "energy": 4,
        "motivation": 3,
        "stress": 2,
        "composite_score": 3.67,
        "created_at": "2026-02-15T10:00:00Z"
      }
    ],
    "trend": {
      "direction": "improving",
      "average_composite": 3.45,
      "change_from_previous_period": 0.22
    }
  }
}
```

---

#### `GET /api/v2/wellness/benchmark`

Anonymous aggregate benchmark stats. No auth required (returns only aggregated, anonymized data).

**Auth**: Optional (no individual data regardless)

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "average_weekly_hours": 35.2,
    "average_composite_score": 3.1,
    "percentile_breakdowns": {
      "work_hours": { "p25": 20, "p50": 35, "p75": 48 },
      "composite_score": { "p25": 2.5, "p50": 3.1, "p75": 3.8 }
    },
    "sample_size": 1250,
    "updated_at": "2026-02-15T00:00:00Z"
  }
}
```

When `sample_size < 10` (k-anonymity minimum per BR-007b), returns `data: null` instead of aggregate stats:

```json
{
  "success": true,
  "data": null,
  "message": "Insufficient participants for anonymous benchmarking (minimum: 10)"
}
```

Returns the full response above only when `sample_size >= 10`.

---

#### `DELETE /api/v2/wellness/pulse`

Delete all pulse check-in history for the authenticated creator.

**Auth**: Creator required

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "deleted_count": 24
  }
}
```

---

#### `DELETE /api/v2/wellness/data`

Delete all wellness data for the authenticated creator.

**Auth**: Creator required

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "deleted": {
      "wellness_snapshots": 52,
      "creator_work_patterns": 365,
      "pulse_checkins": 24,
      "boundary_config": 1
    }
  }
}
```

---

## Content Shield API (`/api/v2/shield`)

### Provenance

#### `GET /api/v2/shield/provenance/:contentId`

Return the provenance chain for a content piece.

**Auth**: Optional (provenance is public by design)

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "content_id": "content-uuid",
    "author_pubkey": "nostr-hex-pubkey",
    "created_at": "2026-02-15T10:00:00Z",
    "signature": "nostr-event-signature-hex",
    "nostr_event_id": "nostr-event-id-hex",
    "content_hash": "sha256-hex",
    "relay_confirmations": [
      { "relay": "wss://relay.damus.io", "confirmed_at": "2026-02-15T10:00:05Z" },
      { "relay": "wss://relay.snort.social", "confirmed_at": "2026-02-15T10:00:08Z" }
    ],
    "verification_status": "verified",
    "nip05_verified": true
  }
}
```

---

#### `GET /api/v2/shield/provenance/:contentId/certificate`

Export provenance certificate for legal/DMCA use.

**Auth**: Creator required (only content owner can export certificate)

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | `json` \| `pdf` | `json` | Export format |

**Response** `200` (JSON) or `200` (PDF binary with `Content-Type: application/pdf`):

```json
{
  "success": true,
  "data": {
    "certificate": {
      "title": "Content Provenance Certificate",
      "content_id": "content-uuid",
      "author": {
        "pubkey": "nostr-hex-pubkey",
        "nip05": "creator@sovren.dev",
        "display_name": "CreatorName"
      },
      "provenance": {
        "created_at": "2026-02-15T10:00:00Z",
        "signature": "nostr-event-signature-hex",
        "nostr_event_id": "nostr-event-id-hex",
        "content_hash": "sha256-hex",
        "relay_confirmations": []
      },
      "generated_at": "2026-02-15T12:00:00Z",
      "verification_url": "https://sovren.dev/verify/content-uuid"
    }
  }
}
```

---

### Fingerprinting

#### `POST /api/v2/shield/fingerprint`

Manually register a fingerprint for existing content.

**Auth**: Creator required

**Request Body**:

```json
{
  "content_id": "content-uuid",
  "content_type": "text" | "image",
  "content_data": "The full text content..." | "base64-encoded-image-data"
}
```

For text: content is the raw text. For images: content is base64-encoded image data.

**Response** `201`:

```json
{
  "success": true,
  "data": {
    "content_id": "content-uuid",
    "fingerprints": [{ "hash_type": "simhash", "hash_value": "hex-hash-string" }],
    "created_at": "2026-02-15T10:00:00Z"
  }
}
```

**Rate Limit**: 50 requests/hour per creator.

---

#### `GET /api/v2/shield/fingerprints/:creatorId`

Get a creator's fingerprint registry summary.

**Auth**: Creator required (can only view own registry)

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "total_fingerprinted": 142,
    "total_content": 200,
    "coverage_percentage": 71.0,
    "fingerprints": [
      {
        "content_id": "content-uuid",
        "content_title": "My Article Title",
        "hash_type": "simhash",
        "hash_value": "hex-hash-string",
        "created_at": "2026-02-15T10:00:00Z"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### `POST /api/v2/shield/compare`

Compare a hash against a creator's fingerprint registry.

**Auth**: Creator required

**Request Body**:

```json
{
  "hash_type": "simhash" | "phash",
  "hash_value": "hex-hash-string",
  "threshold": 0.70
}
```

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "content_id": "content-uuid",
        "content_title": "My Original Article",
        "similarity": 0.92,
        "match_level": "derivative",
        "hash_type": "simhash"
      }
    ],
    "total_compared": 142
  }
}
```

`match_level`: `exact_copy` (>0.95), `derivative` (0.70-0.95), `coincidental` (<0.70).

---

### Alerts

#### `GET /api/v2/shield/alerts`

Get creator's copy detection alerts.

**Auth**: Creator required

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `new` \| `reviewed` \| `resolved` \| `false_positive` \| `reported` | `new` | Filter by status |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page |

**Response** `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "alert-uuid",
      "original_content_id": "content-uuid",
      "original_title": "My Original Article",
      "detected_copy_url": "nostr:nevent1...",
      "detected_author_pubkey": "hex-pubkey",
      "similarity_score": 0.92,
      "match_level": "derivative",
      "hash_type": "simhash",
      "status": "new",
      "detected_at": "2026-02-15T10:00:00Z",
      "relay": "wss://relay.damus.io"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

#### `GET /api/v2/shield/alerts/:id`

Get alert detail with side-by-side comparison data.

**Auth**: Creator required

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "id": "alert-uuid",
    "original": {
      "content_id": "content-uuid",
      "title": "My Original Article",
      "excerpt": "First 500 chars of original...",
      "published_at": "2026-02-10T10:00:00Z",
      "provenance": { "signature": "...", "nostr_event_id": "..." }
    },
    "detected": {
      "url": "nostr:nevent1...",
      "author_pubkey": "hex-pubkey",
      "excerpt": "First 500 chars of detected copy...",
      "published_at": "2026-02-14T15:00:00Z"
    },
    "comparison": {
      "similarity_score": 0.92,
      "match_level": "derivative",
      "hash_type": "simhash",
      "highlighted_sections": []
    },
    "status": "new",
    "detected_at": "2026-02-15T10:00:00Z"
  }
}
```

---

#### `PUT /api/v2/shield/alerts/:id`

Update alert status.

**Auth**: Creator required

**Request Body**:

```json
{
  "status": "reviewed" | "resolved" | "false_positive" | "reported"
}
```

**Validation**: Status transitions allowed:

- `new` -> `reviewed`, `false_positive`
- `reviewed` -> `resolved`, `false_positive`, `reported`
- `reported` -> `resolved`

**Response** `200`:

```json
{
  "success": true,
  "data": {
    "id": "alert-uuid",
    "status": "reviewed",
    "updated_at": "2026-02-15T12:00:00Z"
  }
}
```

---

### DMCA Reports

#### `POST /api/v2/shield/alerts/:id/dmca-report`

Generate a DMCA report for an alert.

**Auth**: Creator required

**Query Params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | `json` \| `pdf` | `json` | Export format |

**Response** `201`:

```json
{
  "success": true,
  "data": {
    "report": {
      "title": "DMCA Takedown Report",
      "generated_at": "2026-02-15T12:00:00Z",
      "claimant": {
        "pubkey": "nostr-hex-pubkey",
        "nip05": "creator@sovren.dev",
        "display_name": "CreatorName"
      },
      "original_content": {
        "content_id": "content-uuid",
        "published_at": "2026-02-10T10:00:00Z",
        "provenance_signature": "nostr-sig-hex",
        "nostr_event_id": "event-id-hex",
        "content_hash": "sha256-hex",
        "relay_confirmations": []
      },
      "infringing_content": {
        "url": "nostr:nevent1...",
        "author_pubkey": "hex-pubkey",
        "detected_at": "2026-02-15T10:00:00Z",
        "similarity_score": 0.92,
        "match_level": "derivative"
      },
      "verification_url": "https://sovren.dev/verify/content-uuid"
    }
  }
}
```

**Rate Limit**: 10 requests/hour per creator (prevents abuse).

---

## Error Responses

All endpoints return errors in consistent format:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Human-readable error description",
  "details": [{ "field": "energy", "message": "Must be between 1 and 5" }],
  "timestamp": "2026-02-15T10:00:00Z"
}
```

Standard error codes:
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body/params failed Zod validation |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Authenticated but not authorized (e.g., not content owner) |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Invalid state transition (e.g., alert status) |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `BASELINE_NOT_READY` | 422 | Burnout score requested before 14-day baseline |
| `INTERNAL_ERROR` | 500 | Server error |
