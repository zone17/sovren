# Sovren Database Schema

**Version:** 2.0.0
**Date:** 2026-02-11
**Database:** PostgreSQL 15 (Supabase)
**Phase:** 1 - Architecture & Design

## Overview

The Sovren database consists of 8+ core tables organized across four domains: User Management, Content Management, Payment/Monetization, and Social/Analytics. The schema is defined in the baseline migration at `supabase/migrations/baseline/001_baseline_schema.sql` with incremental migrations for payment events, session management, and webhook logging.

## Entity Relationship Diagram (DBML)

```dbml
// ============================================================
// SOVREN DATABASE SCHEMA - DBML
// Database: PostgreSQL 15 (Supabase)
// ============================================================

// ------ USER MANAGEMENT ------

Table users {
  id uuid [pk, default: `uuid_generate_v4()`]
  nostr_pubkey varchar(64) [unique, not null, note: "NOSTR hex public key (primary identity)"]

  // Profile
  username varchar(50) [unique, note: "Regex: ^[a-zA-Z0-9_-]{3,50}$"]
  display_name varchar(100)
  bio text
  avatar_url text
  banner_url text
  website_url text
  nip05_verified boolean [default: false]

  // Lightning Network
  lightning_address varchar(255) [note: "e.g., creator@sovren.com"]
  lnurl_pay_enabled boolean [default: true]
  lightning_wallet_connected boolean [default: false]

  // Roles and Status
  role varchar(20) [default: 'user', note: "CHECK: user, creator, supporter, admin"]
  status varchar(20) [default: 'active', note: "CHECK: active, inactive, suspended, banned"]
  email_verified boolean [default: false]
  kyc_verified boolean [default: false]

  // Timestamps
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
  last_login_at timestamptz

  // Creator Monetization Stats (denormalized for performance)
  total_earnings_sats bigint [default: 0]
  total_supporters integer [default: 0]
  avg_payment_sats integer [default: 0]

  indexes {
    nostr_pubkey [name: "idx_users_nostr_pubkey"]
    username [name: "idx_users_username"]
    role [name: "idx_users_role"]
    status [name: "idx_users_status"]
    created_at [name: "idx_users_created_at"]
    lightning_address [name: "idx_users_lightning_address"]
  }

  Note: 'Core user accounts with NOSTR and Lightning Network integration. RLS enabled.'
}

// ------ CONTENT MANAGEMENT ------

Table content {
  id uuid [pk, default: `uuid_generate_v4()`]
  creator_id uuid [not null, ref: > users.id]

  // Content Metadata
  title varchar(255) [not null]
  content_type varchar(50) [not null, note: "CHECK: article, video, audio, image, livestream, course"]
  description text
  content_url text
  thumbnail_url text

  // Content Status
  status varchar(20) [default: 'draft', note: "CHECK: draft, published, archived, deleted"]
  visibility varchar(20) [default: 'public', note: "CHECK: public, private, supporters_only, paid"]

  // Monetization
  is_monetized boolean [default: false]
  price_sats integer [default: 0]
  payment_required boolean [default: false]

  // Engagement Metrics (denormalized counters)
  view_count integer [default: 0]
  like_count integer [default: 0]
  comment_count integer [default: 0]
  share_count integer [default: 0]

  // Discovery
  tags text[] [note: "PostgreSQL array for GIN index"]
  category varchar(50)
  language varchar(10) [default: 'en']

  // Timestamps
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
  published_at timestamptz

  // Full-text search
  search_vector tsvector [note: "Auto-populated by trigger from title + description + tags"]

  indexes {
    creator_id [name: "idx_content_creator_id"]
    status [name: "idx_content_status"]
    visibility [name: "idx_content_visibility"]
    content_type [name: "idx_content_type"]
    created_at [name: "idx_content_created_at"]
    published_at [name: "idx_content_published_at"]
    category [name: "idx_content_category"]
    (tags) [type: gin, name: "idx_content_tags"]
    (search_vector) [type: gin, name: "idx_content_search"]
  }

  Note: 'Content created by users. Supports full-text search via tsvector. RLS enabled.'
}

// ------ PAYMENT / MONETIZATION ------

Table payments {
  id uuid [pk, default: `uuid_generate_v4()`]

  // Payment Parties
  payer_id uuid [ref: > users.id, note: "SET NULL on delete"]
  recipient_id uuid [not null, ref: > users.id]
  content_id uuid [ref: > content.id, note: "SET NULL on delete"]

  // Payment Details
  amount_sats bigint [not null, note: "CHECK: > 0"]
  currency varchar(10) [default: 'BTC']
  payment_type varchar(20) [not null, note: "CHECK: tip, subscription, one_time, commission"]

  // Lightning Network Details
  payment_hash varchar(64) [unique, note: "BOLT11 payment hash"]
  payment_request text [note: "BOLT11 invoice string"]
  preimage varchar(64) [note: "Payment proof"]

  // Status and Metadata
  status varchar(20) [default: 'pending', note: "CHECK: pending, paid, failed, refunded, expired"]
  description text
  memo text

  // Timestamps
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]
  paid_at timestamptz
  expires_at timestamptz

  // Analytics
  payment_method varchar(50) [note: "lightning, onchain, etc."]
  fee_sats integer [default: 0]

  indexes {
    payer_id [name: "idx_payments_payer_id"]
    recipient_id [name: "idx_payments_recipient_id"]
    content_id [name: "idx_payments_content_id"]
    status [name: "idx_payments_status"]
    created_at [name: "idx_payments_created_at"]
    payment_hash [name: "idx_payments_payment_hash"]
  }

  Note: 'Lightning Network payments between users. RLS enabled.'
}

Table payment_events {
  id uuid [pk, default: `uuid_generate_v4()`]
  payment_id uuid [not null, ref: > payments.id]
  event_type varchar(50) [not null, note: "created, processing, confirmed, failed, refunded, expired"]
  event_data jsonb
  previous_status varchar(20)
  new_status varchar(20)
  created_at timestamptz [default: `now()`]

  indexes {
    payment_id [name: "idx_payment_events_payment_id"]
    event_type [name: "idx_payment_events_event_type"]
    created_at [name: "idx_payment_events_created_at"]
  }

  Note: 'Immutable audit log of payment state transitions.'
}

Table webhook_event_log {
  id uuid [pk, default: `uuid_generate_v4()`]
  webhook_id uuid
  event_type varchar(100) [not null]
  payload jsonb [not null]
  delivery_status varchar(20) [default: 'pending', note: "CHECK: pending, delivered, failed, retrying"]
  delivery_attempts integer [default: 0]
  last_attempt_at timestamptz
  response_status integer
  response_body text
  created_at timestamptz [default: `now()`]

  indexes {
    webhook_id [name: "idx_webhook_event_log_webhook_id"]
    event_type [name: "idx_webhook_event_log_event_type"]
    delivery_status [name: "idx_webhook_event_log_delivery_status"]
  }

  Note: 'Tracks webhook delivery attempts and responses.'
}

// ------ SOCIAL / ENGAGEMENT ------

Table followers {
  id uuid [pk, default: `uuid_generate_v4()`]
  follower_id uuid [not null, ref: > users.id]
  following_id uuid [not null, ref: > users.id]
  created_at timestamptz [default: `now()`]
  notification_enabled boolean [default: true]

  indexes {
    follower_id [name: "idx_followers_follower_id"]
    following_id [name: "idx_followers_following_id"]
    (follower_id, following_id) [unique]
  }

  Note: 'Social following relationships. CONSTRAINT: no self-follow. RLS enabled.'
}

Table comments {
  id uuid [pk, default: `uuid_generate_v4()`]
  content_id uuid [not null, ref: > content.id]
  user_id uuid [not null, ref: > users.id]
  parent_comment_id uuid [ref: > comments.id, note: "Threading support"]
  comment_text text [not null, note: "CHECK: length > 0 AND length <= 2000"]
  status varchar(20) [default: 'active', note: "CHECK: active, hidden, deleted, moderated"]
  like_count integer [default: 0]
  reply_count integer [default: 0]
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]

  indexes {
    content_id [name: "idx_comments_content_id"]
    user_id [name: "idx_comments_user_id"]
    parent_comment_id [name: "idx_comments_parent_id"]
  }

  Note: 'Threaded comments on content. RLS enabled.'
}

// ------ ANALYTICS ------

Table content_analytics {
  id uuid [pk, default: `uuid_generate_v4()`]
  content_id uuid [not null, ref: > content.id]
  user_id uuid [ref: > users.id]

  // Event tracking
  event_type varchar(50) [not null, note: "view, like, share, comment, payment"]
  event_data jsonb

  // Context
  user_agent text
  ip_address inet
  referrer text
  session_id varchar(255)

  // Geographic
  country varchar(2)
  region varchar(100)
  city varchar(100)

  created_at timestamptz [default: `now()`]

  indexes {
    (content_id, event_type, created_at) [name: "idx_analytics_content_event_time"]
    (user_id, created_at) [name: "idx_analytics_user_time"]
  }

  Note: 'Analytics events for content engagement tracking. RLS enabled.'
}

// ------ SESSION MANAGEMENT ------

Table user_sessions {
  id uuid [pk, default: `uuid_generate_v4()`]
  user_id uuid [not null, ref: > users.id]
  session_token varchar(255) [unique, not null]
  refresh_token varchar(255) [unique]
  device_info jsonb
  ip_address inet
  user_agent text
  is_active boolean [default: true]
  last_activity_at timestamptz [default: `now()`]
  expires_at timestamptz [not null]
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]

  indexes {
    user_id [name: "idx_user_sessions_user_id"]
    session_token [name: "idx_user_sessions_session_token"]
    (is_active, expires_at) [name: "idx_user_sessions_active_expiry"]
  }

  Note: 'Unified session management for multi-device support.'
}

// ------ MIGRATION INFRASTRUCTURE ------

Table migration_history {
  id uuid [pk, default: `uuid_generate_v4()`]
  migration_name varchar(255) [unique, not null]
  applied_at timestamptz [default: `now()`]
  rollback_at timestamptz
  description text
  execution_time_ms integer
  applied_by varchar(100) [default: `current_user`]
  status varchar(20) [default: 'success', note: "CHECK: success, failed, rolled_back"]
  error_message text
  created_at timestamptz [default: `now()`]
  updated_at timestamptz [default: `now()`]

  Note: 'Tracks all database migrations and their status.'
}

Table migration_performance {
  id uuid [pk, default: `uuid_generate_v4()`]
  migration_name varchar(255) [not null]
  table_name varchar(100)
  operation_type varchar(50) [note: "CREATE, ALTER, DROP, INDEX"]
  execution_time_ms integer
  rows_affected integer
  before_size_bytes bigint
  after_size_bytes bigint
  created_at timestamptz [default: `now()`]

  Note: 'Performance metrics for database migrations.'
}
```

