/**
 * Database helper utilities for backend tests.
 * Provides truncation and seeding for test isolation.
 */
import { getTestSupabaseClient } from './supabase-test-client';

/**
 * Tables to truncate between tests, ordered to respect FK constraints.
 * Uses CASCADE to handle dependencies.
 */
const USER_DATA_TABLES = [
  'content_analytics',
  'payment_events',
  'payment_retry_attempts',
  'payment_lock_events',
  'webhook_events',
  'unified_session_activities',
  'unified_sessions',
  'comments',
  'followers',
  'payments',
  'content',
  'users',
];

/**
 * Truncate all user-data tables for test isolation.
 * Uses service_role client to bypass RLS.
 */
export async function truncateAll(): Promise<void> {
  const client = getTestSupabaseClient();
  // Use raw SQL via rpc for efficient truncation
  const { error } = await client.rpc('truncate_test_tables');
  if (error) {
    // Fallback: truncate individually
    for (const table of USER_DATA_TABLES) {
      await client.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  }
}

/**
 * Seed a test user and return its data.
 */
export async function seedTestUser(overrides: Record<string, unknown> = {}) {
  const client = getTestSupabaseClient();
  const defaults = {
    nostr_pubkey: 'a'.repeat(64),
    username: 'testuser',
    display_name: 'Test User',
    role: 'creator',
    status: 'active',
    ...overrides,
  };
  const { data, error } = await client.from('users').insert(defaults).select().single();
  if (error) throw new Error(`seedTestUser failed: ${error.message}`);
  return data;
}

/**
 * Seed test content for a given creator.
 */
export async function seedTestContent(creatorId: string, overrides: Record<string, unknown> = {}) {
  const client = getTestSupabaseClient();
  const defaults = {
    creator_id: creatorId,
    title: 'Test Content',
    content_type: 'article',
    status: 'published',
    visibility: 'public',
    ...overrides,
  };
  const { data, error } = await client.from('content').insert(defaults).select().single();
  if (error) throw new Error(`seedTestContent failed: ${error.message}`);
  return data;
}

/**
 * Seed a test payment.
 */
export async function seedTestPayment(
  payerId: string,
  recipientId: string,
  overrides: Record<string, unknown> = {}
) {
  const client = getTestSupabaseClient();
  const defaults = {
    payer_id: payerId,
    recipient_id: recipientId,
    amount_sats: 1000,
    payment_type: 'tip',
    status: 'pending',
    ...overrides,
  };
  const { data, error } = await client.from('payments').insert(defaults).select().single();
  if (error) throw new Error(`seedTestPayment failed: ${error.message}`);
  return data;
}
