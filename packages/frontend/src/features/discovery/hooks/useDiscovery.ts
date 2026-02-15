import { useCallback, useEffect, useState } from 'react';
import type { DiscoveryCreator, DiscoveryFilters } from '../types';

/**
 * Mock data for discovery page.
 * In production, this would call apiClient.searchContent() and related endpoints.
 */
const MOCK_CREATORS: DiscoveryCreator[] = [
  {
    id: 'creator-1',
    display_name: 'Sophia',
    username: 'sophia_art',
    avatar_url: '',
    bio: 'Digital illustrator creating art about the Bitcoin future. NOSTR native since 2023.',
    nip05_verified: true,
    stats: { follower_count: 1500, post_count: 45, total_supporters: 200 },
    subscription_tiers: [
      { id: 'tier-1', name: 'Basic', price_sats: 1000, features: ['Access to weekly posts'] },
      { id: 'tier-2', name: 'Premium', price_sats: 5000, features: ['All posts', 'Monthly Q&A', 'Early access'] },
    ],
    tags: ['art', 'bitcoin', 'illustration'],
    featured_content_title: 'The Future of Digital Art on NOSTR',
  },
  {
    id: 'creator-2',
    display_name: 'Alex Writes',
    username: 'alexwrites',
    avatar_url: '',
    bio: 'Longform writer covering Bitcoin culture, economics, and the sovereign individual. 10+ years in journalism.',
    nip05_verified: true,
    stats: { follower_count: 3200, post_count: 120, total_supporters: 450 },
    subscription_tiers: [
      { id: 'tier-3', name: 'Reader', price_sats: 2000, features: ['Weekly newsletter', 'Archive access'] },
      { id: 'tier-4', name: 'Inner Circle', price_sats: 10000, features: ['All content', 'Private chat', 'Book previews'] },
    ],
    tags: ['writing', 'bitcoin', 'economics'],
    featured_content_title: 'Why Lightning Changes Everything',
  },
  {
    id: 'creator-3',
    display_name: 'Dev Podcast',
    username: 'devpod',
    avatar_url: '',
    bio: 'Weekly podcast about building on NOSTR and Lightning Network. Interviews with protocol developers.',
    nip05_verified: false,
    stats: { follower_count: 800, post_count: 52, total_supporters: 90 },
    subscription_tiers: [
      { id: 'tier-5', name: 'Listener', price_sats: 500, features: ['Early episode access'] },
      { id: 'tier-6', name: 'Patron', price_sats: 3000, features: ['Early access', 'Bonus episodes', 'Discord'] },
    ],
    tags: ['podcast', 'development', 'nostr'],
    featured_content_title: 'Building a Relay from Scratch',
  },
  {
    id: 'creator-4',
    display_name: 'Lightning Music',
    username: 'lightningmusic',
    avatar_url: '',
    bio: 'Independent musician distributing music directly via Lightning. No labels, no middlemen.',
    nip05_verified: true,
    stats: { follower_count: 2100, post_count: 30, total_supporters: 320 },
    subscription_tiers: [
      { id: 'tier-7', name: 'Fan', price_sats: 1500, features: ['New releases first'] },
      { id: 'tier-8', name: 'Superfan', price_sats: 8000, features: ['Unreleased tracks', 'Studio sessions', 'Credits'] },
    ],
    tags: ['music', 'lightning', 'independent'],
    featured_content_title: 'Album: Decentralized Beats',
  },
  {
    id: 'creator-5',
    display_name: 'NOSTR Academy',
    username: 'nostracademy',
    avatar_url: '',
    bio: 'Educational content about NOSTR protocol, key management, and building decentralized apps.',
    nip05_verified: true,
    stats: { follower_count: 4500, post_count: 80, total_supporters: 600 },
    subscription_tiers: [
      { id: 'tier-9', name: 'Student', price_sats: 1000, features: ['Course access'] },
      { id: 'tier-10', name: 'Developer', price_sats: 5000, features: ['All courses', 'Code reviews', 'Mentorship'] },
    ],
    tags: ['education', 'nostr', 'development'],
    featured_content_title: 'NOSTR 101: Getting Started Guide',
  },
  {
    id: 'creator-6',
    display_name: 'Pixel Photographer',
    username: 'pixelphoto',
    avatar_url: '',
    bio: 'Street photography and visual storytelling. Capturing the world one pixel at a time.',
    nip05_verified: false,
    stats: { follower_count: 950, post_count: 200, total_supporters: 75 },
    subscription_tiers: [
      { id: 'tier-11', name: 'Gallery', price_sats: 800, features: ['Hi-res downloads'] },
      { id: 'tier-12', name: 'Collector', price_sats: 4000, features: ['Full archive', 'Prints', 'Behind the lens'] },
    ],
    tags: ['photography', 'art', 'visual'],
    featured_content_title: 'Tokyo in Monochrome',
  },
];

const CATEGORIES = [
  'All',
  'Art',
  'Writing',
  'Music',
  'Podcast',
  'Education',
  'Photography',
  'Development',
  'Bitcoin',
];

interface UseDiscoveryReturn {
  creators: DiscoveryCreator[];
  categories: string[];
  filters: DiscoveryFilters;
  isLoading: boolean;
  error: string | null;
  setFilters: (filters: Partial<DiscoveryFilters>) => void;
}

export function useDiscovery(): UseDiscoveryReturn {
  const [creators, setCreators] = useState<DiscoveryCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<DiscoveryFilters>({
    category: 'All',
    sortBy: 'relevance',
    query: '',
  });

  const setFilters = useCallback((update: Partial<DiscoveryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...update }));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Simulate API delay
    const timer = setTimeout(() => {
      try {
        let filtered = [...MOCK_CREATORS];

        // Category filter
        if (filters.category !== 'All') {
          filtered = filtered.filter((c) =>
            c.tags.some((t) => t.toLowerCase() === filters.category.toLowerCase())
          );
        }

        // Search filter
        if (filters.query.trim()) {
          const q = filters.query.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.display_name.toLowerCase().includes(q) ||
              c.bio.toLowerCase().includes(q) ||
              c.tags.some((t) => t.toLowerCase().includes(q))
          );
        }

        // Sort
        switch (filters.sortBy) {
          case 'followers':
            filtered.sort((a, b) => b.stats.follower_count - a.stats.follower_count);
            break;
          case 'newest':
            filtered.reverse();
            break;
          default:
            // relevance -- keep default order
            break;
        }

        setCreators(filtered);
      } catch {
        setError('Failed to load creators');
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [filters]);

  return { creators, categories: CATEGORIES, filters, isLoading, error, setFilters };
}
