-- Comprehensive Seed Data for Sovren
-- Populates all feature areas: content, payments, analytics, followers,
-- notifications, provenance, and business invoices.
--
-- Prerequisites: baseline schema + all migrations applied.
-- Run: psql "$DATABASE_URL" -f packages/backend/src/database/seed-comprehensive.sql
--
-- Keeps the 3 existing test users (Alice, Bob, Charlie) and adds rich data
-- around them so every dashboard has something to display.

BEGIN;

-- ============================================================================
-- USERS (upsert — keep existing rows, fill missing fields)
-- ============================================================================

-- Alice: creator, primary test user
INSERT INTO users (nostr_pubkey, role, display_name, username, bio, nip05_verified, status, avatar_url, lightning_address)
VALUES (
  '5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743',
  'creator', 'Alice Lightning', 'alice_creator',
  'Bitcoin educator & Lightning Network advocate. Writing about decentralized creator tools and self-sovereign monetization.',
  true, 'active',
  'https://robohash.org/alice.png?set=set4',
  'alice@getalby.com'
)
ON CONFLICT (nostr_pubkey) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  lightning_address = EXCLUDED.lightning_address;

-- Bob: supporter
INSERT INTO users (nostr_pubkey, role, display_name, username, bio, status, avatar_url)
VALUES (
  'b812567c95eb1bb6b8c639720cdcaf9c514152b0dc150fad330a58cf34ce47f1',
  'supporter', 'Bob the Builder', 'bob_supporter',
  'Early Bitcoin adopter. Passionate about supporting independent creators on NOSTR.',
  'active',
  'https://robohash.org/bob.png?set=set4'
)
ON CONFLICT (nostr_pubkey) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url;

-- Charlie: creator, power user
INSERT INTO users (nostr_pubkey, role, display_name, username, bio, nip05_verified, status, avatar_url, lightning_address)
VALUES (
  'ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26',
  'creator', 'Charlie NOSTR', 'charlie_nostr',
  'Open-source developer building the future of social media. NOSTR protocol contributor and privacy advocate.',
  true, 'active',
  'https://robohash.org/charlie.png?set=set4',
  'charlie@walletofsatoshi.com'
)
ON CONFLICT (nostr_pubkey) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  lightning_address = EXCLUDED.lightning_address;

-- ============================================================================
-- Resolve user UUIDs into variables for FK references
-- ============================================================================

-- Use a DO block to capture UUIDs and insert dependent rows
DO $$
DECLARE
  alice_id UUID;
  bob_id UUID;
  charlie_id UUID;
  -- Content IDs for Alice
  a_content_1 UUID;
  a_content_2 UUID;
  a_content_3 UUID;
  a_content_4 UUID;
  a_content_5 UUID;
  a_content_6 UUID; -- paid
  a_content_7 UUID; -- paid
  -- Content IDs for Charlie
  c_content_1 UUID;
  c_content_2 UUID;
  c_content_3 UUID;
  c_content_4 UUID;
  c_content_5 UUID;
  c_content_6 UUID; -- paid
  c_content_7 UUID; -- paid
