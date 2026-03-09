/**
 * NotificationCenter Storybook Stories
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import type { Meta, StoryObj } from '@storybook/react';
import { NotificationCenter } from './NotificationCenter';

const meta: Meta<typeof NotificationCenter> = {
  title: 'Features/NOSTR/Notifications/NotificationCenter',
  component: NotificationCenter,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Main notification center component with bell button, panel, filtering, and settings. Manages notification display and interactions.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-muted p-8">
        <div className="flex justify-end">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NotificationCenter>;

export const Default: Story = {
  args: {},
};

export const OpenByDefault: Story = {
  args: {
    initialOpen: true,
  },
};

export const LeftPosition: Story = {
  args: {
    initialOpen: true,
    position: 'left',
  },
};

export const RightPosition: Story = {
  args: {
    initialOpen: true,
    position: 'right',
  },
};

export const WithSettings: Story = {
  args: {
    initialOpen: true,
    showSettings: true,
  },
};

export const WithoutSettings: Story = {
  args: {
    initialOpen: true,
    showSettings: false,
  },
};

export const CustomHeight: Story = {
  args: {
    initialOpen: true,
    maxHeight: '400px',
  },
};

export const TallHeight: Story = {
  args: {
    initialOpen: true,
    maxHeight: '800px',
  },
};

export const WithCallback: Story = {
  args: {
    initialOpen: true,
    onNotificationClick: (notification) => {
      console.log('Notification clicked:', notification);
      alert(`Clicked: ${notification.content}`);
    },
  },
};

export const DarkTheme: Story = {
  args: {
    initialOpen: true,
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <div className="min-h-screen bg-background p-8">
          <div className="flex justify-end">
            <Story />
          </div>
        </div>
      </div>
    ),
  ],
};

export const MobileView: Story = {
  args: {
    initialOpen: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const TabletView: Story = {
  args: {
    initialOpen: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

export const InteractiveDemo: Story = {
  args: {
    showSettings: true,
    playSound: true,
    autoMarkRead: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Full interactive demo. Click the bell to open, filter notifications, mark as read, and access settings.',
      },
    },
  },
};
