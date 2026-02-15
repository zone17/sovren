import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import type { SubscriptionTier, UserProfile } from '../services/api/types';

// Mock creator data (mirrors API contract from api-spec.md section 3.1)
const MOCK_PROFILES: Record<string, UserProfile> = {
  'creator-1': {
    id: 'creator-1',
    nostr_pubkey: 'a'.repeat(64),
    username: 'sophia_art',
    display_name: 'Sophia',
    bio: 'Digital illustrator creating art about the Bitcoin future. NOSTR native since 2023. My work explores the intersection of technology, freedom, and human expression.',
    avatar_url: '',
    role: 'creator',
    nip05_verified: true,
    lightning_address: 'sophia@sovren.app',
    stats: { follower_count: 1500, post_count: 45, total_supporters: 200 },
    subscription_tiers: [
      { id: 'tier-1', name: 'Basic', price_sats: 1000, features: ['Access to weekly posts', 'Community chat'] },
      { id: 'tier-2', name: 'Premium', price_sats: 5000, features: ['All posts', 'Monthly Q&A', 'Early access', 'High-res downloads'] },
    ],
    created_at: '2025-01-15T00:00:00Z',
  },
};

type ProfileTab = 'content' | 'about' | 'tiers';

interface TierCardProps {
  tier: SubscriptionTier;
  onSubscribe: (tierId: string) => void;
}

const TierCard: React.FC<TierCardProps> = ({ tier, onSubscribe }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-amber-400 transition-colors">
    <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
    <div className="mt-2">
      <span className="text-3xl font-bold text-gray-900">
        {tier.price_sats.toLocaleString()}
      </span>
      <span className="text-gray-500 ml-1">sats/month</span>
    </div>
    <ul className="mt-4 space-y-2" role="list" aria-label={`${tier.name} features`}>
      {tier.features.map((feature, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
          <svg
            className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
    <Button
      onClick={() => onSubscribe(tier.id)}
      variant="lightning"
      className="w-full mt-6"
      aria-label={`Subscribe to ${tier.name} tier for ${tier.price_sats} sats per month`}
    >
      Subscribe
    </Button>
  </div>
);

const CreatorProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('tiers');
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    // Simulate API call
    const timer = setTimeout(() => {
      const found = MOCK_PROFILES[id];
      if (found) {
        setProfile(found);
      } else {
        setError('Creator not found');
      }
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [id]);

  const handleFollow = useCallback(() => {
    setIsFollowing((prev) => !prev);
  }, []);

  const handleSubscribe = useCallback((_tierId: string) => {
    // In production: navigate to payment flow or open modal
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" role="status">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
        <span className="sr-only">Loading creator profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" role="alert">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Creator Not Found</h2>
          <p className="mt-2 text-gray-600">{error || 'This creator profile does not exist.'}</p>
        </div>
      </div>
    );
  }

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'tiers', label: 'Subscription Tiers' },
    { key: 'content', label: 'Content' },
    { key: 'about', label: 'About' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div
              className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
              aria-hidden="true"
            >
              {profile.display_name.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{profile.display_name}</h1>
                {profile.nip05_verified && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    NIP-05 Verified
                  </span>
                )}
              </div>
              <p className="text-gray-500 mt-1">@{profile.username}</p>
              <p className="mt-3 text-gray-700 max-w-2xl">{profile.bio}</p>

              {/* Stats */}
              <div className="mt-4 flex items-center gap-6 text-sm">
                <div>
                  <span className="font-semibold text-gray-900">
                    {profile.stats.follower_count.toLocaleString()}
                  </span>
                  <span className="text-gray-500 ml-1">followers</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">{profile.stats.post_count}</span>
                  <span className="text-gray-500 ml-1">posts</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">
                    {profile.stats.total_supporters}
                  </span>
                  <span className="text-gray-500 ml-1">supporters</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-3">
                <Button
                  onClick={handleFollow}
                  variant={isFollowing ? 'outline' : 'default'}
                  size="sm"
                  aria-pressed={isFollowing}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
                {profile.lightning_address && (
                  <Button variant="lightning" size="sm">
                    Tip Creator
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav
            className="mt-8 flex border-b border-gray-200 -mb-px"
            aria-label="Profile sections"
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                aria-selected={activeTab === tab.key}
                role="tab"
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'tiers' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Support {profile.display_name}</h2>
            <p className="text-gray-600 mb-6">
              Choose a subscription tier to access premium content and support this creator.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {profile.subscription_tiers.map((tier) => (
                <TierCard key={tier.id} tier={tier} onSubscribe={handleSubscribe} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="text-center py-12">
            <p className="text-lg font-semibold text-gray-900">Content Coming Soon</p>
            <p className="mt-2 text-gray-600">
              Subscribe to see {profile.display_name}'s latest posts and exclusive content.
            </p>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">About</h2>
            <p className="text-gray-700 whitespace-pre-line">{profile.bio}</p>
            <div className="mt-6 space-y-3">
              {profile.lightning_address && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Lightning Address:</span>
                  <code className="px-2 py-1 bg-gray-100 rounded text-gray-800 text-xs">
                    {profile.lightning_address}
                  </code>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Joined:</span>
                <span className="text-gray-800">
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                  })}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorProfilePage;