## Triggers

| Trigger                         | Table    | Event                | Function                         | Purpose                                                |
| ------------------------------- | -------- | -------------------- | -------------------------------- | ------------------------------------------------------ |
| `trigger_users_updated_at`      | users    | BEFORE UPDATE        | `update_updated_at()`            | Auto-set updated_at                                    |
| `trigger_content_updated_at`    | content  | BEFORE UPDATE        | `update_updated_at()`            | Auto-set updated_at                                    |
| `trigger_payments_updated_at`   | payments | BEFORE UPDATE        | `update_updated_at()`            | Auto-set updated_at                                    |
| `trigger_comments_updated_at`   | comments | BEFORE UPDATE        | `update_updated_at()`            | Auto-set updated_at                                    |
| `trigger_content_search_vector` | content  | BEFORE INSERT/UPDATE | `update_content_search_vector()` | Auto-populate tsvector from title + description + tags |

## Row-Level Security (RLS) Policies

| Table    | Policy                       | Operation | Rule                                                        |
| -------- | ---------------------------- | --------- | ----------------------------------------------------------- |
| users    | `users_select_public_or_own` | SELECT    | Own profile or non-admin users visible                      |
| users    | `users_update_own`           | UPDATE    | Only own profile                                            |
| content  | `content_select_public`      | SELECT    | Public content, own content, or supporters-only if follower |
| content  | `content_insert_own`         | INSERT    | Only own content (creator_id = auth.uid())                  |
| content  | `content_update_own`         | UPDATE    | Only own content                                            |
| payments | `payments_select_own`        | SELECT    | Payer or recipient                                          |
| payments | `payments_insert_own`        | INSERT    | Payer or recipient                                          |
| comments | `comments_select_public`     | SELECT    | Active comments only                                        |
| comments | `comments_insert_own`        | INSERT    | Own comments only                                           |
| comments | `comments_update_own`        | UPDATE    | Own comments only                                           |

