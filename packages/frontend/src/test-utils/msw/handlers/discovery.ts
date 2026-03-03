import { http, HttpResponse } from 'msw';
import { jsonOk, TEST_TIMESTAMP } from './helpers';
import type { CreatorProfileDetail, CreatorSearchResult } from '@shared/types/discovery';

const sampleCreator: CreatorSearchResult = {
  id: 'creator-1',
  displayName: 'Test Creator',
  username: 'testcreator',
  avatarUrl: null,
  bio: 'A creator on the Sovren platform.',
  nip05Verified: true,
  categories: ['Art'],
  tags: ['bitcoin', 'art'],
  followerCount: 1200,
  contentCount: 42,
  verified: true,
  createdAt: TEST_TIMESTAMP,
};

const sampleCreatorProfile: CreatorProfileDetail = {
  ...sampleCreator,
  nostrPubkey: 'npub1testcreator0000000000000000000000000000000000000000000000',
  lightningAddress: 'testcreator@getalby.com',
  subscriptionTiers: [
    {
      id: 'tier-1',
      name: 'Supporter',
      priceSats: 5000,
      features: ['Early access', 'Behind the scenes'],
    },
    {
      id: 'tier-2',
      name: 'Premium',
      priceSats: 15000,
      features: ['Early access', 'Behind the scenes', 'Exclusive content', '1-on-1 chat'],
    },
  ],
};

export const discoveryHandlers = [
  /** GET /api/v2/discovery/creators — list/search creators */
  http.get('/api/v2/discovery/creators', () => {
    return jsonOk({
      creators: [sampleCreator],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
  }),

  /** GET /api/v2/discovery/creators/:id — single creator profile */
  http.get('/api/v2/discovery/creators/:id', ({ params }) => {
    const id = params.id as string;

    // Return 404 for the well-known nonexistent UUID
    if (id === '00000000-0000-0000-0000-000000000000') {
      return HttpResponse.json({ success: false, error: 'Creator not found' }, { status: 404 });
    }

    return jsonOk({ ...sampleCreatorProfile, id });
  }),
];
