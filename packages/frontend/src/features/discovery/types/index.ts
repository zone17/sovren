export type {
  CreatorSearchResult,
  DiscoveryFilters,
  DiscoveryResponse,
} from '@shared/types/discovery';

import { DISCOVERY_CATEGORIES } from '@shared/types/discovery';

/** UI categories include "All" for clearing filter; backend enum excludes it. */
export const CATEGORIES = ['All', ...DISCOVERY_CATEGORIES] as const;
