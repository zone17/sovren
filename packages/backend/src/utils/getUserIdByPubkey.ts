/**
 * Shared utility: resolve a NOSTR pubkey to the internal user UUID.
 * Extracted from FollowService, NotificationPersistenceService, and CommentsService (#703).
 *
 * Uses a module-level TTLCache singleton so all consumers share one cache.
 */

import type { ISupabaseClient } from '../interfaces/shared/ISupabaseClient';
import { UnauthorizedError } from './errors';
import { TTLCache } from './ttl-cache';

// Module-level singleton cache shared across all callers
const userIdCache = new TTLCache<string, string>({
  ttlMs: 60_000,
  maxSize: 1000,
});

/**
 * Resolve a NOSTR pubkey to the internal UUID. Cached for 60s.
 * Throws UnauthorizedError if no user record exists for the pubkey.
 */
export async function getUserIdByPubkey(db: ISupabaseClient, pubkey: string): Promise<string> {
  const cached = userIdCache.get(pubkey);
  if (cached) return cached;

  interface UserIdRow {
    id: string;
  }

  const { data, error } = await db
    .from<UserIdRow>('users')
    .select('id')
    .eq('nostr_pubkey', pubkey)
    .single();

  if (error || !data) {
    throw new UnauthorizedError('User profile not found');
  }

  // #732: data is typed as UserIdRow via the generic — no unsafe cast needed.
  const userId = data.id;
  userIdCache.set(pubkey, userId);
  return userId;
}
