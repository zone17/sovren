/**
 * Discovery Service
 * Todo #568: Extracted from inline discovery.routes.ts logic
 *
 * Queries the `discovery_creators` view (pre-joined creator_profiles + users + creators).
 *
 * Patterns applied:
 *   - PostgREST filter escape (critical-patterns.md #11)
 *   - VIEW security_barrier (critical-patterns.md #12)
 */

import type {
  IDiscoveryService,
  SearchCreatorsParams,
} from '../../interfaces/discovery/IDiscoveryService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type {
  CreatorSearchResult,
  CreatorProfileDetail,
  DiscoveryResponse,
  DiscoveryCategory,
} from '@shared/types/discovery';
import { ServiceError, NotFoundError } from '../../utils/errors';

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

/**
 * Escape PostgREST filter metacharacters to prevent filter injection.
 * Characters `,`, `.`, `(`, `)`, `*`, `:`, `"` are PostgREST filter delimiters.
 * `%` and `_` are SQL LIKE wildcards that must also be escaped.
 * Backslash is escaped first to avoid double-escaping.
 */
export function escapePostgrestFilter(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/[,.*():%"_]/g, '\\$&');
}

export class DiscoveryService implements IDiscoveryService {
  private readonly db: ISupabaseClient;
  private readonly logger: ILogger;

  constructor(db: ISupabaseClient, logger: ILogger) {
    this.db = db;
    this.logger = logger;
  }

  async searchCreators(params: SearchCreatorsParams): Promise<DiscoveryResponse> {
    const { q, category, sortBy, page, limit } = params;
    const offset = (page - 1) * limit;

    let query = this.db.from('discovery_creators').select('*', { count: 'exact' });

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
      this.logger.error('Discovery search failed', { error: String(error) });
      throw new ServiceError('Discovery search failed');
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const creators: CreatorSearchResult[] = ((rows ?? []) as unknown as DiscoveryCreatorRow[]).map(
      row => ({
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
      })
    );

    return {
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
  }

  async getCreatorProfile(id: string): Promise<CreatorProfileDetail> {
    // Query creator with security_barrier filters (critical-patterns.md #12)
    const { data: row, error } = await this.db
      .from('discovery_creators')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !row) {
      throw new NotFoundError('Creator', { details: 'Creator not found' });
    }

    const creatorRow = row as unknown as DiscoveryCreatorRow;

    // Fetch subscription tiers and user data in parallel
    const [{ data: tiers }, { data: userData }] = await Promise.all([
      this.db
        .from('subscription_tiers')
        .select('id, name, price_sats, features')
        .eq('creator_id', id)
        .eq('active', true)
        .order('price_sats', { ascending: true }),
      this.db
        .from('users')
        .select('nostr_pubkey, lightning_address')
        .eq('id', creatorRow.user_id)
        .single(),
    ]);

    return {
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
      nostrPubkey: (userData?.nostr_pubkey as string) ?? '',
      lightningAddress: (userData?.lightning_address as string | null) ?? null,
      subscriptionTiers: (tiers ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        priceSats: t.price_sats,
        features: t.features ?? [],
      })),
    };
  }
}
