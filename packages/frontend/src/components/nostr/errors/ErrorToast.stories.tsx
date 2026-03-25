/**
 * 📖 STORYBOOK: Error Toast System
 *
 * US-319: Implement Error Handling UI
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ErrorToastContainer, errorToast } from './ErrorToast';
import {
  ErrorSeverity as ErrorSeverityEnum,
  ErrorCategory as ErrorCategoryEnum,
  NostrErrorCode as NostrErrorCodeEnum,
} from './types';
import type { NostrErrorMetadata } from './types';

// Wrapper component for stories
const ToastDemo: React.FC<{ onShow: () => void }> = ({ onShow }) => {
  return (
    <div>
      <div className="p-6">
        <button
          onClick={onShow}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Show Toast
        </button>
        <p className="mt-4 text-sm text-muted-foreground">
          Click the button to show the toast notification. Toasts will appear in the top-right
          corner.
        </p>
      </div>
      <ErrorToastContainer />
    </div>
  );
};

const meta: Meta<typeof ToastDemo> = {
  title: 'Components/NOSTR/Errors/ErrorToast',
  component: ToastDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Toast notification system for displaying errors with auto-dismiss and retry functionality.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ToastDemo>;

const createError = (overrides?: Partial<NostrErrorMetadata>): NostrErrorMetadata => ({
  code: NostrErrorCodeEnum.PUBLISH_FAILED,
  category: ErrorCategoryEnum.PUBLISHING,
  severity: ErrorSeverityEnum.ERROR,
  title: 'Publish Failed',
  message: 'Failed to publish event to relay',
  timestamp: Date.now(),
  ...overrides,
});

export const InfoToast: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          code: NostrErrorCodeEnum.EOSE_NOT_RECEIVED,
          severity: ErrorSeverityEnum.INFO,
          title: 'Loading Complete',
          message: 'All events have been loaded from the relay',
        })
      );
    },
  },
};

export const WarningToast: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          code: NostrErrorCodeEnum.RATE_LIMIT_EXCEEDED,
          severity: ErrorSeverityEnum.WARNING,
          title: 'Rate Limit Warning',
          message: 'Approaching rate limit. Please slow down.',
        })
      );
    },
  },
};

export const ErrorToast: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          code: NostrErrorCodeEnum.PUBLISH_FAILED,
          severity: ErrorSeverityEnum.ERROR,
          title: 'Publish Failed',
          message: 'Failed to publish event to relay',
        })
      );
    },
  },
};

export const CriticalToast: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          code: NostrErrorCodeEnum.NO_RELAYS_AVAILABLE,
          severity: ErrorSeverityEnum.CRITICAL,
          title: 'Critical: No Relays',
          message: 'Cannot connect to any relays. Application is offline.',
        })
      );
    },
  },
};

export const WithRetry: Story = {
  args: {
    onShow: () => {
      errorToast.show(createError(), {
        retryable: true,
        onRetry: async () => {
          console.log('Retrying...');
          await new Promise((resolve) => setTimeout(resolve, 2000));
          console.log('Retry complete');
        },
      });
    },
  },
};

export const WithCustomAction: Story = {
  args: {
    onShow: () => {
      errorToast.show(createError(), {
        action: {
          label: 'View Details',
          onClick: () => {
            console.log('View details clicked');
            alert('Opening error details...');
          },
        },
      });
    },
  },
};

export const NonDismissible: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          severity: ErrorSeverityEnum.CRITICAL,
        }),
        {
          dismissible: false,
        }
      );
    },
  },
};

export const CustomDuration: Story = {
  args: {
    onShow: () => {
      errorToast.show(createError(), {
        duration: 10000, // 10 seconds
      });
    },
  },
};

export const MultipleToasts: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          title: 'First Error',
          message: 'This is the first error',
        })
      );

      setTimeout(() => {
        errorToast.show(
          createError({
            severity: ErrorSeverityEnum.WARNING,
            title: 'Second Warning',
            message: 'This is a warning',
          })
        );
      }, 500);

      setTimeout(() => {
        errorToast.show(
          createError({
            severity: ErrorSeverityEnum.INFO,
            title: 'Third Info',
            message: 'This is informational',
          })
        );
      }, 1000);
    },
  },
};

export const ConnectionError: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          code: NostrErrorCodeEnum.CONNECTION_TIMEOUT,
          category: ErrorCategoryEnum.CONNECTION,
          severity: ErrorSeverityEnum.ERROR,
          title: 'Connection Timeout',
          message: 'Could not connect to wss://relay.damus.io',
        }),
        {
          retryable: true,
          onRetry: () => {
            console.log('Retrying connection...');
            return new Promise((resolve) => setTimeout(resolve, 2000));
          },
        }
      );
    },
  },
};

export const PublishError: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          code: NostrErrorCodeEnum.EVENT_VALIDATION_FAILED,
          category: ErrorCategoryEnum.PUBLISHING,
          severity: ErrorSeverityEnum.ERROR,
          title: 'Validation Failed',
          message: 'Event signature is invalid',
        }),
        {
          retryable: true,
          onRetry: async () => {
            console.log('Retrying publish...');
            await new Promise((resolve) => setTimeout(resolve, 1500));
          },
        }
      );
    },
  },
};

export const SubscriptionError: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          code: NostrErrorCodeEnum.SUBSCRIPTION_TIMEOUT,
          category: ErrorCategoryEnum.SUBSCRIPTION,
          severity: ErrorSeverityEnum.WARNING,
          title: 'Subscription Timeout',
          message: 'Subscription did not receive EOSE within timeout',
        })
      );
    },
  },
};

export const WithCallback: Story = {
  args: {
    onShow: () => {
      errorToast.show(createError(), {
        onDismiss: () => {
          console.log('Toast was dismissed');
        },
        retryable: true,
        onRetry: async () => {
          console.log('Retry initiated');
        },
      });
    },
  },
};

export const LongMessage: Story = {
  args: {
    onShow: () => {
      errorToast.show(
        createError({
          title: 'Operation Failed',
          message:
            'This is a longer error message that demonstrates how the toast handles multiple lines of text and wrapping behavior.',
        })
      );
    },
  },
};

export const Mobile: Story = {
  args: {
    onShow: () => {
      errorToast.show(createError());
    },
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const StressTest: Story = {
  args: {
    onShow: () => {
      // Show maximum toasts rapidly
      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          errorToast.show(
            createError({
              title: `Error ${i + 1}`,
              message: `This is error number ${i + 1}`,
              severity: [
                ErrorSeverityEnum.INFO,
                ErrorSeverityEnum.WARNING,
                ErrorSeverityEnum.ERROR,
                ErrorSeverityEnum.CRITICAL,
              ][i % 4],
            })
          );
        }, i * 300);
      }
    },
  },
};
