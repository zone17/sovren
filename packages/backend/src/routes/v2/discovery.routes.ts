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

export { escapePostgrestFilter };
export default router;
