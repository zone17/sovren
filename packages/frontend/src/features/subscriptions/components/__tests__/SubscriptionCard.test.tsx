/**
 * 🧪 **SUBSCRIPTION CARD COMPONENT TESTS**
 *
 * Comprehensive test suite for SubscriptionCard component
 * Story: PAY-005 - Build Subscription Management UI Components
 *
 * Coverage: ≥95%
 * Elite Testing Standards:
 * - Rendering tests for all states
 * - Interaction tests for all actions
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Edge case handling
 *
 * @module SubscriptionCard.test
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import {
  SubscriptionCard,
  Subscription,
  SubscriptionCardProps,
} from '../SubscriptionCard';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// 🎭 **TEST DATA**

const createMockSubscription = (overrides?: Partial<Subscription>): Subscription => ({
  id: 'sub-123',
  name: 'Test Creator',
  description: 'Premium content subscription',
  tierName: 'Premium',
  amount: 50000,
  status: 'active',
  billingInterval: 'monthly',
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-02-01T00:00:00Z',
  nextPaymentDate: '2024-02-01T00:00:00Z',
  autoRenew: true,
  benefits: ['Premium Content', 'Direct Messaging', 'Early Access'],
  subscriberCount: 42,
  ...overrides,
});

const createMockActions = () => ({
  onView: vi.fn(),
  onEdit: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onCancel: vi.fn(),
  onDelete: vi.fn(),
});

// 🧪 **TEST SUITES**

describe('SubscriptionCard', () => {
  describe('Rendering', () => {
    it('renders subscription with all basic information', () => {
      const subscription = createMockSubscription();
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByRole('article', { name: /Subscription: Test Creator/i })).toBeInTheDocument();
      expect(screen.getByText('Test Creator')).toBeInTheDocument();
      expect(screen.getByText('Premium content subscription')).toBeInTheDocument();
      expect(screen.getByText('Premium')).toBeInTheDocument();
      expect(screen.getByText(/50K/i)).toBeInTheDocument();
      expect(screen.getByText(/month/i)).toBeInTheDocument();
    });

    it('renders active status badge correctly', () => {
      const subscription = createMockSubscription({ status: 'active' });
      render(<SubscriptionCard subscription={subscription} />);

      const badge = screen.getByText(/active/i);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-green-100');
    });

    it('renders paused status badge correctly', () => {
      const subscription = createMockSubscription({ status: 'paused' });
      render(<SubscriptionCard subscription={subscription} />);

      const badge = screen.getByText(/paused/i);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-yellow-100');
    });

    it('renders cancelled status badge correctly', () => {
      const subscription = createMockSubscription({ status: 'cancelled' });
      render(<SubscriptionCard subscription={subscription} />);

      const badge = screen.getByText(/cancelled/i);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-100');
    });

    it('renders expired status badge correctly', () => {
      const subscription = createMockSubscription({ status: 'expired' });
      render(<SubscriptionCard subscription={subscription} />);

      const badge = screen.getByText(/expired/i);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-gray-100');
    });

    it('renders pending status badge correctly', () => {
      const subscription = createMockSubscription({ status: 'pending' });
      render(<SubscriptionCard subscription={subscription} />);

      const badge = screen.getByText(/pending/i);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-blue-100');
    });

    it('displays avatar image when avatarUrl is provided', () => {
      const subscription = createMockSubscription({
        avatarUrl: 'https://example.com/avatar.jpg',
      });
      render(<SubscriptionCard subscription={subscription} />);

      const avatar = screen.getByAltText('Test Creator avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('displays fallback avatar when no avatarUrl is provided', () => {
      const subscription = createMockSubscription({ avatarUrl: undefined });
      render(<SubscriptionCard subscription={subscription} />);

      const fallbackAvatar = screen.getByLabelText('Subscription avatar');
      expect(fallbackAvatar).toBeInTheDocument();
      expect(fallbackAvatar).toHaveTextContent('T');
    });

    it('displays all subscription benefits', () => {
      const subscription = createMockSubscription({
        benefits: ['Benefit 1', 'Benefit 2', 'Benefit 3'],
      });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('Benefit 1')).toBeInTheDocument();
      expect(screen.getByText('Benefit 2')).toBeInTheDocument();
      expect(screen.getByText('Benefit 3')).toBeInTheDocument();
    });

    it('truncates benefits list when more than 3 benefits', () => {
      const subscription = createMockSubscription({
        benefits: ['Benefit 1', 'Benefit 2', 'Benefit 3', 'Benefit 4', 'Benefit 5'],
      });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('Benefit 1')).toBeInTheDocument();
      expect(screen.getByText('Benefit 2')).toBeInTheDocument();
      expect(screen.getByText('Benefit 3')).toBeInTheDocument();
      expect(screen.getByText('+2 more benefits')).toBeInTheDocument();
      expect(screen.queryByText('Benefit 4')).not.toBeInTheDocument();
    });

    it('displays next payment date when subscription is active', () => {
      const subscription = createMockSubscription({
        status: 'active',
        nextPaymentDate: '2024-02-15T00:00:00Z',
      });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('Next Payment')).toBeInTheDocument();
      expect(screen.getByText(/2\/15\/2024/)).toBeInTheDocument();
    });

    it('does not display next payment date when subscription is cancelled', () => {
      const subscription = createMockSubscription({
        status: 'cancelled',
        nextPaymentDate: '2024-02-15T00:00:00Z',
      });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.queryByText('Next Payment')).not.toBeInTheDocument();
    });

    it('displays auto-renew status for active subscriptions', () => {
      const subscription = createMockSubscription({
        status: 'active',
        autoRenew: true,
      });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('Auto-renew')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    it('displays subscriber count in creator variant with stats', () => {
      const subscription = createMockSubscription({ subscriberCount: 42 });
      render(
        <SubscriptionCard
          subscription={subscription}
          variant="creator"
          showStats={true}
        />
      );

      expect(screen.getByText('Subscribers')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('does not display subscriber count in user variant', () => {
      const subscription = createMockSubscription({ subscriberCount: 42 });
      render(<SubscriptionCard subscription={subscription} variant="user" />);

      expect(screen.queryByText('Subscribers')).not.toBeInTheDocument();
    });
  });

  describe('Pricing Display', () => {
    it('formats large amounts with M suffix', () => {
      const subscription = createMockSubscription({ amount: 1500000 });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('1.5M')).toBeInTheDocument();
    });

    it('formats medium amounts with K suffix', () => {
      const subscription = createMockSubscription({ amount: 50000 });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('50.0K')).toBeInTheDocument();
    });

    it('formats small amounts without suffix', () => {
      const subscription = createMockSubscription({ amount: 500 });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('displays monthly billing interval', () => {
      const subscription = createMockSubscription({ billingInterval: 'monthly' });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('/month')).toBeInTheDocument();
    });

    it('displays quarterly billing interval', () => {
      const subscription = createMockSubscription({ billingInterval: 'quarterly' });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('/3 months')).toBeInTheDocument();
    });

    it('displays yearly billing interval', () => {
      const subscription = createMockSubscription({ billingInterval: 'yearly' });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('/year')).toBeInTheDocument();
    });

    it('displays USD conversion', () => {
      const subscription = createMockSubscription({ amount: 100000 });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText(/\$0\.03 USD/)).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onView when View Details button is clicked', () => {
      const subscription = createMockSubscription();
      const actions = createMockActions();
      render(<SubscriptionCard subscription={subscription} actions={actions} />);

      const viewButton = screen.getByRole('button', { name: /View subscription details/i });
      fireEvent.click(viewButton);

      expect(actions.onView).toHaveBeenCalledTimes(1);
      expect(actions.onView).toHaveBeenCalledWith(subscription);
    });

    it('calls onEdit when Edit button is clicked (creator variant)', () => {
      const subscription = createMockSubscription();
      const actions = createMockActions();
      render(
        <SubscriptionCard
          subscription={subscription}
          variant="creator"
          actions={actions}
        />
      );

      const editButton = screen.getByRole('button', { name: /Edit subscription/i });
      fireEvent.click(editButton);

      expect(actions.onEdit).toHaveBeenCalledTimes(1);
      expect(actions.onEdit).toHaveBeenCalledWith(subscription);
    });

    it('calls onPause when Pause button is clicked (active subscription)', () => {
      const subscription = createMockSubscription({ status: 'active' });
      const actions = createMockActions();
      render(<SubscriptionCard subscription={subscription} actions={actions} />);

      const pauseButton = screen.getByRole('button', { name: /Pause subscription/i });
      fireEvent.click(pauseButton);

      expect(actions.onPause).toHaveBeenCalledTimes(1);
      expect(actions.onPause).toHaveBeenCalledWith(subscription);
    });

    it('calls onResume when Resume button is clicked (paused subscription)', () => {
      const subscription = createMockSubscription({ status: 'paused' });
      const actions = createMockActions();
      render(<SubscriptionCard subscription={subscription} actions={actions} />);

      const resumeButton = screen.getByRole('button', { name: /Resume subscription/i });
      fireEvent.click(resumeButton);

      expect(actions.onResume).toHaveBeenCalledTimes(1);
      expect(actions.onResume).toHaveBeenCalledWith(subscription);
    });

    it('calls onCancel when Cancel button is clicked (active subscription)', () => {
      const subscription = createMockSubscription({ status: 'active' });
      const actions = createMockActions();
      render(<SubscriptionCard subscription={subscription} actions={actions} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel subscription/i });
      fireEvent.click(cancelButton);

      expect(actions.onCancel).toHaveBeenCalledTimes(1);
      expect(actions.onCancel).toHaveBeenCalledWith(subscription);
    });

    it('calls onDelete when Delete button is clicked (creator variant)', () => {
      const subscription = createMockSubscription();
      const actions = createMockActions();
      render(
        <SubscriptionCard
          subscription={subscription}
          variant="creator"
          actions={actions}
        />
      );

      const deleteButton = screen.getByRole('button', { name: /Delete subscription tier/i });
      fireEvent.click(deleteButton);

      expect(actions.onDelete).toHaveBeenCalledTimes(1);
      expect(actions.onDelete).toHaveBeenCalledWith(subscription);
    });

    it('disables all action buttons when disabled prop is true', () => {
      const subscription = createMockSubscription({ status: 'active' });
      const actions = createMockActions();
      render(
        <SubscriptionCard
          subscription={subscription}
          actions={actions}
          disabled={true}
        />
      );

      const viewButton = screen.getByRole('button', { name: /View subscription details/i });
      const pauseButton = screen.getByRole('button', { name: /Pause subscription/i });
      const cancelButton = screen.getByRole('button', { name: /Cancel subscription/i });

      expect(viewButton).toBeDisabled();
      expect(pauseButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Conditional Rendering', () => {
    it('does not render action buttons when actions prop is not provided', () => {
      const subscription = createMockSubscription();
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('only renders Pause and Cancel buttons for active subscriptions', () => {
      const subscription = createMockSubscription({ status: 'active' });
      const actions = createMockActions();
      render(<SubscriptionCard subscription={subscription} actions={actions} />);

      expect(screen.getByRole('button', { name: /Pause subscription/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel subscription/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Resume subscription/i })).not.toBeInTheDocument();
    });

    it('only renders Resume button for paused subscriptions', () => {
      const subscription = createMockSubscription({ status: 'paused' });
      const actions = createMockActions();
      render(<SubscriptionCard subscription={subscription} actions={actions} />);

      expect(screen.getByRole('button', { name: /Resume subscription/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel subscription/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Pause subscription/i })).not.toBeInTheDocument();
    });

    it('does not render Edit button in user variant', () => {
      const subscription = createMockSubscription();
      const actions = createMockActions();
      render(
        <SubscriptionCard
          subscription={subscription}
          variant="user"
          actions={actions}
        />
      );

      expect(screen.queryByRole('button', { name: /Edit subscription/i })).not.toBeInTheDocument();
    });

    it('does not render Delete button in user variant', () => {
      const subscription = createMockSubscription();
      const actions = createMockActions();
      render(
        <SubscriptionCard
          subscription={subscription}
          variant="user"
          actions={actions}
        />
      );

      expect(screen.queryByRole('button', { name: /Delete subscription tier/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const subscription = createMockSubscription();
      const { container } = render(<SubscriptionCard subscription={subscription} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper ARIA labels on action buttons', () => {
      const subscription = createMockSubscription({ status: 'active' });
      const actions = createMockActions();
      render(<SubscriptionCard subscription={subscription} actions={actions} />);

      expect(screen.getByRole('button', { name: /View subscription details/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pause subscription/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel subscription/i })).toBeInTheDocument();
    });

    it('has proper role for card element', () => {
      const subscription = createMockSubscription();
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('includes descriptive ARIA labels for status icons', () => {
      const subscription = createMockSubscription({ status: 'active' });
      render(<SubscriptionCard subscription={subscription} />);

      const statusIcon = screen.getByLabelText('Active status');
      expect(statusIcon).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing optional fields gracefully', () => {
      const subscription: Subscription = {
        id: 'sub-123',
        name: 'Minimal Subscription',
        amount: 10000,
        status: 'active',
        billingInterval: 'monthly',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-02-01T00:00:00Z',
        autoRenew: false,
      };

      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('Minimal Subscription')).toBeInTheDocument();
      expect(screen.queryByText('Benefits:')).not.toBeInTheDocument();
      expect(screen.queryByText('Next Payment')).not.toBeInTheDocument();
    });

    it('handles empty benefits array', () => {
      const subscription = createMockSubscription({ benefits: [] });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.queryByText('Benefits:')).not.toBeInTheDocument();
    });

    it('handles undefined benefits', () => {
      const subscription = createMockSubscription({ benefits: undefined });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.queryByText('Benefits:')).not.toBeInTheDocument();
    });

    it('handles payment due today', () => {
      const today = new Date();
      const subscription = createMockSubscription({
        status: 'active',
        nextPaymentDate: today.toISOString(),
      });
      render(<SubscriptionCard subscription={subscription} />);

      expect(screen.getByText('Due today')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const subscription = createMockSubscription();
      const { container } = render(
        <SubscriptionCard subscription={subscription} className="custom-class" />
      );

      const card = container.querySelector('.custom-class');
      expect(card).toBeInTheDocument();
    });

    it('handles zero subscriber count', () => {
      const subscription = createMockSubscription({ subscriberCount: 0 });
      render(
        <SubscriptionCard
          subscription={subscription}
          variant="creator"
          showStats={true}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Visual States', () => {
    it('highlights card when subscription is active', () => {
      const subscription = createMockSubscription({ status: 'active' });
      const { container } = render(<SubscriptionCard subscription={subscription} />);

      const card = container.querySelector('.border-green-200');
      expect(card).toBeInTheDocument();
    });

    it('does not highlight card when subscription is not active', () => {
      const subscription = createMockSubscription({ status: 'expired' });
      const { container } = render(<SubscriptionCard subscription={subscription} />);

      const card = container.querySelector('.border-gray-200');
      expect(card).toBeInTheDocument();
    });

    it('shows warning color for payments due within 7 days', () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 5);

      const subscription = createMockSubscription({
        status: 'active',
        nextPaymentDate: sevenDaysFromNow.toISOString(),
      });
      const { container } = render(<SubscriptionCard subscription={subscription} />);

      const warningSection = container.querySelector('.bg-orange-50');
      expect(warningSection).toBeInTheDocument();
    });
  });
});
