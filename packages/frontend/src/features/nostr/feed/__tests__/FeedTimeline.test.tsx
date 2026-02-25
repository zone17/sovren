/**
 * FeedTimeline Component Tests
 * Comprehensive test coverage for feed functionality
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FeedTimeline } from '../components/FeedTimeline';
import type { FeedTimelineProps } from '../types';
import { useFeedSubscription } from '../hooks/useFeedSubscription';

// Mock the hooks
vi.mock('../hooks/useFeedSubscription', () => ({
  useFeedSubscription: vi.fn(() => ({
    events: [],
    isLoading: false,
    error: null,
    hasMore: true,
    subscriptionId: null,
    isSubscribed: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    refresh: vi.fn(),
    addOptimisticUpdate: vi.fn(),
  })),
}));

vi.mock('../hooks/useFeedFilters', () => ({
  useFeedFilters: vi.fn(() => ({
    filters: { kinds: [1, 6, 7] },
    updateFilters: vi.fn(),
    clearFilters: vi.fn(),
    addAuthor: vi.fn(),
    removeAuthor: vi.fn(),
    addHashtag: vi.fn(),
    removeHashtag: vi.fn(),
    setDateRange: vi.fn(),
  })),
}));

describe('FeedTimeline', () => {
  const defaultProps: FeedTimelineProps = {
    initialSort: 'latest',
    autoUpdate: true,
    pageSize: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return value so previous test's mockReturnValue overrides don't bleed through
    vi.mocked(useFeedSubscription).mockReturnValue({
      events: [],
      isLoading: false,
      error: null,
      hasMore: true,
      subscriptionId: null,
      isSubscribed: false,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      refresh: vi.fn(),
      addOptimisticUpdate: vi.fn(),
    });
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<FeedTimeline {...defaultProps} />);
      expect(screen.getByRole('feed')).toBeInTheDocument();
    });

    it('renders filters component', () => {
      render(<FeedTimeline {...defaultProps} />);
      expect(screen.getByLabelText(/toggle filters/i)).toBeInTheDocument();
    });

    it('renders sort component', () => {
      render(<FeedTimeline {...defaultProps} />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      render(<FeedTimeline {...defaultProps} />);
      expect(screen.getByLabelText(/refresh feed/i)).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      vi.mocked(useFeedSubscription).mockReturnValue({
        events: [],
        isLoading: true,
        error: null,
        hasMore: true,
        subscriptionId: null,
        isSubscribed: false,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        refresh: vi.fn(),
        addOptimisticUpdate: vi.fn(),
      });

      render(<FeedTimeline {...defaultProps} />);
      expect(screen.getByText(/loading feed/i)).toBeInTheDocument();
    });

    it('shows empty state when no events', () => {
      render(<FeedTimeline {...defaultProps} />);
      // FeedEmpty renders "No posts yet. Be the first to share something!" by default
      expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();
    });

    it('shows custom empty message when provided', () => {
      const emptyMessage = 'Custom empty message';
      render(<FeedTimeline {...defaultProps} emptyMessage={emptyMessage} />);
      expect(screen.getByText(emptyMessage)).toBeInTheDocument();
    });

    it('displays error message when error occurs', () => {
      const errorMessage = 'Failed to load feed';
      vi.mocked(useFeedSubscription).mockReturnValue({
        events: [],
        isLoading: false,
        error: errorMessage,
        hasMore: false,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        refresh: vi.fn(),
        addOptimisticUpdate: vi.fn(),
      });

      render(<FeedTimeline {...defaultProps} />);
      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });
  });

  describe('Interactions', () => {
    it('calls refresh when refresh button is clicked', async () => {
      const mockRefresh = vi.fn();
      vi.mocked(useFeedSubscription).mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
        hasMore: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        refresh: mockRefresh,
        addOptimisticUpdate: vi.fn(),
        subscriptionId: null,
        isSubscribed: false,
      });

      render(<FeedTimeline {...defaultProps} />);
      const refreshButton = screen.getByLabelText(/refresh feed/i);

      await userEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });

    it('disables refresh button when loading', () => {
      vi.mocked(useFeedSubscription).mockReturnValue({
        events: [],
        isLoading: true,
        error: null,
        hasMore: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        refresh: vi.fn(),
        addOptimisticUpdate: vi.fn(),
        subscriptionId: null,
        isSubscribed: false,
      });

      render(<FeedTimeline {...defaultProps} />);
      const refreshButton = screen.getByLabelText(/refresh feed/i);

      expect(refreshButton).toBeDisabled();
    });

    it('updates sort state when sort option is clicked', async () => {
      vi.mocked(useFeedSubscription).mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
        hasMore: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        refresh: vi.fn(),
        addOptimisticUpdate: vi.fn(),
        subscriptionId: null,
        isSubscribed: false,
      });

      render(<FeedTimeline {...defaultProps} />);

      // FeedSort renders buttons with role="tab" and aria-label like "Popular: Most liked posts"
      const popularTab = screen.getByRole('tab', { name: /popular/i });
      await userEvent.click(popularTab);

      // After clicking, Popular tab should be aria-selected=true (active state)
      await waitFor(() => {
        expect(popularTab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<FeedTimeline {...defaultProps} />);

      expect(screen.getByRole('feed')).toHaveAttribute('aria-busy');
      expect(screen.getByRole('feed')).toHaveAttribute('aria-live', 'polite');
    });

    it('announces loading state to screen readers', () => {
      vi.mocked(useFeedSubscription).mockReturnValue({
        events: [],
        isLoading: true,
        error: null,
        hasMore: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        refresh: vi.fn(),
        addOptimisticUpdate: vi.fn(),
      });

      render(<FeedTimeline {...defaultProps} />);

      expect(screen.getByRole('feed')).toHaveAttribute('aria-busy', 'true');
    });

    it('has keyboard navigable controls', () => {
      vi.mocked(useFeedSubscription).mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
        hasMore: true,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        refresh: vi.fn(),
        addOptimisticUpdate: vi.fn(),
        subscriptionId: null,
        isSubscribed: false,
      });

      render(<FeedTimeline {...defaultProps} />);

      const filterButton = screen.getByLabelText(/toggle filters/i);
      // Verify the control exists and is not disabled (keyboard navigable)
      expect(filterButton).toBeInTheDocument();
      expect(filterButton).not.toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing optional props gracefully', () => {
      render(<FeedTimeline />);
      expect(screen.getByRole('feed')).toBeInTheDocument();
    });

    it('handles empty filters object', () => {
      render(<FeedTimeline filters={{}} />);
      expect(screen.getByRole('feed')).toBeInTheDocument();
    });

    it('unsubscribes on unmount', () => {
      const mockUnsubscribe = vi.fn();
      vi.mocked(useFeedSubscription).mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
        hasMore: true,
        subscribe: vi.fn(),
        unsubscribe: mockUnsubscribe,
        refresh: vi.fn(),
        addOptimisticUpdate: vi.fn(),
      });

      const { unmount } = render(<FeedTimeline {...defaultProps} />);
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
