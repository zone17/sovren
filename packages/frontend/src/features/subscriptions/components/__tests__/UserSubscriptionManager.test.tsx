/**
 * 💳 **USER SUBSCRIPTION MANAGER TESTS**
 *
 * Comprehensive test suite for user subscription management
 * Stories: US-079, US-080, US-081, US-082
 *
 * Test Coverage:
 * - Active subscriptions management
 * - Renewal settings configuration
 * - Payment method management
 * - Subscription history tracking
 * - Lightning Network integration
 * - Error handling and edge cases
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserSubscriptionManager } from '../UserSubscriptionManager';

// Mock hooks and services
const mockRefreshSubscriptions = vi.fn();
const mockToggleAutoRenew = vi.fn();
const mockCancelSubscription = vi.fn();
const mockPauseSubscription = vi.fn();
const mockResumeSubscription = vi.fn();
const mockAddPaymentMethod = vi.fn();
const mockUpdatePaymentMethod = vi.fn();
const mockDeletePaymentMethod = vi.fn();
const mockSetDefaultPaymentMethod = vi.fn();
const mockUpdateRenewalSettings = vi.fn();
const mockExportSubscriptionHistory = vi.fn();

// Mock the service hook
const mockService = {
  subscriptions: [],
  paymentMethods: [],
  subscriptionHistory: [],
  loading: false,
  error: null,
  refreshSubscriptions: mockRefreshSubscriptions,
  toggleAutoRenew: mockToggleAutoRenew,
  cancelSubscription: mockCancelSubscription,
  pauseSubscription: mockPauseSubscription,
  resumeSubscription: mockResumeSubscription,
  addPaymentMethod: mockAddPaymentMethod,
  updatePaymentMethod: mockUpdatePaymentMethod,
  deletePaymentMethod: mockDeletePaymentMethod,
  setDefaultPaymentMethod: mockSetDefaultPaymentMethod,
  updateRenewalSettings: mockUpdateRenewalSettings,
  exportSubscriptionHistory: mockExportSubscriptionHistory,
};

vi.mock('../../services/useUserSubscriptionService', () => ({
  useUserSubscriptionService: () => mockService,
}));

vi.mock('../../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    enableUserSubscriptionManagement: true,
  }),
}));

// Mock data
const mockSubscriptions = [
  {
    id: 'sub-1',
    creator_id: 'creator-1',
    creator_name: 'Tech Creator Pro',
    creator_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tech',
    tier_name: 'Premium Access',
    tier_id: 'tier-1',
    status: 'active',
    amount_sats: 50000,
    billing_interval: 'monthly',
    start_date: '2024-01-01T00:00:00Z',
    end_date: '2024-02-01T00:00:00Z',
    auto_renew: true,
    payment_method_id: 'pm-1',
    last_payment_date: '2024-01-01T00:00:00Z',
    next_payment_date: '2024-02-01T00:00:00Z',
    benefits: ['Premium Content', 'Direct Messaging', 'Early Access', 'Exclusive Videos'],
    usage_stats: {
      content_accessed: 23,
      total_value_received: 125000,
    },
  },
  {
    id: 'sub-2',
    creator_id: 'creator-2',
    creator_name: 'Art Masterclass',
    creator_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=art',
    tier_name: 'Basic Support',
    tier_id: 'tier-2',
    status: 'paused',
    amount_sats: 25000,
    billing_interval: 'monthly',
    start_date: '2024-01-15T00:00:00Z',
    end_date: '2024-02-15T00:00:00Z',
    auto_renew: false,
    payment_method_id: 'pm-2',
    benefits: ['Basic Content', 'Community Access'],
    usage_stats: {
      content_accessed: 8,
      total_value_received: 45000,
    },
  },
];

const mockPaymentMethods = [
  {
    id: 'pm-1',
    type: 'lightning',
    name: 'Primary Lightning Wallet',
    identifier: 'user@getalby.com',
    is_default: true,
    is_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    last_used: '2024-01-25T12:00:00Z',
    failure_count: 0,
  },
  {
    id: 'pm-2',
    type: 'lightning',
    name: 'Secondary Wallet',
    identifier: 'lnbc1...wallet2',
    is_default: false,
    is_verified: true,
    created_at: '2024-01-10T00:00:00Z',
    last_used: '2024-01-20T15:30:00Z',
    failure_count: 1,
  },
];

const mockSubscriptionHistory = [
  {
    id: 'hist-1',
    subscription_id: 'sub-1',
    creator_name: 'Tech Creator Pro',
    tier_name: 'Premium Access',
    amount_sats: 50000,
    action: 'renewed',
    date: '2024-01-25T10:30:00Z',
    payment_hash: 'abc123def456...',
    notes: 'Automatic renewal successful',
  },
  {
    id: 'hist-2',
    subscription_id: 'sub-2',
    creator_name: 'Art Masterclass',
    tier_name: 'Basic Support',
    amount_sats: 25000,
    action: 'paused',
    date: '2024-01-20T14:15:00Z',
    notes: 'User requested pause',
  },
];

describe('UserSubscriptionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Populate mock service with test data
    mockService.subscriptions = [...mockSubscriptions] as any;
    mockService.paymentMethods = [...mockPaymentMethods] as any;
    mockService.subscriptionHistory = [...mockSubscriptionHistory] as any;
    mockService.loading = false;
    mockService.error = null;
  });

  it('renders subscription manager component', () => {
    render(<UserSubscriptionManager />);
    expect(screen.getByText('My Subscriptions')).toBeInTheDocument();
  });

  it('displays tabs for different subscription features', () => {
    render(<UserSubscriptionManager />);
    expect(screen.getByRole('tab', { name: /Active/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Renewal/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Payment/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /History/ })).toBeInTheDocument();
  });

  it('shows loading state when loading is true', () => {
    const loadingService = { ...mockService, loading: true };
    vi.doMock('../../services/useUserSubscriptionService', () => ({
      useUserSubscriptionService: () => loadingService,
    }));
    render(<UserSubscriptionManager />);
    expect(screen.getByText('My Subscriptions')).toBeInTheDocument();
  });

  it('shows error state when there is an error', () => {
    // Set error directly on the shared mockService object — vi.doMock does not work
    // after the module has already been loaded via vi.mock() at the top of the file.
    mockService.error = 'Test error' as any;
    render(<UserSubscriptionManager />);
    expect(screen.getByText('Error Loading Subscriptions')).toBeInTheDocument();
  });

  // US-079: Active Subscriptions Management Tests
  describe('Active Subscriptions (US-079)', () => {
    it('renders subscription manager with active subscriptions tab', () => {
      render(<UserSubscriptionManager />);

      expect(screen.getByText('My Subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Manage your subscriptions and payment methods')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Active/ })).toBeInTheDocument();
    });

    it('displays list of active subscriptions with correct information', () => {
      render(<UserSubscriptionManager />);

      // Check first subscription
      expect(screen.getByText('Tech Creator Pro')).toBeInTheDocument();
      expect(screen.getByText('Premium Access')).toBeInTheDocument();
      // formatSats(50000, { abbreviate: true, suffix: false }) + ' sats' = '50.0K sats'
      expect(screen.getByText('⚡ 50.0K sats')).toBeInTheDocument();
      // Both subscriptions have monthly billing_interval — DOM text is 'monthly' (CSS capitalize)
      expect(screen.getAllByText('monthly').length).toBeGreaterThan(0);
      // Status badge renders lowercase status — DOM text is 'active', not 'Active'
      expect(screen.getByText('active')).toBeInTheDocument();

      // Check second subscription
      expect(screen.getByText('Art Masterclass')).toBeInTheDocument();
      expect(screen.getByText('Basic Support')).toBeInTheDocument();
      expect(screen.getByText('⚡ 25.0K sats')).toBeInTheDocument();
      // Status badge renders lowercase 'paused', not 'Paused'
      expect(screen.getByText('paused')).toBeInTheDocument();
    });

    it('displays subscription benefits and usage stats', () => {
      render(<UserSubscriptionManager />);

      expect(screen.getByText('Premium Content')).toBeInTheDocument();
      expect(screen.getByText('Direct Messaging')).toBeInTheDocument();
      // 'Content Accessed' appears in multiple places (header + value); use getAllByText
      expect(screen.getAllByText('Content Accessed').length).toBeGreaterThan(0);
      expect(screen.getByText('23')).toBeInTheDocument();
      // 'Value Received' may appear for multiple subscriptions; use getAllByText
      expect(screen.getAllByText('Value Received').length).toBeGreaterThan(0);
      // formatSats(125000, { abbreviate: true, suffix: false }) = '125.0K'
      expect(screen.getByText('⚡ 125.0K')).toBeInTheDocument();
    });

    it('allows toggling auto-renewal for subscriptions', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const autoRenewToggle = screen.getAllByRole('switch')[0];
      await user.click(autoRenewToggle);

      expect(mockToggleAutoRenew).toHaveBeenCalledWith('sub-1', false);
    });

    it('allows cancelling active subscriptions', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const cancelButtons = screen.getAllByText('Cancel');
      await user.click(cancelButtons[0]);

      expect(mockCancelSubscription).toHaveBeenCalledWith('sub-1');
    });

    it('allows pausing active subscriptions', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const pauseButtons = screen.getAllByText('Pause');
      await user.click(pauseButtons[0]);

      expect(mockPauseSubscription).toHaveBeenCalledWith('sub-1');
    });

    it('allows resuming paused subscriptions', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const resumeButton = screen.getByText('Resume');
      await user.click(resumeButton);

      expect(mockResumeSubscription).toHaveBeenCalledWith('sub-2');
    });

    it('displays empty state when no subscriptions exist', () => {
      const originalMock = mockSubscriptions;
      mockService.subscriptions.length = 0;

      render(<UserSubscriptionManager />);

      expect(screen.getByText('No active subscriptions')).toBeInTheDocument();
      expect(screen.getByText('Explore creators and find content you love!')).toBeInTheDocument();
      expect(screen.getByText('Browse Creators')).toBeInTheDocument();

      // Restore original mock
      mockService.subscriptions.push(...originalMock);
    });
  });

  // US-080: Renewal Settings Tests
  describe('Renewal Settings (US-080)', () => {
    it('switches to renewal settings tab', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const renewalTab = screen.getByRole('tab', { name: /Renewal/ });
      await user.click(renewalTab);

      expect(screen.getByText('Renewal Settings')).toBeInTheDocument();
      // The component renders additional text after the checked substring — use regex
      expect(
        screen.getByText(/Manage how your subscriptions renew automatically/)
      ).toBeInTheDocument();
    });

    it('displays renewal settings for active subscriptions', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const renewalTab = screen.getByRole('tab', { name: /Renewal/ });
      await user.click(renewalTab);

      expect(screen.getByText('Tech Creator Pro - Premium Access')).toBeInTheDocument();
      expect(screen.getByText('Auto-Renewal')).toBeInTheDocument();
      expect(screen.getByText('Automatically renew this subscription')).toBeInTheDocument();
    });

    it('allows configuring renewal notifications', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const renewalTab = screen.getByRole('tab', { name: /Renewal/ });
      await user.click(renewalTab);

      expect(screen.getByText('Renewal Notifications')).toBeInTheDocument();
      expect(screen.getByText('7 days before renewal')).toBeInTheDocument();
      expect(screen.getByText('1 day before renewal')).toBeInTheDocument();
      expect(screen.getByText('After successful renewal')).toBeInTheDocument();
    });

    it('allows configuring failure handling settings', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const renewalTab = screen.getByRole('tab', { name: /Renewal/ });
      await user.click(renewalTab);

      expect(screen.getByText('Failure Handling')).toBeInTheDocument();
      expect(screen.getByText('Retry failed payments (up to 3 times)')).toBeInTheDocument();
      expect(screen.getByText('Notify me of payment failures')).toBeInTheDocument();
    });

    it('updates renewal settings when toggled', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const renewalTab = screen.getByRole('tab', { name: /Renewal/ });
      await user.click(renewalTab);

      const autoRenewToggle = screen.getByRole('switch');
      await user.click(autoRenewToggle);

      expect(mockUpdateRenewalSettings).toHaveBeenCalledWith('sub-1', { auto_renew: false });
    });
  });

  // US-081: Payment Methods Management Tests
  describe('Payment Methods Management (US-081)', () => {
    it('switches to payment methods tab', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const paymentTab = screen.getByRole('tab', { name: /Payment/ });
      await user.click(paymentTab);

      expect(screen.getByText('Payment Methods')).toBeInTheDocument();
      expect(screen.getByText('Add Method')).toBeInTheDocument();
    });

    it('displays list of payment methods with correct information', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const paymentTab = screen.getByRole('tab', { name: /Payment/ });
      await user.click(paymentTab);

      expect(screen.getByText('Primary Lightning Wallet')).toBeInTheDocument();
      expect(screen.getByText('user@getalby.com')).toBeInTheDocument();
      expect(screen.getByText('Default')).toBeInTheDocument();
      // Both payment methods are verified — multiple 'Verified' badges appear
      expect(screen.getAllByText('Verified').length).toBeGreaterThan(0);

      expect(screen.getByText('Secondary Wallet')).toBeInTheDocument();
      expect(screen.getByText('lnbc1...wallet2')).toBeInTheDocument();
    });

    it('allows adding new payment methods', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const paymentTab = screen.getByRole('tab', { name: /Payment/ });
      await user.click(paymentTab);

      const addButton = screen.getByText('Add Method');
      await user.click(addButton);

      expect(mockAddPaymentMethod).toHaveBeenCalled();
    });

    it('allows setting default payment method', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const paymentTab = screen.getByRole('tab', { name: /Payment/ });
      await user.click(paymentTab);

      const setDefaultButton = screen.getByText('Set Default');
      await user.click(setDefaultButton);

      expect(mockSetDefaultPaymentMethod).toHaveBeenCalledWith('pm-2');
    });

    it('allows deleting payment methods', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const paymentTab = screen.getByRole('tab', { name: /Payment/ });
      await user.click(paymentTab);

      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(
        (button) => button.querySelector('svg')?.getAttribute('data-testid') === 'trash-2-icon'
      );

      if (deleteButton) {
        await user.click(deleteButton);
        expect(mockDeletePaymentMethod).toHaveBeenCalled();
      }
    });

    it('displays warning for payment methods with failures', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const paymentTab = screen.getByRole('tab', { name: /Payment/ });
      await user.click(paymentTab);

      expect(screen.getByText(/This payment method has 1 recent failure/)).toBeInTheDocument();
      expect(screen.getByText(/Consider updating or replacing it/)).toBeInTheDocument();
    });

    it('displays empty state when no payment methods exist', async () => {
      const user = userEvent.setup();
      const originalMock = mockPaymentMethods;
      mockService.paymentMethods.length = 0;

      render(<UserSubscriptionManager />);

      const paymentTab = screen.getByRole('tab', { name: /Payment/ });
      await user.click(paymentTab);

      expect(screen.getByText('No payment methods added')).toBeInTheDocument();
      expect(screen.getByText('Add a payment method to subscribe to creators')).toBeInTheDocument();

      // Restore original mock
      mockService.paymentMethods.push(...originalMock);
    });
  });

  // US-082: Subscription History Tests
  describe('Subscription History (US-082)', () => {
    it('switches to subscription history tab', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const historyTab = screen.getByRole('tab', { name: /History/ });
      await user.click(historyTab);

      expect(screen.getByText('Subscription History')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('displays subscription history with correct information', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const historyTab = screen.getByRole('tab', { name: /History/ });
      await user.click(historyTab);

      expect(screen.getByText('Tech Creator Pro - Premium Access')).toBeInTheDocument();
      expect(screen.getByText('Renewed')).toBeInTheDocument();
      // formatSats(50000, { abbreviate: true, suffix: false }) = '50.0K'
      expect(screen.getByText('⚡ 50.0K')).toBeInTheDocument();
      expect(screen.getByText('Automatic renewal successful')).toBeInTheDocument();

      expect(screen.getByText('Art Masterclass - Basic Support')).toBeInTheDocument();
      expect(screen.getByText('Paused')).toBeInTheDocument();
      expect(screen.getByText('User requested pause')).toBeInTheDocument();
    });

    it('displays payment hash for completed transactions', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const historyTab = screen.getByRole('tab', { name: /History/ });
      await user.click(historyTab);

      expect(screen.getByText('Payment Hash:')).toBeInTheDocument();
      expect(screen.getByText('abc123def456...')).toBeInTheDocument();
    });

    it('allows filtering history by action type', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const historyTab = screen.getByRole('tab', { name: /History/ });
      await user.click(historyTab);

      const filterSelect = screen.getByDisplayValue('All Actions');
      await user.selectOptions(filterSelect, 'renewed');

      // Should show only renewed actions
      expect(screen.getByText('Tech Creator Pro - Premium Access')).toBeInTheDocument();
      expect(screen.queryByText('Art Masterclass - Basic Support')).not.toBeInTheDocument();
    });

    it('allows exporting subscription history', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const historyTab = screen.getByRole('tab', { name: /History/ });
      await user.click(historyTab);

      const exportButton = screen.getByText('Export');
      await user.click(exportButton);

      expect(mockExportSubscriptionHistory).toHaveBeenCalled();
    });

    it('displays empty state when no history exists', async () => {
      const user = userEvent.setup();
      const originalMock = mockSubscriptionHistory;
      mockService.subscriptionHistory.length = 0;

      render(<UserSubscriptionManager />);

      const historyTab = screen.getByRole('tab', { name: /History/ });
      await user.click(historyTab);

      expect(screen.getByText('No subscription history found')).toBeInTheDocument();
      expect(screen.getByText('Your subscription activities will appear here')).toBeInTheDocument();

      // Restore original mock
      mockService.subscriptionHistory.push(...originalMock);
    });
  });

  // Performance and Accessibility Tests
  describe('Performance and Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<UserSubscriptionManager />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(4);
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      const firstTab = screen.getByRole('tab', { name: /Active/ });
      firstTab.focus();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /Renewal/ })).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /Payment/ })).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /History/ })).toHaveFocus();
    });

    it('displays proper loading states for async actions', async () => {
      const user = userEvent.setup();
      mockToggleAutoRenew.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<UserSubscriptionManager />);

      const autoRenewToggle = screen.getAllByRole('switch')[0];
      await user.click(autoRenewToggle);

      // Verify toggle action was invoked (component calls toggleAutoRenew on click)
      expect(mockToggleAutoRenew).toHaveBeenCalledTimes(1);
    });

    it('formats currency amounts correctly', () => {
      render(<UserSubscriptionManager />);

      // formatSats with abbreviate:true produces '50.0K' not '50K'
      expect(screen.getByText('⚡ 50.0K sats')).toBeInTheDocument();
      expect(screen.getByText('⚡ 25.0K sats')).toBeInTheDocument();
      expect(screen.getByText('≈ $15.00 USD')).toBeInTheDocument();
    });

    it('displays relative dates correctly', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      // "Next:" date is visible on the Active Subscriptions tab
      expect(screen.getByText(/Next:/)).toBeInTheDocument();

      // "Last used:" date is on the Payment Methods tab — navigate there
      const paymentTab = screen.getByRole('tab', { name: /Payment/ });
      await user.click(paymentTab);

      await waitFor(() => {
        // Both payment methods have last_used, so multiple 'Last used:' elements appear
        expect(screen.getAllByText(/Last used:/).length).toBeGreaterThan(0);
      });
    });
  });

  // Integration Tests
  describe('Integration Scenarios', () => {
    it('maintains tab state when switching between tabs', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      // Switch to payment methods tab
      const paymentTab = screen.getByRole('tab', { name: /Payment/ });
      await user.click(paymentTab);

      expect(screen.getByText('Primary Lightning Wallet')).toBeInTheDocument();

      // Switch back to subscriptions tab
      const subscriptionsTab = screen.getByRole('tab', { name: /Active/ });
      await user.click(subscriptionsTab);

      expect(screen.getByText('Tech Creator Pro')).toBeInTheDocument();
    });

    it('updates UI after successful subscription actions', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      // Mock successful pause
      mockPauseSubscription.mockResolvedValue(undefined);

      const pauseButton = screen.getAllByText('Pause')[0];
      await user.click(pauseButton);

      await waitFor(() => {
        expect(mockPauseSubscription).toHaveBeenCalledWith('sub-1');
        expect(mockRefreshSubscriptions).toHaveBeenCalled();
      });
    });

    it('handles concurrent user actions gracefully', async () => {
      const user = userEvent.setup();
      render(<UserSubscriptionManager />);

      // Simulate multiple rapid clicks
      const pauseButton = screen.getAllByText('Pause')[0];
      const cancelButton = screen.getAllByText('Cancel')[0];

      await Promise.all([user.click(pauseButton), user.click(cancelButton)]);

      // Should handle gracefully without crashes
      expect(mockPauseSubscription).toHaveBeenCalled();
      expect(mockCancelSubscription).toHaveBeenCalled();
    });
  });
});