## PostgreSQL Extensions

| Extension   | Purpose                                |
| ----------- | -------------------------------------- |
| `uuid-ossp` | UUID generation (`uuid_generate_v4()`) |
| `pgcrypto`  | Cryptographic functions                |

## Migration History

| Migration                                              | Date       | Description                                                                 |
| ------------------------------------------------------ | ---------- | --------------------------------------------------------------------------- |
| `001_baseline_schema`                                  | 2024-12-29 | Complete baseline: users, content, payments, followers, comments, analytics |
| `20251023_add_invoice_expiration`                      | 2025-10-23 | Invoice expiration handling                                                 |
| `20251023_add_payment_lock_function`                   | 2025-10-23 | Payment locking for race condition prevention                               |
| `20251023233811_add_payment_events_table`              | 2025-10-23 | Immutable payment state transition audit log                                |
| `20251023234155_add_payment_state_transition_function` | 2025-10-23 | Payment state machine enforcement at DB level                               |
| `20251023235000_add_payment_retry_support`             | 2025-10-23 | Retry tracking for failed payments                                          |
| `20251024000000_add_webhook_event_log`                 | 2025-10-24 | Webhook delivery tracking and retry log                                     |
| `20251026000000_unified_session_management`            | 2025-10-26 | Multi-device session management tables                                      |

## Index Summary

**Total indexes:** 25+

Key performance indexes:

- `idx_users_nostr_pubkey` - Primary lookup for authentication
- `idx_content_search` (GIN) - Full-text search on content
- `idx_content_tags` (GIN) - Tag-based content discovery
- `idx_payments_payment_hash` - Lightning payment verification
- `idx_analytics_content_event_time` - Time-series analytics queries
- `idx_user_sessions_active_expiry` - Session cleanup and validation