BEGIN
  SELECT id INTO alice_id FROM users WHERE nostr_pubkey = '5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743';
  SELECT id INTO bob_id FROM users WHERE nostr_pubkey = 'b812567c95eb1bb6b8c639720cdcaf9c514152b0dc150fad330a58cf34ce47f1';
  SELECT id INTO charlie_id FROM users WHERE nostr_pubkey = 'ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26';

  -- ============================================================================
  -- CONTENT: Alice's articles (5 public + 2 paid)
  -- ============================================================================

  -- Clean existing content for idempotency
  DELETE FROM content WHERE creator_id = alice_id;
  DELETE FROM content WHERE creator_id = charlie_id;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), alice_id,
     'Getting Started with Bitcoin Lightning',
     'article',
     'A beginner-friendly guide to setting up your first Lightning wallet, making payments, and understanding payment channels.',
     'published', 'public', false, 0, 342, 28, 12, 5,
     ARRAY['bitcoin', 'lightning', 'tutorial', 'beginner'],
     'education',
     NOW() - INTERVAL '14 days')
  RETURNING id INTO a_content_1;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), alice_id,
     'Why Creators Need NOSTR',
     'article',
     'Social media platforms own your audience. NOSTR gives it back. Here is why every creator should pay attention to protocol-native distribution.',
     'published', 'public', false, 0, 891, 67, 31, 18,
     ARRAY['nostr', 'creators', 'decentralization', 'social-media'],
     'opinion',
     NOW() - INTERVAL '10 days')
  RETURNING id INTO a_content_2;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), alice_id,
     'Building a Sustainable Income on Lightning',
     'article',
     'Practical strategies for creators to earn sats consistently through tips, subscriptions, and paid content.',
     'published', 'public', false, 0, 523, 45, 19, 8,
     ARRAY['monetization', 'lightning', 'income', 'strategy'],
     'business',
     NOW() - INTERVAL '7 days')
  RETURNING id INTO a_content_3;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), alice_id,
     'Understanding Zaps: Social Payments on NOSTR',
     'article',
     'Zaps combine social interaction with real value transfer. Learn how they work and why they matter for the creator economy.',
     'published', 'supporters_only', false, 0, 198, 34, 8, 3,
     ARRAY['zaps', 'nostr', 'payments', 'social'],
     'education',
     NOW() - INTERVAL '5 days')
  RETURNING id INTO a_content_4;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), alice_id,
     'Self-Sovereign Identity for Content Creators',
     'article',
     'Your identity should not depend on a company. NIP-05 verification and cryptographic keys give creators true ownership.',
     'published', 'public', false, 0, 276, 22, 6, 4,
     ARRAY['identity', 'nostr', 'nip-05', 'sovereignty'],
     'technology',
     NOW() - INTERVAL '2 days')
  RETURNING id INTO a_content_5;

  -- Paid content
  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), alice_id,
     'Advanced Lightning Routing: Maximizing Payment Success',
     'article',
     'Deep dive into multi-path payments, channel rebalancing, and fee optimization for Lightning node operators.',
     'published', 'paid', true, 5000, 87, 15, 4, 1,
     ARRAY['lightning', 'routing', 'advanced', 'node-operations'],
     'technology',
     NOW() - INTERVAL '8 days')
  RETURNING id INTO a_content_6;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), alice_id,
     'Creator Tax Guide: Bitcoin Earnings in 2026',
     'article',
     'How to track, report, and optimize taxes on Lightning earnings. Includes template spreadsheet for record-keeping.',
     'published', 'paid', true, 10000, 156, 42, 11, 7,
     ARRAY['taxes', 'bitcoin', 'finance', 'creator-tools'],
     'business',
     NOW() - INTERVAL '3 days')
  RETURNING id INTO a_content_7;

  -- ============================================================================
  -- CONTENT: Charlie's articles (5 public + 2 paid)
  -- ============================================================================

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), charlie_id,
     'NOSTR Protocol Deep Dive: Event Kinds Explained',
     'article',
     'A comprehensive reference to NOSTR event kinds, from kind 0 metadata to kind 30023 long-form content.',
     'published', 'public', false, 0, 1245, 89, 42, 23,
     ARRAY['nostr', 'protocol', 'developer', 'reference'],
     'technology',
     NOW() - INTERVAL '12 days')
  RETURNING id INTO c_content_1;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), charlie_id,
     'Building Your First NOSTR Client in Rust',
     'article',
     'Step-by-step tutorial: from connecting to relays to publishing and reading events with nostr-sdk.',
     'published', 'public', false, 0, 678, 52, 18, 12,
     ARRAY['nostr', 'rust', 'tutorial', 'programming'],
     'technology',
     NOW() - INTERVAL '9 days')
  RETURNING id INTO c_content_2;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), charlie_id,
     'Privacy-First Social Media: A Technical Manifesto',
     'article',
     'Why metadata resistance matters, how relay selection affects privacy, and what we can learn from Tor and Signal.',
     'published', 'public', false, 0, 432, 38, 15, 9,
     ARRAY['privacy', 'social-media', 'security', 'manifesto'],
     'opinion',
     NOW() - INTERVAL '6 days')
  RETURNING id INTO c_content_3;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), charlie_id,
     'Relay Economics: Running Infrastructure for NOSTR',
     'article',
     'The costs, challenges, and business models behind running NOSTR relays. Data from 6 months operating a public relay.',
     'published', 'supporters_only', false, 0, 312, 29, 11, 6,
     ARRAY['nostr', 'relays', 'infrastructure', 'economics'],
     'business',
     NOW() - INTERVAL '4 days')
  RETURNING id INTO c_content_4;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), charlie_id,
     'NIP-57 Lightning Zaps: Implementation Guide',
     'article',
     'Complete implementation walkthrough for adding Zap support to your NOSTR client, including LNURL-pay integration.',
     'published', 'public', false, 0, 567, 44, 22, 10,
     ARRAY['nostr', 'nip-57', 'zaps', 'implementation'],
     'technology',
     NOW() - INTERVAL '1 day')
  RETURNING id INTO c_content_5;

  -- Paid content
  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), charlie_id,
     'NOSTR Relay Security Hardening Playbook',
     'article',
     'Protect your relay from spam, abuse, and DDoS attacks. Production-tested configurations and monitoring setup.',
     'published', 'paid', true, 8000, 145, 31, 9, 4,
     ARRAY['nostr', 'security', 'relay', 'devops'],
     'technology',
     NOW() - INTERVAL '11 days')
  RETURNING id INTO c_content_6;

  INSERT INTO content (id, creator_id, title, content_type, description, status, visibility, is_monetized, price_sats, view_count, like_count, comment_count, share_count, tags, category, published_at)
  VALUES
    (uuid_generate_v4(), charlie_id,
     'Encrypted DMs on NOSTR: NIP-44 Deep Dive',
     'article',
     'How NIP-44 improves encrypted messaging, the cryptographic primitives involved, and migration from NIP-04.',
     'published', 'paid', true, 3000, 203, 26, 7, 3,
     ARRAY['nostr', 'encryption', 'nip-44', 'privacy'],
     'technology',
     NOW() - INTERVAL '7 days')
  RETURNING id INTO c_content_7;

  -- ============================================================================
  -- PAYMENTS: Bob tips Alice, subscribes to Charlie, purchases content
  -- ============================================================================

  -- Clean existing payments for idempotency
  DELETE FROM payments WHERE payer_id = bob_id AND recipient_id IN (alice_id, charlie_id);

  -- Bob tips Alice 1000 sats
  INSERT INTO payments (payer_id, recipient_id, content_id, amount_sats, payment_type, payment_hash, status, description, paid_at, fee_sats)
  VALUES (
    bob_id, alice_id, a_content_2, 1000, 'tip',
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    'paid', 'Great article on NOSTR for creators!',
    NOW() - INTERVAL '9 days', 1
  );

  -- Bob tips Alice 5000 sats
  INSERT INTO payments (payer_id, recipient_id, content_id, amount_sats, payment_type, payment_hash, status, description, paid_at, fee_sats)
  VALUES (
    bob_id, alice_id, a_content_3, 5000, 'tip',
    'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b3',
    'paid', 'This income guide is exactly what I needed',
    NOW() - INTERVAL '6 days', 2
  );

  -- Bob subscribes to Charlie (monthly, 10000 sats)
  INSERT INTO payments (payer_id, recipient_id, amount_sats, payment_type, payment_hash, status, description, paid_at, fee_sats)
  VALUES (
    bob_id, charlie_id, 10000, 'subscription',
    'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b4c5',
    'paid', 'Monthly subscription to Charlie NOSTR',
    NOW() - INTERVAL '11 days', 5
  );

  -- Bob purchases Alice's paid content (one-time)
  INSERT INTO payments (payer_id, recipient_id, content_id, amount_sats, payment_type, payment_hash, status, description, paid_at, fee_sats)
  VALUES (
    bob_id, alice_id, a_content_6, 5000, 'one_time',
    'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b4c5d6',
    'paid', 'Purchase: Advanced Lightning Routing',
    NOW() - INTERVAL '7 days', 2
  );

  -- Bob purchases Alice's tax guide
  INSERT INTO payments (payer_id, recipient_id, content_id, amount_sats, payment_type, payment_hash, status, description, paid_at, fee_sats)
  VALUES (
    bob_id, alice_id, a_content_7, 10000, 'one_time',
    'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b4c5d6e7',
    'paid', 'Purchase: Creator Tax Guide 2026',
    NOW() - INTERVAL '2 days', 4
  );

  -- Bob purchases Charlie's relay security playbook
  INSERT INTO payments (payer_id, recipient_id, content_id, amount_sats, payment_type, payment_hash, status, description, paid_at, fee_sats)
  VALUES (
    bob_id, charlie_id, c_content_6, 8000, 'one_time',
    'f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b4c5d6e7f8',
    'paid', 'Purchase: NOSTR Relay Security Playbook',
    NOW() - INTERVAL '10 days', 3
  );

  -- ============================================================================
  -- FOLLOWERS: Bob follows Alice and Charlie
  -- ============================================================================

  DELETE FROM followers WHERE follower_id = bob_id AND following_id IN (alice_id, charlie_id);

  INSERT INTO followers (follower_id, following_id, created_at, notification_enabled)
  VALUES
    (bob_id, alice_id, NOW() - INTERVAL '15 days', true),
    (bob_id, charlie_id, NOW() - INTERVAL '12 days', true);

  -- ============================================================================
  -- CONTENT ANALYTICS: View and engagement events for Alice's content
  -- ============================================================================

  -- Clean existing analytics for these content items
  DELETE FROM content_analytics WHERE content_id IN (a_content_1, a_content_2, a_content_3, a_content_4, a_content_5, a_content_6, a_content_7);
  DELETE FROM content_analytics WHERE content_id IN (c_content_1, c_content_2, c_content_3, c_content_4, c_content_5, c_content_6, c_content_7);

  -- View events for Alice's top article
  INSERT INTO content_analytics (content_id, user_id, event_type, event_data, country, created_at)
  VALUES
    (a_content_2, bob_id, 'view', '{"source": "feed"}', 'US', NOW() - INTERVAL '10 days'),
    (a_content_2, bob_id, 'like', '{}', 'US', NOW() - INTERVAL '10 days' + INTERVAL '5 minutes'),
    (a_content_2, NULL, 'view', '{"source": "search"}', 'DE', NOW() - INTERVAL '9 days'),
    (a_content_2, NULL, 'view', '{"source": "share"}', 'JP', NOW() - INTERVAL '8 days'),
    (a_content_2, NULL, 'view', '{"source": "feed"}', 'US', NOW() - INTERVAL '7 days'),
    (a_content_2, NULL, 'view', '{"source": "feed"}', 'BR', NOW() - INTERVAL '6 days'),
    (a_content_2, NULL, 'like', '{}', 'BR', NOW() - INTERVAL '6 days' + INTERVAL '2 minutes'),
    (a_content_3, bob_id, 'view', '{"source": "feed"}', 'US', NOW() - INTERVAL '7 days'),
    (a_content_3, bob_id, 'like', '{}', 'US', NOW() - INTERVAL '7 days' + INTERVAL '3 minutes'),
    (a_content_3, NULL, 'view', '{"source": "search"}', 'GB', NOW() - INTERVAL '5 days'),
    (a_content_1, bob_id, 'view', '{"source": "profile"}', 'US', NOW() - INTERVAL '13 days'),
    (a_content_1, NULL, 'view', '{"source": "feed"}', 'CA', NOW() - INTERVAL '12 days'),
    (a_content_5, bob_id, 'view', '{"source": "feed"}', 'US', NOW() - INTERVAL '1 day'),
    (a_content_5, bob_id, 'like', '{}', 'US', NOW() - INTERVAL '1 day' + INTERVAL '4 minutes');

  -- View events for Charlie's content
  INSERT INTO content_analytics (content_id, user_id, event_type, event_data, country, created_at)
  VALUES
    (c_content_1, bob_id, 'view', '{"source": "feed"}', 'US', NOW() - INTERVAL '11 days'),
    (c_content_1, bob_id, 'like', '{}', 'US', NOW() - INTERVAL '11 days' + INTERVAL '2 minutes'),
    (c_content_1, NULL, 'view', '{"source": "search"}', 'DE', NOW() - INTERVAL '10 days'),
    (c_content_1, NULL, 'view', '{"source": "feed"}', 'US', NOW() - INTERVAL '9 days'),
    (c_content_2, bob_id, 'view', '{"source": "feed"}', 'US', NOW() - INTERVAL '8 days'),
    (c_content_5, bob_id, 'view', '{"source": "feed"}', 'US', NOW() - INTERVAL '12 hours'),
    (c_content_5, bob_id, 'like', '{}', 'US', NOW() - INTERVAL '12 hours' + INTERVAL '1 minute');

  -- ============================================================================
  -- NOTIFICATIONS
  -- ============================================================================

  -- Clean existing notifications for these users
  DELETE FROM notifications WHERE user_id IN (alice_id, charlie_id);

  INSERT INTO notifications (user_id, actor_id, type, title, body, entity_type, entity_id, created_at)
  VALUES
    (alice_id, bob_id, 'new_follower', 'New follower', 'Bob the Builder started following you', 'user', bob_id, NOW() - INTERVAL '15 days'),
    (alice_id, bob_id, 'payment_received', 'Tip received', 'Bob the Builder tipped you 1,000 sats on "Why Creators Need NOSTR"', 'payment', NULL, NOW() - INTERVAL '9 days'),
    (alice_id, bob_id, 'payment_received', 'Tip received', 'Bob the Builder tipped you 5,000 sats on "Building a Sustainable Income on Lightning"', 'payment', NULL, NOW() - INTERVAL '6 days'),
    (alice_id, bob_id, 'new_comment', 'New comment', 'Bob the Builder commented on your article', 'content', a_content_2, NOW() - INTERVAL '8 days'),
    (charlie_id, bob_id, 'new_follower', 'New follower', 'Bob the Builder started following you', 'user', bob_id, NOW() - INTERVAL '12 days'),
    (charlie_id, bob_id, 'payment_received', 'Subscription', 'Bob the Builder subscribed to your content (10,000 sats/month)', 'payment', NULL, NOW() - INTERVAL '11 days');

  -- ============================================================================
  -- PROVENANCE RECORDS (Shield feature)
  -- ============================================================================

  DELETE FROM provenance_records WHERE creator_id = alice_id OR creator_id = charlie_id;

  INSERT INTO provenance_records (content_id, creator_id, content_hash, signature, nostr_event_id, status, metadata, created_at)
  VALUES (
    a_content_2, alice_id,
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'sig_alice_nostr_why_creators_need_nostr_2026',
    'evt_a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1',
    'active',
    '{"verification_method": "nostr_event", "relay_count": 5}',
    NOW() - INTERVAL '10 days'
  );

  INSERT INTO provenance_records (content_id, creator_id, content_hash, signature, nostr_event_id, status, metadata, created_at)
  VALUES (
    c_content_1, charlie_id,
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    'sig_charlie_nostr_protocol_deep_dive_2026',
    'evt_b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2',
    'active',
    '{"verification_method": "nostr_event", "relay_count": 8}',
    NOW() - INTERVAL '12 days'
  );

  -- ============================================================================
  -- BUSINESS INVOICES
  -- ============================================================================

  DELETE FROM business_invoices WHERE creator_id = alice_id OR creator_id = charlie_id;

  INSERT INTO business_invoices (creator_id, client_name, line_items, total_sats, status, due_date, created_at)
  VALUES (
    alice_id,
    'NOSTR Relay Operators Association',
    '[{"description": "Lightning Network Workshop (2 hours)", "amount_sats": 50000, "quantity": 1}, {"description": "Written summary and slides", "amount_sats": 15000, "quantity": 1}]'::jsonb,
    65000,
    'paid',
    CURRENT_DATE - INTERVAL '5 days',
    NOW() - INTERVAL '20 days'
  );

  INSERT INTO business_invoices (creator_id, client_name, line_items, total_sats, status, due_date, created_at)
  VALUES (
    charlie_id,
    'Bitcoin Magazine',
    '[{"description": "Technical article: NOSTR Relay Architecture", "amount_sats": 100000, "quantity": 1}]'::jsonb,
    100000,
    'sent',
    CURRENT_DATE + INTERVAL '10 days',
    NOW() - INTERVAL '3 days'
  );

  -- ============================================================================
  -- WELLNESS DATA (extends existing seed)
  -- ============================================================================

  -- Clean and re-insert for Charlie
  DELETE FROM creator_work_patterns WHERE creator_id = '5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743';
  DELETE FROM creator_work_patterns WHERE creator_id = 'ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26';

  -- Alice work patterns (last 7 days)
  INSERT INTO creator_work_patterns (creator_id, date, content_time_mins, engagement_time_mins, management_time_mins, post_count, first_activity_at, last_activity_at)
  VALUES
    ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '1 day', 120, 45, 30, 2, NOW() - INTERVAL '1 day 8 hours', NOW() - INTERVAL '1 day 2 hours'),
    ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '2 days', 90, 60, 15, 1, NOW() - INTERVAL '2 days 9 hours', NOW() - INTERVAL '2 days 3 hours'),
    ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '3 days', 150, 30, 45, 3, NOW() - INTERVAL '3 days 7 hours', NOW() - INTERVAL '3 days 1 hour'),
    ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '5 days', 60, 90, 20, 1, NOW() - INTERVAL '5 days 10 hours', NOW() - INTERVAL '5 days 4 hours'),
    ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '6 days', 180, 40, 35, 4, NOW() - INTERVAL '6 days 6 hours', NOW() - INTERVAL '6 days 1 hour');

  -- Charlie work patterns
  INSERT INTO creator_work_patterns (creator_id, date, content_time_mins, engagement_time_mins, management_time_mins, post_count, first_activity_at, last_activity_at)
  VALUES
    ('ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26', CURRENT_DATE - INTERVAL '1 day', 200, 30, 20, 1, NOW() - INTERVAL '1 day 10 hours', NOW() - INTERVAL '1 day 3 hours'),
    ('ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26', CURRENT_DATE - INTERVAL '2 days', 180, 45, 25, 2, NOW() - INTERVAL '2 days 8 hours', NOW() - INTERVAL '2 days 2 hours'),
    ('ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26', CURRENT_DATE - INTERVAL '4 days', 240, 60, 30, 3, NOW() - INTERVAL '4 days 7 hours', NOW() - INTERVAL '4 days 1 hour');

  -- Wellness snapshots
  DELETE FROM wellness_snapshots WHERE creator_id IN (
    '5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743',
    'ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26'
  );

  INSERT INTO wellness_snapshots (creator_id, overall_score, burnout_risk, snapshot_data)
  VALUES
    ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', 75, 'low',
     '{"work_hours_7d": 14.5, "rest_days": 2, "content_pct": 55, "engagement_pct": 25, "management_pct": 20}'),
    ('ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26', 58, 'moderate',
     '{"work_hours_7d": 21.8, "rest_days": 1, "content_pct": 70, "engagement_pct": 18, "management_pct": 12}');

  -- ============================================================================
  -- COMMENTS on content
  -- ============================================================================

  DELETE FROM comments WHERE user_id = bob_id;

  INSERT INTO comments (content_id, user_id, comment_text, status, like_count, created_at)
  VALUES
    (a_content_2, bob_id, 'This is exactly the push I needed to move my newsletter to NOSTR. The censorship resistance angle is compelling.', 'active', 3, NOW() - INTERVAL '8 days'),
    (a_content_3, bob_id, 'The subscription model breakdown was really helpful. Already set up tiered access on my page.', 'active', 5, NOW() - INTERVAL '5 days'),
    (c_content_1, bob_id, 'Best technical reference for NOSTR event kinds I have found. Bookmarked for daily use.', 'active', 7, NOW() - INTERVAL '10 days');

END $$;

COMMIT;
