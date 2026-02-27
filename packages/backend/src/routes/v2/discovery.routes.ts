/**
 * Discovery API Routes (v2)
 * /api/v2/discovery/*
 * Slice 2: Discovery MVP — public creator search
 */

import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation-middleware';
import { readOnlyRateLimiter } from '../../middleware/rate-limit-middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { createApiResponse } from '../../utils/api-response';
import { getDatabase } from '../../config/database';
import type { CreatorSearchResult, DiscoveryResponse } from '@shared/types/discovery';

const router = Router();

router.use(readOnlyRateLimiter);

const searchCreatorsSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(['relevance', 'followers', 'newest']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get(
  '/creators',
  optionalAuth,
  validate({ query: searchCreatorsSchema }),
  asyncHandler(async (req, res) => {
    const { q, category, sort, page, limit } = req.query as z.infer<typeof searchCreatorsSchema>;
    const offset = (page - 1) * limit;
    const db = getDatabase().client;

    // Build query: 3-table JOIN (creator_profiles + users + creators)
    let query = db.from('creator_profiles').select(
      `
        id,
        bio,
        categories,
        created_at,
        users!creator_profiles_creator_id_fkey (
          display_name,
          username,
          avatar_url,
          nip05_verified
        ),
        creators!creators_user_id_fkey (
          follower_count,
          content_count,
          tags,
          verified
        )
      `,
      { count: 'exact' }
    );

    // Text search on display_name, username, bio
    if (q) {
      query = query.or(
        `bio.ilike.%${q}%,users.display_name.ilike.%${q}%,users.username.ilike.%${q}%`
      );
    }

    // Category filter via array overlap
    if (category) {
      query = query.contains('categories', [category]);
    }

    // Sort mapping
    switch (sort) {
      case 'followers':
        query = query.order('creators(follower_count)', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      default:
        // relevance — sort by follower_count as proxy
        query = query.order('creators(follower_count)', { ascending: false });
        break;
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: rows, count, error } = await query;

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to search creators',
        code: 'DISCOVERY_SEARCH_ERROR',
      });
      return;
    }

    // Map DB rows to CreatorSearchResult (snake_case → camelCase handled by createApiResponse)
    const creators: CreatorSearchResult[] = (rows ?? []).map((row: any) => {
      const user = row.users ?? {};
      const creator = row.creators ?? {};
      return {
        id: row.id,
        displayName: user.display_name ?? '',
        username: user.username ?? '',
        avatarUrl: user.avatar_url ?? null,
        bio: row.bio ?? '',
        nip05Verified: user.nip05_verified ?? false,
        categories: row.categories ?? [],
        tags: creator.tags ?? [],
        followerCount: creator.follower_count ?? 0,
        contentCount: creator.content_count ?? 0,
        verified: creator.verified ?? false,
        createdAt: row.created_at,
      };
    });

    const total = count ?? 0;
    const responseData: DiscoveryResponse = {
      creators,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    res.json(createApiResponse(req, responseData, { raw: true }));
  })
);

export default router;
