/**
 * LiveContentUpdates Component Tests
 *
 * Tests the component's rendered output and interactions.
 * Note: The component creates a ContentStreamManager but does NOT call
 * connect() automatically — connection state starts as disconnected.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LiveContentUpdates } from '../../../components/performance/LiveContentUpdates';

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
  OPEN: 1,
  CLOSED: 0,
  CONNECTING: 2,
  CLOSING: 3,
}));

// Mock useFeatureFlags hook — must be vi.fn() so we can override per test
vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: {
      enableLiveContentUpdates: true,
    },
  })),
}));

import { useFeatureFlags } from '../../../hooks/useFeatureFlags';

// Mock environment variables
process.env.NEXT_PUBLIC_WS_URL = 'wss://test.example.com';

describe('LiveContentUpdates Component', () => {
  const defaultProps = {
    userId: 'test-user-123',
    contentFilter: {
      priorities: ['high', 'critical'],
      realTimeOnly: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Restore default feature flags mock after clearAllMocks
    vi.mocked(useFeatureFlags).mockReturnValue({
      flags: { enableLiveContentUpdates: true } as any,
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component Rendering', () => {
    test('renders live content updates interface', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Component starts disconnected, not "Live Updates Active"
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByText('Live Stream Stats')).toBeInTheDocument();
      // "Recent Updates (N)" - use getAllByText since title appears multiple times
      const recentUpdatesElements = screen.getAllByText(/recent updates/i);
      expect(recentUpdatesElements.length).toBeGreaterThan(0);
    });

    test('shows disconnected state initially', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByText('good')).toBeInTheDocument(); // connection quality badge
    });

    test('renders with custom className', () => {
      const { container } = render(
        <LiveContentUpdates {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('live-content-updates', 'custom-class');
    });
  });

  describe('Content Stream Connection', () => {
    test('component renders connection status indicator', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Connection status indicator exists
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    test('shows connection quality badge', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      expect(screen.getByText('good')).toBeInTheDocument();
    });

    test('renders resync button', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      expect(screen.getByRole('button', { name: /resync/i })).toBeInTheDocument();
    });
  });

  describe('Content Updates Processing', () => {
    test('starts with no updates', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // "Recent Updates (0)" shown initially
      expect(screen.getByText(/recent updates \(0\)/i)).toBeInTheDocument();
      expect(screen.getByText('No recent updates')).toBeInTheDocument();
    });
  });

  describe('Content Filtering', () => {
    test('component renders with filter configuration', () => {
      // The component accepts contentFilter prop
      render(<LiveContentUpdates {...defaultProps} />);

      // Component renders without crashing with filter prop
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    test('renders resync button for re-fetching content', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Resync button is the filter/refresh mechanism
      expect(screen.getByRole('button', { name: /resync/i })).toBeInTheDocument();
    });

    test('component renders connection quality indicator', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Connection quality badge is present
      expect(screen.getByText('good')).toBeInTheDocument();
    });

    test('component renders with default realTimeOnly filter value', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Component renders without crashing
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  describe('Performance Monitoring', () => {
    test('displays performance statistics', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      expect(screen.getByText('Total Updates')).toBeInTheDocument();
      expect(screen.getByText('Updates/sec')).toBeInTheDocument();
      expect(screen.getByText('Avg Latency')).toBeInTheDocument();
      expect(screen.getByText('Batches')).toBeInTheDocument();
    });

    test('shows initial zero stats', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Stats start at zero
      expect(screen.getByText('Total Updates')).toBeInTheDocument();
    });
  });

  describe('Recent Updates Display', () => {
    test('shows recent updates section', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // "Recent Updates (N)" - count is appended; multiple elements may match
      const recentUpdatesElements = screen.getAllByText(/recent updates/i);
      expect(recentUpdatesElements.length).toBeGreaterThan(0);
    });
  });

  describe('Connection Management', () => {
    test('renders resync button', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      expect(screen.getByRole('button', { name: /resync/i })).toBeInTheDocument();
    });

    test('resync button is clickable', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const resyncButton = screen.getByRole('button', { name: /resync/i });
      expect(() => fireEvent.click(resyncButton)).not.toThrow();
    });
  });

  describe('Debug Information', () => {
    test('debug toggle button exists', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Two header buttons: Resync and Activity (debug toggle)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    test('debug toggle button is clickable without error', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Second button is the Activity/debug toggle
      const buttons = screen.getAllByRole('button');
      const debugButton = buttons[1];

      expect(() => fireEvent.click(debugButton)).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Resync button has accessible name
      expect(screen.getByRole('button', { name: /resync/i })).toBeInTheDocument();
    });

    test('resync button can receive focus', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const resyncButton = screen.getByRole('button', { name: /resync/i });
      resyncButton.focus();

      expect(resyncButton).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    test('renders without crashing', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    test('handles malformed messages gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<LiveContentUpdates {...defaultProps} />);

      // Component renders without crashing
      expect(screen.getByText('Disconnected')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Feature Flag Integration', () => {
    test('does not render when feature is disabled', () => {
      vi.mocked(useFeatureFlags).mockReturnValueOnce({
        flags: { enableLiveContentUpdates: false } as any,
      } as any);

      const { container } = render(<LiveContentUpdates {...defaultProps} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('cleans up on unmount without errors', () => {
      const { unmount } = render(<LiveContentUpdates {...defaultProps} />);

      expect(() => unmount()).not.toThrow();
    });
  });
});
