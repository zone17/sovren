import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { LightningIcon, SovereignIcon, PremiumIcon, SatsIcon } from './icons';

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Sovren Button component - Professional creator-focused with Lightning Network and NOSTR integration for monetization platform.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: [
        'default',
        'secondary',
        'outline',
        'ghost',
        'link',
        'lightning',
        'sovereign',
        'premium',
      ],
      description: 'Visual style variant for creator actions',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'default', 'lg', 'icon'],
      description: 'Button size',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    isLoading: {
      control: 'boolean',
      description: 'Loading state with spinner',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// ⚡ **LIGHTNING NETWORK** - Professional payment actions
export const LightningPayment: Story = {
  args: {
    variant: 'lightning',
    children: (
      <>
        <LightningIcon size={18} className="mr-2" />
        Send 10,000 sats
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Lightning Network payment button for instant Bitcoin transactions with professional iconography.',
      },
    },
  },
};

// 🔵 **SOVEREIGN AUTHENTICATION** - NOSTR actions
export const SovereignAuth: Story = {
  args: {
    variant: 'sovereign',
    children: (
      <>
        <SovereignIcon size={18} className="mr-2" />
        Connect NOSTR
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'NOSTR authentication for decentralized creator identity with professional key icon.',
      },
    },
  },
};

// ⚫ **PREMIUM CREATOR** - Elite platform actions
export const PremiumCreator: Story = {
  args: {
    variant: 'premium',
    children: (
      <>
        <PremiumIcon size={18} className="mr-2" />
        Upgrade to Elite
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Premium upgrade button for elite creator features with sophisticated crown icon.',
      },
    },
  },
};

// 📝 **STANDARD VARIANTS**
export const Primary: Story = {
  args: {
    variant: 'default',
    children: 'Create Content',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'View Profile',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Follow Creator',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'More Options',
  },
};

// 🎛️ **SIZES & STATES**
export const Small: Story = {
  args: {
    variant: 'lightning',
    size: 'sm',
    children: (
      <>
        <SatsIcon size={16} className="mr-1" />
        Quick Tip
      </>
    ),
  },
};

export const Large: Story = {
  args: {
    variant: 'sovereign',
    size: 'lg',
    children: (
      <>
        <SovereignIcon size={20} className="mr-2" />
        Authenticate with NOSTR
      </>
    ),
  },
};

export const Loading: Story = {
  args: {
    variant: 'lightning',
    isLoading: true,
    children: 'Processing Payment...',
  },
};

// 🎨 **CREATOR PLATFORM SHOWCASE**
export const CreatorActions: Story = {
  render: () => (
    <div className="flex flex-col gap-6 p-8 bg-premium-950 rounded-xl">
      <h3 className="text-white text-xl font-semibold mb-4 text-center">Sovren Creator Platform</h3>

      {/* Lightning Network Actions */}
      <div className="space-y-3">
        <h4 className="text-lightning-400 text-sm font-medium uppercase tracking-wide">
          Lightning Network
        </h4>
        <div className="flex gap-3 flex-wrap">
          <Button variant="lightning" size="sm">
            <SatsIcon size={14} className="mr-1" />
            1,000 sats
          </Button>
          <Button variant="lightning">
            <LightningIcon size={16} className="mr-2" />
            10,000 sats
          </Button>
          <Button variant="lightning" size="lg">
            <LightningIcon size={18} className="mr-2" />
            Support Creator
          </Button>
        </div>
      </div>

      {/* Sovereign Identity */}
      <div className="space-y-3">
        <h4 className="text-sovereign-400 text-sm font-medium uppercase tracking-wide">
          Sovereign Identity
        </h4>
        <div className="flex gap-3 flex-wrap">
          <Button variant="sovereign" size="sm">
            <SovereignIcon size={14} className="mr-1" />
            Connect
          </Button>
          <Button variant="sovereign">
            <SovereignIcon size={16} className="mr-2" />
            NOSTR Auth
          </Button>
          <Button variant="sovereign" size="lg">
            <SovereignIcon size={18} className="mr-2" />
            Sovereign Identity
          </Button>
        </div>
      </div>

      {/* Premium Features */}
      <div className="space-y-3">
        <h4 className="text-premium-400 text-sm font-medium uppercase tracking-wide">
          Elite Features
        </h4>
        <div className="flex gap-3 flex-wrap">
          <Button variant="premium" size="sm">
            <PremiumIcon size={14} className="mr-1" />
            Elite
          </Button>
          <Button variant="premium">
            <PremiumIcon size={16} className="mr-2" />
            Premium
          </Button>
          <Button variant="premium" size="lg">
            <PremiumIcon size={18} className="mr-2" />
            Upgrade to Elite
          </Button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Complete showcase of professional creator-focused button variants with SVG icons for Lightning payments, NOSTR authentication, and premium features.',
      },
    },
  },
};
