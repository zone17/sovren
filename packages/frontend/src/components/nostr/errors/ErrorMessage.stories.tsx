/**
 * 📖 STORYBOOK: Error Message Component
 *
 * US-319: Implement Error Handling UI
 */

import type { Meta, StoryObj } from '@storybook/react';
import { ErrorMessage } from './ErrorMessage';
import {
  ErrorSeverity as ErrorSeverityEnum,
  ErrorCategory as ErrorCategoryEnum,
  NostrErrorCode as NostrErrorCodeEnum,
} from './types';
import type { NostrErrorMetadata } from './types';

const meta: Meta<typeof ErrorMessage> = {
  title: 'Components/NOSTR/Errors/ErrorMessage',
  component: ErrorMessage,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Generic error message component with multiple severity levels and customization options.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    error: {
      description: 'Error metadata object',
      control: 'object',
    },
    showTroubleshooting: {
      description: 'Show troubleshooting hints',
      control: 'boolean',
    },
    showRecoverySuggestions: {
      description: 'Show recovery suggestions',
      control: 'boolean',
    },
    showErrorCode: {
      description: 'Show error code',
      control: 'boolean',
    },
    showTimestamp: {
      description: 'Show timestamp',
      control: 'boolean',
    },
    compact: {
      description: 'Compact mode',
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorMessage>;

// Base error for reuse
const baseError: NostrErrorMetadata = {
  code: NostrErrorCodeEnum.CONNECTION_TIMEOUT,
  category: ErrorCategoryEnum.CONNECTION,
  severity: ErrorSeverityEnum.ERROR,
  title: 'Connection Timeout',
  message: 'Failed to connect to relay within timeout period',
  timestamp: Date.now(),
  relay: 'wss://relay.damus.io',
  troubleshootingHints: [
    'Check your internet connection',
    'Verify that the relay is online',
    'Try increasing the timeout value',
  ],
  recoverySuggestions: [
    'Try connecting again',
    'Switch to a different relay',
    'Check your firewall settings',
  ],
};

export const Default: Story = {
  args: {
    error: baseError,
    showTroubleshooting: true,
    showRecoverySuggestions: true,
    showErrorCode: true,
    showTimestamp: false,
    compact: false,
  },
};

export const InfoSeverity: Story = {
  args: {
    error: {
      ...baseError,
      code: NostrErrorCodeEnum.EOSE_NOT_RECEIVED,
      severity: ErrorSeverityEnum.INFO,
      title: 'End of Stored Events',
      message: 'Some relays have not sent EOSE yet',
    },
    showTroubleshooting: false,
    showRecoverySuggestions: false,
  },
};

export const WarningSeverity: Story = {
  args: {
    error: {
      ...baseError,
      code: NostrErrorCodeEnum.RATE_LIMIT_EXCEEDED,
      severity: ErrorSeverityEnum.WARNING,
      title: 'Rate Limit Exceeded',
      message: 'You are sending events too quickly. Please slow down.',
      troubleshootingHints: [
        'Wait a few seconds before sending more events',
        'Implement exponential backoff in your code',
      ],
    },
  },
};

export const ErrorSeverity: Story = {
  args: {
    error: baseError,
  },
};

export const CriticalSeverity: Story = {
  args: {
    error: {
      ...baseError,
      code: NostrErrorCodeEnum.NO_RELAYS_AVAILABLE,
      severity: ErrorSeverityEnum.CRITICAL,
      title: 'No Relays Available',
      message:
        'Cannot connect to any configured relays. Application functionality is severely limited.',
      troubleshootingHints: [
        'Check your network connection immediately',
        'Verify relay URLs in configuration',
        'Contact system administrator',
      ],
    },
  },
};

export const WithRetry: Story = {
  args: {
    error: baseError,
    onRetry: () => {
      console.log('Retry clicked');
      return new Promise((resolve) => setTimeout(resolve, 2000));
    },
  },
};

export const WithDismiss: Story = {
  args: {
    error: baseError,
    onDismiss: () => console.log('Dismiss clicked'),
  },
};

export const WithRetryAndDismiss: Story = {
  args: {
    error: baseError,
    onRetry: () => {
      console.log('Retry clicked');
      return new Promise((resolve) => setTimeout(resolve, 2000));
    },
    onDismiss: () => console.log('Dismiss clicked'),
  },
};

export const CompactMode: Story = {
  args: {
    error: baseError,
    compact: true,
    onDismiss: () => console.log('Dismiss clicked'),
  },
};

export const NoTroubleshooting: Story = {
  args: {
    error: baseError,
    showTroubleshooting: false,
    showRecoverySuggestions: false,
  },
};

export const WithTimestamp: Story = {
  args: {
    error: baseError,
    showTimestamp: true,
  },
};

export const MultipleRelays: Story = {
  args: {
    error: {
      ...baseError,
      relay: undefined,
      relays: ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'],
      title: 'Multiple Relay Failure',
      message: 'Failed to connect to multiple relays',
    },
  },
};

export const PublishError: Story = {
  args: {
    error: {
      code: NostrErrorCodeEnum.EVENT_VALIDATION_FAILED,
      category: ErrorCategoryEnum.PUBLISHING,
      severity: ErrorSeverityEnum.ERROR,
      title: 'Event Validation Failed',
      message: 'Event signature is invalid',
      timestamp: Date.now(),
      troubleshootingHints: [
        'Check that your private key is correct',
        'Verify the event is properly signed',
        'Ensure event hash matches content',
      ],
    },
    onRetry: () => {
      console.log('Retry publish');
      return Promise.resolve();
    },
  },
};

export const SubscriptionError: Story = {
  args: {
    error: {
      code: NostrErrorCodeEnum.FILTER_VALIDATION_FAILED,
      category: ErrorCategoryEnum.SUBSCRIPTION,
      severity: ErrorSeverityEnum.ERROR,
      title: 'Filter Validation Failed',
      message: 'Invalid filter syntax in subscription request',
      timestamp: Date.now(),
      troubleshootingHints: [
        'Check filter syntax is correct',
        'Verify all filter fields are valid',
        'Review NOSTR filter specification',
      ],
      recoverySuggestions: [
        'Correct the filter and try again',
        'Use the filter builder for assistance',
      ],
    },
  },
};

export const NetworkError: Story = {
  args: {
    error: {
      code: NostrErrorCodeEnum.NETWORK_ERROR,
      category: ErrorCategoryEnum.NETWORK,
      severity: ErrorSeverityEnum.ERROR,
      title: 'Network Error',
      message: 'Unable to reach NOSTR relays due to network connectivity issues',
      timestamp: Date.now(),
      troubleshootingHints: [
        'Check your internet connection',
        'Verify you are not behind a firewall',
        'Try disabling VPN if enabled',
        'Check if relay servers are accessible',
      ],
    },
    showTimestamp: true,
  },
};

export const LongContent: Story = {
  args: {
    error: {
      ...baseError,
      message:
        'This is a very long error message that contains multiple paragraphs of text. It demonstrates how the component handles lengthy error descriptions. This is important for errors that require detailed explanations or context. The component should handle this gracefully without breaking the layout.',
      troubleshootingHints: [
        'First troubleshooting hint with lots of detail about what might be wrong and how to diagnose the issue',
        'Second hint that also contains substantial information about potential solutions',
        'Third hint with even more details about edge cases and special circumstances',
      ],
    },
  },
};

export const Mobile: Story = {
  args: {
    error: baseError,
    onRetry: () => Promise.resolve(),
    onDismiss: () => console.log('Dismiss'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
