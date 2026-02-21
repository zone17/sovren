/**
 * 🧪 **LIVE CONTENT UPDATES TESTS** 🧪
 * 
 * Comprehensive test suite for Live Content Updates component
 * Testing all functionality including streaming, synchronization, and performance
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

// Mock useFeatureFlags hook
vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      enableLiveContentUpdates: true,
    },
  }),
}));

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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component Rendering', () => {
    test('renders live content updates interface', () => {
      render(<LiveContentUpdates {...defaultProps} />);
      
      expect(screen.getByText('Live Updates Active')).toBeInTheDocument();
      expect(screen.getByText('Live Stream Stats')).toBeInTheDocument();
      expect(screen.getByText('Recent Updates')).toBeInTheDocument();
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
    test('initializes content stream manager', async () => {
      render(<LiveContentUpdates {...defaultProps} />);
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('wss://test.example.com/content/stream')
        );
      });
    });

    test('handles connection status updates', async () => {
      render(<LiveContentUpdates {...defaultProps} />);
      
      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      await waitFor(() => {
        expect(screen.getByText('Live Updates Active')).toBeInTheDocument();
      });
    });

    test('handles connection errors', async () => {
      render(<LiveContentUpdates {...defaultProps} />);
      
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onerror(new Error('Connection failed'));
      });

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });
    });
  });

  describe('Content Updates Processing', () => {
    test('processes content updates correctly', async () => {
      const onContentUpdate = vi.fn();
      render(
        <LiveContentUpdates {...defaultProps} onContentUpdate={onContentUpdate} />
      );

      const mockUpdate = {
        id: 'update-123',
        type: 'content_created',
        contentId: 'content-456',
        creatorId: 'creator-789',
        timestamp: new Date().toISOString(),
        data: { title: 'New Content' },
        version: 1,
        priority: 'high',
        source: 'test',
        operation: 'create',
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'content_update',
            data: mockUpdate,
          }),
        });
      });

      await waitFor(() => {
        expect(onContentUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'update-123',
            type: 'content_created',
          })
        );
      });
    });

    test('handles batch content updates', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const batchData = {
        updates: [
          {
            id: 'update-1',
            type: 'content_created',
            contentId: 'content-1',
            creatorId: 'creator-1',
            timestamp: new Date().toISOString(),
            data: {},
            version: 1,
            priority: 'medium',
            source: 'test',
            operation: 'create',
          },
          {
            id: 'update-2',
            type: 'content_updated',
            contentId: 'content-2',
            creatorId: 'creator-2',
            timestamp: new Date().toISOString(),
            data: {},
            version: 2,
            priority: 'high',
            source: 'test',
            operation: 'update',
          },
        ],
        batchId: 'batch-123',
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'content_batch',
            data: batchData,
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // batch count in stats
      });
    });

    test('validates content update data', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      render(<LiveContentUpdates {...defaultProps} />);

      const invalidUpdate = {
        id: 'update-123',
        // Missing required fields
        type: 'invalid_type',
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'content_update',
            data: invalidUpdate,
          }),
        });
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Invalid content update:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Content Filtering', () => {
    test('updates content filter', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const prioritySelect = screen.getByRole('combobox');
      fireEvent.click(prioritySelect);
      
      await waitFor(() => {
        const criticalOption = screen.getByText('Critical');
        fireEvent.click(criticalOption);
      });

      expect(screen.getByDisplayValue('Critical')).toBeInTheDocument();
    });

    test('toggles subscriptions only filter', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const subscriptionsSwitch = screen.getByRole('switch', { name: /subscriptions only/i });
      fireEvent.click(subscriptionsSwitch);

      expect(subscriptionsSwitch).toBeChecked();
    });

    test('toggles real-time only filter', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const realTimeSwitch = screen.getByRole('switch', { name: /real-time only/i });
      fireEvent.click(realTimeSwitch);

      expect(realTimeSwitch).not.toBeChecked();
    });
  });

  describe('Performance Monitoring', () => {
    test('displays performance statistics', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      expect(screen.getByText('Total Updates')).toBeInTheDocument();
      expect(screen.getByText('Updates/sec')).toBeInTheDocument();
      expect(screen.getByText('Avg Latency')).toBeInTheDocument();
      expect(screen.getByText('Batches')).toBeInTheDocument();
    });

    test('updates statistics with content updates', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Simulate multiple updates
      for (let i = 0; i < 5; i++) {
        act(() => {
          const mockWs = (WebSocket as any).mock.results[0].value;
          mockWs.onmessage({
            data: JSON.stringify({
              type: 'content_update',
              data: {
                id: `update-${i}`,
                type: 'content_created',
                contentId: `content-${i}`,
                creatorId: 'creator-123',
                timestamp: new Date().toISOString(),
                data: {},
                version: 1,
                priority: 'medium',
                source: 'test',
                operation: 'create',
              },
            }),
          });
        });
      }

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // total updates
      });
    });

    test('calculates updates per second', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Simulate rapid updates
      act(() => {
        for (let i = 0; i < 3; i++) {
          const mockWs = (WebSocket as any).mock.results[0].value;
          mockWs.onmessage({
            data: JSON.stringify({
              type: 'content_update',
              data: {
                id: `update-${i}`,
                type: 'content_created',
                contentId: `content-${i}`,
                creatorId: 'creator-123',
                timestamp: new Date().toISOString(),
                data: {},
                version: 1,
                priority: 'medium',
                source: 'test',
                operation: 'create',
              },
            }),
          });
        }
      });

      // Advance time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument(); // updates per second
      });
    });
  });

  describe('Recent Updates Display', () => {
    test('displays recent updates list', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const mockUpdate = {
        id: 'update-123',
        type: 'content_published',
        contentId: 'content-456',
        creatorId: 'creator-789',
        timestamp: new Date().toISOString(),
        data: {},
        version: 1,
        priority: 'high',
        source: 'test',
        operation: 'update',
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'content_update',
            data: mockUpdate,
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Recent Updates (1)')).toBeInTheDocument();
        expect(screen.getByText('content published')).toBeInTheDocument();
      });
    });

    test('limits recent updates to maximum count', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      // Simulate 60 updates (more than the 50 limit)
      act(() => {
        for (let i = 0; i < 60; i++) {
          const mockWs = (WebSocket as any).mock.results[0].value;
          mockWs.onmessage({
            data: JSON.stringify({
              type: 'content_update',
              data: {
                id: `update-${i}`,
                type: 'content_created',
                contentId: `content-${i}`,
                creatorId: 'creator-123',
                timestamp: new Date().toISOString(),
                data: {},
                version: 1,
                priority: 'medium',
                source: 'test',
                operation: 'create',
              },
            }),
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Recent Updates (50)')).toBeInTheDocument();
      });
    });
  });

  describe('Connection Management', () => {
    test('handles resync request', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const resyncButton = screen.getByRole('button', { name: /resync/i });
      fireEvent.click(resyncButton);

      await waitFor(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('request_resync')
        );
      });
    });

    test('handles reconnection attempts', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onclose({ code: 1006, reason: 'Connection lost' });
      });

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });
    });
  });

  describe('Debug Information', () => {
    test('toggles debug information display', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const debugButton = screen.getByRole('button', { name: '' }); // Activity icon button
      fireEvent.click(debugButton);

      await waitFor(() => {
        expect(screen.getByText(/conflicts resolved/i)).toBeInTheDocument();
        expect(screen.getByText(/cache hit rate/i)).toBeInTheDocument();
      });
    });

    test('displays comprehensive debug stats', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const debugButton = screen.getByRole('button', { name: '' }); // Activity icon button
      fireEvent.click(debugButton);

      await waitFor(() => {
        expect(screen.getByText(/optimistic updates/i)).toBeInTheDocument();
        expect(screen.getByText(/bandwidth/i)).toBeInTheDocument();
        expect(screen.getByText(/connection quality/i)).toBeInTheDocument();
        expect(screen.getByText(/filter active/i)).toBeInTheDocument();
      });
    });
  });

  describe('Conflict Resolution', () => {
    test('handles content conflicts', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const conflictData = {
        strategy: 'merge',
        local: { content: 'Local content' },
        remote: { content: 'Remote content' },
        metadata: { timestamp: Date.now() },
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'conflict',
            data: conflictData,
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument(); // conflicts resolved counter
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<LiveContentUpdates {...defaultProps} />);

      expect(screen.getByRole('button', { name: /resync/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /subscriptions only/i })).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: /real-time only/i })).toBeInTheDocument();
    });

    test('supports keyboard navigation', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      const resyncButton = screen.getByRole('button', { name: /resync/i });
      resyncButton.focus();
      
      expect(resyncButton).toHaveFocus();
      
      fireEvent.keyDown(resyncButton, { key: 'Enter' });
      
      await waitFor(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        expect(mockWs.send).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error messages', async () => {
      render(<LiveContentUpdates {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'error',
            data: { message: 'Stream error occurred' },
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/stream error/i)).toBeInTheDocument();
      });
    });

    test('handles malformed messages gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      render(<LiveContentUpdates {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: 'invalid json',
        });
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to process content stream message:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Feature Flag Integration', () => {
    test('does not render when feature is disabled', () => {
      // Mock feature flag as disabled
      vi.mocked(require('../../../hooks/useFeatureFlags').useFeatureFlags).mockReturnValue({
        flags: {
          enableLiveContentUpdates: false,
        },
      });

      const { container } = render(<LiveContentUpdates {...defaultProps} />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('cleans up on unmount', () => {
      const { unmount } = render(<LiveContentUpdates {...defaultProps} />);
      
      const mockWs = (WebSocket as any).mock.results[0].value;
      
      unmount();
      
      expect(mockWs.close).toHaveBeenCalledWith(1000, 'User disconnect');
    });
  });
});
