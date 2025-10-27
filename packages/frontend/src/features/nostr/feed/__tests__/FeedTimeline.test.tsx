/**
 * FeedTimeline Component Tests
 * Comprehensive test coverage for feed functionality
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FeedTimeline } from '../components/FeedTimeline';
import type { FeedTimelineProps } from '../types';

// Mock the hooks
jest.mock('../hooks/useFeedSubscription', () => ({
  useFeedSubscription: jest.fn(() => ({
    events: [],
    isLoading: false,
    error: null,
    hasMore: true,
    subscriptionId: null,
    isSubscribed: false,
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    refresh: jest.fn(),
    addOptimisticUpdate: jest.fn(),
  })),
}));

jest.mock('../hooks/useFeedFilters', () => ({
  useFeedFilters: jest.fn(() => ({
    filters: { kinds: [1, 6, 7] },
    updateFilters: jest.fn(),
    clearFilters: jest.fn(),
    addAuthor: jest.fn(),
    removeAuthor: jest.fn(),
    addHashtag: jest.fn(),
    removeHashtag: jest.fn(),
    setDateRange: jest.fn(),
  })),
}));

describe('FeedTimeline', () => {
  const defaultProps: FeedTimelineProps = {
    initialSort: 'latest',
    autoUpdate: true,
    pageSize: 20,
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
      const { useFeedSubscription } = require('../hooks/useFeedSubscription');
      useFeedSubscription.mockReturnValue({
        events: [],
        isLoading: true,
        error: null,
        hasMore: true,
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        refresh: jest.fn(),
        addOptimisticUpdate: jest.fn(),
      });

      render(<FeedTimeline {...defaultProps} />);
      expect(screen.getByText(/loading feed/i)).toBeInTheDocument();
    });

    it('shows empty state when no events', () => {
      render(<FeedTimeline {...defaultProps} />);
      expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();
    });

    it('shows custom empty message when provided', () => {
      const emptyMessage = 'Custom empty message';
      render(<FeedTimeline {...defaultProps} emptyMessage={emptyMessage} />);
      expect(screen.getByText(emptyMessage)).toBeInTheDocument();
    });

    it('displays error message when error occurs', () => {
      const { useFeedSubscription } = require('../hooks/useFeedSubscription');
      const errorMessage = 'Failed to load feed';
      useFeedSubscription.mockReturnValue({
        events: [],
        isLoading: false,
        error: errorMessage,
        hasMore: false,
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        refresh: jest.fn(),
        addOptimisticUpdate: jest.fn(),
      });

      render(<FeedTimeline {...defaultProps} />);
      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    });
  });

  describe('Interactions', () => {
    it('calls refresh when refresh button is clicked', async () => {
      const { useFeedSubscription } = require('../hooks/useFeedSubscription');
      const mockRefresh = jest.fn();
      useFeedSubscription.mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
        hasMore: true,
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        refresh: mockRefresh,
        addOptimisticUpdate: jest.fn(),
        subscriptionId: null,
        isSubscribed: false,
      });

      render(<FeedTimeline {...defaultProps} />);
      const refreshButton = screen.getByLabelText(/refresh feed/i);

      await userEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });

    it('disables refresh button when loading', () => {
      const { useFeedSubscription } = require('../hooks/useFeedSubscription');
      useFeedSubscription.mockReturnValue({
        events: [],
        isLoading: true,
        error: null,
        hasMore: true,
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        refresh: jest.fn(),
        addOptimisticUpdate: jest.fn(),
        subscriptionId: null,
        isSubscribed: false,
      });

      render(<FeedTimeline {...defaultProps} />);
      const refreshButton = screen.getByLabelText(/refresh feed/i);

      expect(refreshButton).toBeDisabled();
    });

    it('updates sort state when sort option is clicked', async () => {
      const { useFeedSubscription } = require('../hooks/useFeedSubscription');
      useFeedSubscription.mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
        hasMore: true,
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        refresh: jest.fn(),
        addOptimisticUpdate: jest.fn(),
        subscriptionId: null,
        isSubscribed: false,
      });

      render(<FeedTimeline {...defaultProps} />);

      const popularButton = screen.getByText('Popular');
      await userEvent.click(popularButton);

      // After clicking, Popular should be selected (active state)
      await waitFor(() => {
        expect(popularButton).toHaveClass('bg-blue-500', 'text-white');
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
      const { useFeedSubscription } = require('../hooks/useFeedSubscription');
      useFeedSubscription.mockReturnValue({
        events: [],
        isLoading: true,
        error: null,
        hasMore: true,
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        refresh: jest.fn(),
        addOptimisticUpdate: jest.fn(),
      });

      render(<FeedTimeline {...defaultProps} />);

      expect(screen.getByRole('feed')).toHaveAttribute('aria-busy', 'true');
    });

    it('has keyboard navigable controls', () => {
      const { useFeedSubscription } = require('../hooks/useFeedSubscription');
      useFeedSubscription.mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
        hasMore: true,
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        refresh: jest.fn(),
        addOptimisticUpdate: jest.fn(),
        subscriptionId: null,
        isSubscribed: false,
      });

      render(<FeedTimeline {...defaultProps} />);

      const filterButton = screen.getByLabelText(/toggle filters/i);
      fireEvent.focus(filterButton);

      expect(filterButton).toHaveFocus();
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
      const { useFeedSubscription } = require('../hooks/useFeedSubscription');
      const mockUnsubscribe = jest.fn();
      useFeedSubscription.mockReturnValue({
        events: [],
        isLoading: false,
        error: null,
        hasMore: true,
        subscribe: jest.fn(),
        unsubscribe: mockUnsubscribe,
        refresh: jest.fn(),
        addOptimisticUpdate: jest.fn(),
      });

      const { unmount } = render(<FeedTimeline {...defaultProps} />);
      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
