import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Sovren Input component - Creator-focused with Lightning Network and NOSTR integration.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'success', 'warning', 'error', 'lightning', 'sovereign'],
      description: 'Visual style variant',
    },
    inputSize: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Input size',
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
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

// 🎨 **CREATOR-FOCUSED VARIANTS**
export const CreatorUsername: Story = {
  args: {
    variant: 'sovereign',
    placeholder: 'Enter your creator username',
    helperText: 'Your unique creator identity on Sovren',
  },
};

export const LightningPayment: Story = {
  args: {
    variant: 'lightning',
    placeholder: '10000',
    type: 'number',
    helperText: 'Amount in satoshis for premium content',
  },
};

export const SearchCreators: Story = {
  args: {
    placeholder: 'Search elite creators...',
    helperText: 'Find creators to follow and support',
  },
};

export const NostrPublicKey: Story = {
  args: {
    variant: 'sovereign',
    placeholder: 'npub1... or enter your public key',
    helperText: 'Your NOSTR public key for sovereign authentication',
  },
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'creator@sovren.app',
    helperText: 'We will never share your email',
  },
};

// 🎯 **VALIDATION STATES**
export const WithError: Story = {
  args: {
    placeholder: 'Invalid username',
    error: 'Username must be at least 3 characters',
    defaultValue: 'ab',
  },
};

export const WithSuccess: Story = {
  args: {
    placeholder: 'Username available',
    success: 'Great choice! This username is available',
    defaultValue: 'elite_creator',
  },
};

export const WithWarning: Story = {
  args: {
    placeholder: 'Payment amount',
    type: 'number',
    warning: 'High amount - are you sure?',
    defaultValue: '1000000',
  },
};

export const LoadingState: Story = {
  args: {
    placeholder: 'Checking availability...',
    isLoading: true,
    disabled: true,
    defaultValue: 'checking_username',
  },
};

// 🎨 **DESIGN SYSTEM SHOWCASE**
export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <div>
        <label className="block text-sm font-medium mb-2">Creator Username</label>
        <Input
          variant="sovereign"
          placeholder="your_creator_handle"
          success="Username available and secured!"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Lightning Payment</label>
        <Input
          variant="lightning"
          type="number"
          placeholder="10000"
          helperText="Amount in satoshis for premium content"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Search Creators</label>
        <Input
          placeholder="Search elite creators..."
          helperText="Find creators to follow and support"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Validation States</label>
        <div className="space-y-2">
          <Input placeholder="Error state" error="This field is required" defaultValue="" />
          <Input placeholder="Success state" success="Looks good!" defaultValue="valid_input" />
          <Input
            placeholder="Warning state"
            warning="Please double-check this"
            defaultValue="check_this"
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Complete showcase of all Input variants for creator workflows.',
      },
    },
  },
};
