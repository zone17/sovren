/**
 * FeedTimeline Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { FeedTimeline } from './FeedTimeline';

const meta: Meta<typeof FeedTimeline> = {
  title: 'Features/NOSTR/Feed/FeedTimeline',
  component: FeedTimeline,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Main feed/timeline component with real-time updates, filtering, sorting, and infinite scroll.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    filters: {
      description: 'Filter configuration for the feed',
    },
    initialSort: {
      description: 'Initial sort order',
      control: 'select',
      options: ['latest', 'popular', 'trending'],
    },
    autoUpdate: {
      description: 'Enable real-time updates',
      control: 'boolean',
    },
    pageSize: {
      description: 'Number of events per page',
      control: 'number',
    },
    emptyMessage: {
      description: 'Custom empty state message',
      control: 'text',
    },
    onEventClick: {
      description: 'Callback when an event is clicked',
      action: 'event-clicked',
    },
    onProfileClick: {
      description: 'Callback when a profile is clicked',
      action: 'profile-clicked',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FeedTimeline>;

/**
 * Default feed timeline
 */
export const Default: Story = {
  args: {
    initialSort: 'latest',
    autoUpdate: true,
    pageSize: 20,
  },
};

/**
 * Popular sort
 */
export const Popular: Story = {
  args: {
    initialSort: 'popular',
    autoUpdate: true,
  },
};

/**
 * Trending sort
 */
export const Trending: Story = {
  args: {
    initialSort: 'trending',
    autoUpdate: true,
  },
};

/**
 * With author filter
 */
export const FilteredByAuthor: Story = {
  args: {
    filters: {
      authors: ['pubkey123'],
      kinds: [1, 6, 7],
    },
  },
};

/**
 * With hashtag filter
 */
export const FilteredByHashtag: Story = {
  args: {
    filters: {
      hashtags: ['bitcoin', 'nostr'],
      kinds: [1, 6, 7],
    },
  },
};

/**
 * With date range filter
 */
export const FilteredByDateRange: Story = {
  args: {
    filters: {
      since: Math.floor(Date.now() / 1000) - 86400, // Last 24 hours
      kinds: [1, 6, 7],
    },
  },
};

/**
 * Custom empty message
 */
export const CustomEmptyMessage: Story = {
  args: {
    emptyMessage: 'Follow more people to see their posts here!',
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {
    initialSort: 'latest',
    autoUpdate: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  args: {
    initialSort: 'latest',
    autoUpdate: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

/**
 * Dark mode
 */
export const DarkMode: Story = {
  args: {
    initialSort: 'latest',
    autoUpdate: true,
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <div className="dark h-screen">
        <Story />
      </div>
    ),
  ],
};
