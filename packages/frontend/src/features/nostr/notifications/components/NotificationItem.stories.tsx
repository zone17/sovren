/**
 * NotificationItem Storybook Stories
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import type { Meta, StoryObj } from '@storybook/react';
import { NotificationItem } from './NotificationItem';
import { Notification, NotificationType } from '../types';

const meta: Meta<typeof NotificationItem> = {
  title: 'Features/NOSTR/Notifications/NotificationItem',
  component: NotificationItem,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Individual notification item component. Displays notification content, author info, timestamp, and action buttons.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NotificationItem>;

const baseNotification: Notification = {
  id: '1',
  type: NotificationType.MENTION,
  event: {
    id: 'event-1',
    pubkey: 'pubkey-1',
    created_at: Math.floor(Date.now() / 1000) - 3600,
    kind: 1,
    tags: [],
    content: 'Test content',
    sig: 'sig',
  },
  author: {
    pubkey: 'pubkey-1',
    name: 'Alice',
    avatar: 'https://i.pravatar.cc/150?img=1',
  },
  content: 'Alice mentioned you in a post about NOSTR protocol improvements',
  createdAt: Math.floor(Date.now() / 1000) - 3600,
  read: false,
  url: '#',
};

export const Mention: Story = {
  args: {
    notification: baseNotification,
    showActions: true,
  },
};

export const Reply: Story = {
  args: {
    notification: {
      ...baseNotification,
      id: '2',
      type: NotificationType.REPLY,
      content: 'Alice replied to your note',
    },
    showActions: true,
  },
};

export const Reaction: Story = {
  args: {
    notification: {
      ...baseNotification,
      id: '3',
      type: NotificationType.REACTION,
      content: 'Alice reacted ❤️ to your note',
      metadata: {
        reactionContent: '❤️',
      },
    },
    showActions: true,
  },
};

export const Repost: Story = {
  args: {
    notification: {
      ...baseNotification,
      id: '4',
      type: NotificationType.REPOST,
      content: 'Alice reposted your note',
    },
    showActions: true,
  },
};

export const DirectMessage: Story = {
  args: {
    notification: {
      ...baseNotification,
      id: '5',
      type: NotificationType.DM,
      content: 'Alice sent you a message: "Hey, how are you?"',
    },
    showActions: true,
  },
};

export const Follow: Story = {
  args: {
    notification: {
      ...baseNotification,
      id: '6',
      type: NotificationType.FOLLOW,
      content: 'Alice followed you',
    },
    showActions: true,
  },
};

export const Zap: Story = {
  args: {
    notification: {
      ...baseNotification,
      id: '7',
      type: NotificationType.ZAP,
      content: 'Alice zapped you 1,000 sats',
      metadata: {
        zapAmount: 1000000,
        zapComment: 'Great content!',
      },
    },
    showActions: true,
  },
};

export const ReadNotification: Story = {
  args: {
    notification: {
      ...baseNotification,
      read: true,
    },
    showActions: true,
  },
};

export const UnreadNotification: Story = {
  args: {
    notification: {
      ...baseNotification,
      read: false,
    },
    showActions: true,
  },
};

export const NoAvatar: Story = {
  args: {
    notification: {
      ...baseNotification,
      author: {
        pubkey: 'pubkey-1',
        name: 'Anonymous',
      },
    },
    showActions: true,
  },
};

export const LongContent: Story = {
  args: {
    notification: {
      ...baseNotification,
      content: 'Alice mentioned you in a very long post about the future of decentralized social media, NOSTR protocol improvements, Bitcoin Lightning Network integration, and the importance of creator monetization in web3. This notification has a lot of text to demonstrate how the component handles long content.',
    },
    showActions: true,
  },
};

export const WithoutActions: Story = {
  args: {
    notification: baseNotification,
    showActions: false,
  },
};

export const RecentNotification: Story = {
  args: {
    notification: {
      ...baseNotification,
      createdAt: Math.floor(Date.now() / 1000) - 60,
    },
    showActions: true,
  },
};

export const OldNotification: Story = {
  args: {
    notification: {
      ...baseNotification,
      createdAt: Math.floor(Date.now() / 1000) - 86400 * 7,
    },
    showActions: true,
  },
};

export const InteractiveDemo: Story = {
  args: {
    notification: baseNotification,
    showActions: true,
    autoMarkRead: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Click the notification to see the onClick behavior. Click the mark as read or delete buttons to see actions.',
      },
    },
  },
};
