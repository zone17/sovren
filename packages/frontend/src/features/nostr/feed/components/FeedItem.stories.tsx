/**
 * FeedItem Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { FeedItem } from './FeedItem';
import type { FeedEvent } from '../types';

// Mock feed event
const createMockFeedEvent = (overrides?: Partial<FeedEvent>): FeedEvent => ({
  event: {
    id: 'event_123',
    pubkey: 'pubkey_123',
    created_at: Math.floor(Date.now() / 1000) - 3600,
    kind: 1,
    tags: [],
    content: 'This is a test post! #nostr #bitcoin',
    sig: 'sig_123',
  },
  engagement: {
    reactions: 42,
    reposts: 12,
    replies: 5,
    isLikedByUser: false,
    isRepostedByUser: false,
  },
  authorProfile: {
    name: 'Satoshi Nakamoto',
    picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=satoshi',
    display_name: 'Satoshi',
    nip05: 'satoshi@bitcoin.org',
  },
  parsedContent: {
    text: 'This is a test post! #nostr #bitcoin',
    images: [],
    videos: [],
    links: [],
    mentions: [],
    hashtags: ['nostr', 'bitcoin'],
  },
  timestamp: Math.floor(Date.now() / 1000) - 3600,
  ...overrides,
});

const meta: Meta<typeof FeedItem> = {
  title: 'Features/NOSTR/Feed/FeedItem',
  component: FeedItem,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Individual feed item displaying a NOSTR event with engagement features (like, repost, reply).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    feedEvent: {
      description: 'The feed event data to display',
    },
    currentUserPubkey: {
      description: 'Public key of the current user',
    },
    condensed: {
      description: 'Show condensed view (smaller avatar, no engagement)',
      control: 'boolean',
    },
    onClick: {
      description: 'Callback when the feed item is clicked',
      action: 'clicked',
    },
    onProfileClick: {
      description: 'Callback when the profile is clicked',
      action: 'profile-clicked',
    },
    onLike: {
      description: 'Callback when the like button is clicked',
      action: 'liked',
    },
    onRepost: {
      description: 'Callback when the repost button is clicked',
      action: 'reposted',
    },
    onReply: {
      description: 'Callback when the reply button is clicked',
      action: 'replied',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FeedItem>;

/**
 * Default feed item with engagement
 */
export const Default: Story = {
  args: {
    feedEvent: createMockFeedEvent(),
  },
};

/**
 * Feed item with liked state
 */
export const Liked: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      engagement: {
        reactions: 43,
        reposts: 12,
        replies: 5,
        isLikedByUser: true,
        isRepostedByUser: false,
      },
    }),
  },
};

/**
 * Feed item with reposted state
 */
export const Reposted: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      engagement: {
        reactions: 42,
        reposts: 13,
        replies: 5,
        isLikedByUser: false,
        isRepostedByUser: true,
      },
    }),
  },
};

/**
 * Feed item with image
 */
export const WithImage: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      parsedContent: {
        text: 'Check out this amazing sunset!',
        images: ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'],
        videos: [],
        links: [],
        mentions: [],
        hashtags: ['photography', 'sunset'],
      },
    }),
  },
};

/**
 * Feed item with multiple images
 */
export const WithMultipleImages: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      parsedContent: {
        text: 'Gallery of beautiful landscapes',
        images: [
          'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
          'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400',
          'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=400',
          'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400',
        ],
        videos: [],
        links: [],
        mentions: [],
        hashtags: ['nature', 'landscape'],
      },
    }),
  },
};

/**
 * Feed item with links
 */
export const WithLinks: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      parsedContent: {
        text: 'Interesting article about NOSTR protocol',
        images: [],
        videos: [],
        links: ['https://nostr.com/protocol', 'https://github.com/nostr-protocol'],
        mentions: [],
        hashtags: ['nostr', 'protocol'],
      },
    }),
  },
};

/**
 * Feed item with long content
 */
export const LongContent: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      parsedContent: {
        text: 'This is a very long post with lots of content. '.repeat(20),
        images: [],
        videos: [],
        links: [],
        mentions: [],
        hashtags: ['longform'],
      },
    }),
  },
};

/**
 * Feed item with high engagement
 */
export const HighEngagement: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      engagement: {
        reactions: 1234,
        reposts: 567,
        replies: 89,
        isLikedByUser: false,
        isRepostedByUser: false,
      },
    }),
  },
};

/**
 * Feed item with zero engagement
 */
export const NoEngagement: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      engagement: {
        reactions: 0,
        reposts: 0,
        replies: 0,
        isLikedByUser: false,
        isRepostedByUser: false,
      },
    }),
  },
};

/**
 * Condensed feed item (for replies/threads)
 */
export const Condensed: Story = {
  args: {
    feedEvent: createMockFeedEvent(),
    condensed: true,
  },
};

/**
 * Feed item without profile information
 */
export const NoProfile: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      authorProfile: undefined,
    }),
  },
};

/**
 * Feed item from 1 week ago
 */
export const OldPost: Story = {
  args: {
    feedEvent: createMockFeedEvent({
      event: {
        id: 'event_old',
        pubkey: 'pubkey_123',
        created_at: Math.floor(Date.now() / 1000) - 604800, // 1 week ago
        kind: 1,
        tags: [],
        content: 'This post is from last week',
        sig: 'sig_old',
      },
      timestamp: Math.floor(Date.now() / 1000) - 604800,
    }),
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    feedEvent: createMockFeedEvent(),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Dark mode
 */
export const DarkMode: Story = {
  args: {
    feedEvent: createMockFeedEvent(),
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <div className="bg-background p-4">
          <Story />
        </div>
      </div>
    ),
  ],
};
