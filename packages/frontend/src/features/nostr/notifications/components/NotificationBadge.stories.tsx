/**
 * NotificationBadge Storybook Stories
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import type { Meta, StoryObj } from '@storybook/react';
import { NotificationBadge } from './NotificationBadge';

const meta: Meta<typeof NotificationBadge> = {
  title: 'Features/NOSTR/Notifications/NotificationBadge',
  component: NotificationBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Badge component to display unread notification count. Supports different variants, sizes, and display modes (count or dot).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    count: {
      control: { type: 'number', min: 0, max: 200 },
      description: 'Number of unread notifications',
    },
    max: {
      control: { type: 'number', min: 1, max: 999 },
      description: 'Maximum count to display before showing "max+"',
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'primary', 'success', 'warning', 'danger'],
      description: 'Color variant of the badge',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the badge',
    },
    showZero: {
      control: { type: 'boolean' },
      description: 'Whether to show the badge when count is 0',
    },
    dot: {
      control: { type: 'boolean' },
      description: 'Show as a dot instead of count',
    },
  },
};

export default meta;
type Story = StoryObj<typeof NotificationBadge>;

export const Default: Story = {
  args: {
    count: 3,
  },
};

export const Zero: Story = {
  args: {
    count: 0,
    showZero: true,
  },
};

export const MaxExceeded: Story = {
  args: {
    count: 150,
    max: 99,
  },
};

export const SmallSize: Story = {
  args: {
    count: 5,
    size: 'sm',
  },
};

export const MediumSize: Story = {
  args: {
    count: 5,
    size: 'md',
  },
};

export const LargeSize: Story = {
  args: {
    count: 5,
    size: 'lg',
  },
};

export const Primary: Story = {
  args: {
    count: 5,
    variant: 'primary',
  },
};

export const Success: Story = {
  args: {
    count: 5,
    variant: 'success',
  },
};

export const Warning: Story = {
  args: {
    count: 5,
    variant: 'warning',
  },
};

export const Danger: Story = {
  args: {
    count: 5,
    variant: 'danger',
  },
};

export const DotMode: Story = {
  args: {
    count: 5,
    dot: true,
  },
};

export const DotSmall: Story = {
  args: {
    count: 5,
    dot: true,
    size: 'sm',
  },
};

export const DotLarge: Story = {
  args: {
    count: 5,
    dot: true,
    size: 'lg',
  },
};

export const OnButton: Story = {
  args: {
    count: 12,
  },
  render: (args) => (
    <div className="relative">
      <button className="p-3 bg-blue-500 text-white rounded-full">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
      </button>
      <div className="absolute -top-1 -right-1">
        <NotificationBadge {...args} />
      </div>
    </div>
  ),
};
