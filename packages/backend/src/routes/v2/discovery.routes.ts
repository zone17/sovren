// @ts-nocheck
/**
 * Discovery API Routes (v2)
 * /api/v2/discovery/*
 * Slice 2: Discovery MVP — public creator search
 *
 * Queries the `discovery_creators` view (pre-joined creator_profiles + users + creators).
 */

import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { expensiveOperationRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { ServiceError } from '../../utils/errors';
import { getDatabase } from '../../config/database';
import logger from '../../lib/logger';
import { DISCOVERY_CATEGORIES } from '@shared/types/discovery';
import type {
  CreatorSearchResult,
  CreatorProfileDetail,
  DiscoveryCategory,
  DiscoveryResponse,
} from '@shared/types/discovery';

const router = Router();

router.use(expensiveOperationRateLimiter);

/**
 * Escape PostgREST filter metacharacters to prevent filter injection.
 * Characters `,`, `.`, `(`, `)`, `*`, `:`, `"` are PostgREST filter delimiters.
 * `%` and `_` are SQL LIKE wildcards that must also be escaped.
 * Backslash is escaped first to avoid double-escaping.
 */
function escapePostgrestFilter(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/[,.*():%"_]/g, '\\$&');
}

/** Row shape returned by the discovery_creators view (post-COALESCE). */
interface DiscoveryCreatorRow {
  id: string;
  bio: string;
  categories: DiscoveryCategory[];
  created_at: string;
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  nip05_verified: boolean;
  follower_count: number;
  content_count: number;
  tags: string[];
  verified: boolean;
}

const searchCreatorsSchema = z.object({
  q: z.string().min(2).max(100).optional(),
  category: z.enum(DISCOVERY_CATEGORIES).optional(),
  sortBy: z.enum(['relevance', 'followers', 'newest']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get(
  '/creators',
  optionalAuth,
  validate({ query: searchCreatorsSchema }),
  asyncHandler(async (req, res) => {
    const { q, category, sortBy, page, limit } = req.query as z.infer<typeof searchCreatorsSchema>;
    const offset = (page - 1) * limit;
    const db = getDatabase().client;

    let query = db.from('discovery_creators').select('*', { count: 'exact' });

    // Text search across flat view columns — sanitized input
    if (q) {
      const escaped = escapePostgrestFilter(q);
      query = query.or(
        `bio.ilike.%${escaped}%,display_name.ilike.%${escaped}%,username.ilike.%${escaped}%`
      );
    }

    // Category filter via array overlap
    if (category) {
      query = query.contains('categories', [category]);
    }

    // Sort: newest by created_at, everything else by follower_count
    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('follower_count', { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: rows, count, error } = await query;

    if (error) {
      logger.error('Discovery search failed', { error: String(error) });
      throw new ServiceError('Discovery search failed');
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const creators: CreatorSearchResult[] = ((rows ?? []) as DiscoveryCreatorRow[]).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      username: row.username,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      nip05Verified: row.nip05_verified,
      categories: row.categories ?? [],
      tags: row.tags,
      followerCount: row.follower_count,
      contentCount: row.content_count,
      verified: row.verified,
      createdAt: row.created_at,
    }));

    const responseData: DiscoveryResponse = {
      creators,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    res.json(createApiResponse(req, responseData, { raw: true }));
  })
);

// ── GET /creators/:id — Individual creator profile ──

const creatorIdParamSchema = z.object({
  id: z.string().uuid(),
});

router.get(
  '/creators/:id',
  optionalAuth,
  validate({ params: creatorIdParamSchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof creatorIdParamSchema>;
    const db = getDatabase().client;

    // Query creator with security_barrier filters (critical-patterns.md #12)
    const { data: row, error } = await db
      .from('discovery_creators')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !row) {
      throw new ServiceError('Creator not found', 404);
    }

    const creatorRow = row as DiscoveryCreatorRow;

    // Fetch subscription tiers for this creator
    const { data: tiers } = await db
      .from('subscription_tiers')
      .select('id, name, price_sats, features')
      .eq('creator_id', id)
      .eq('active', true)
      .order('price_sats', { ascending: true });

    // Fetch nostr pubkey and lightning address from users table
    const { data: userData } = await db
      .from('users')
      .select('nostr_pubkey, lightning_address')
      .eq('id', creatorRow.user_id)
      .single();

    const profile: CreatorProfileDetail = {
      id: creatorRow.id,
      displayName: creatorRow.display_name,
      username: creatorRow.username,
      avatarUrl: creatorRow.avatar_url,
      bio: creatorRow.bio,
      nip05Verified: creatorRow.nip05_verified,
      categories: creatorRow.categories ?? [],
      tags: creatorRow.tags,
      followerCount: creatorRow.follower_count,
      contentCount: creatorRow.content_count,
      verified: creatorRow.verified,
      createdAt: creatorRow.created_at,
      nostrPubkey: userData?.nostr_pubkey ?? '',
      lightningAddress: userData?.lightning_address ?? null,
      subscriptionTiers: (tiers ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        priceSats: t.price_sats,
        features: t.features ?? [],
      })),
    };

    res.json(createApiResponse(req, profile, { raw: true }));
  })
);

export { escapePostgrestFilter };
export default router;
