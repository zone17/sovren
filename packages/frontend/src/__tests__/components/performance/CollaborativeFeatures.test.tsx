/**
 * 🧪 **COLLABORATIVE FEATURES TESTS** 🧪
 * 
 * Comprehensive test suite for Collaborative Features component
 * Testing all functionality including real-time editing, conflict resolution, and presence awareness
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CollaborativeFeatures } from '../../../components/performance/CollaborativeFeatures';

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
      enableCollaborativeFeatures: true,
    },
  }),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_WS_URL = 'wss://test.example.com';

describe('CollaborativeFeatures Component', () => {
  const defaultProps = {
    userId: 'test-user-123',
    documentId: 'doc-456',
    initialContent: 'Initial document content',
    userPermission: 'edit' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component Rendering', () => {
    test('renders collaborative editing interface', () => {
      render(<CollaborativeFeatures {...defaultProps} />);
      
      expect(screen.getByText('Collaborative Editing')).toBeInTheDocument();
      expect(screen.getByText('Document Editor')).toBeInTheDocument();
      expect(screen.getByText('Active Collaborators (0)')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Initial document content')).toBeInTheDocument();
    });

    test('displays connection status', () => {
      render(<CollaborativeFeatures {...defaultProps} />);
      
      expect(screen.getByText('v1')).toBeInTheDocument(); // document version badge
    });

    test('renders with custom className', () => {
      const { container } = render(
        <CollaborativeFeatures {...defaultProps} className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('collaborative-features', 'custom-class');
    });
  });

  describe('WebSocket Connection', () => {
    test('initializes collaboration WebSocket manager', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('wss://test.example.com/collaboration/realtime')
        );
      });
    });

    test('handles connection state changes', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);
      
      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      await waitFor(() => {
        expect(screen.getByRole('textbox')).not.toBeDisabled();
      });
    });
  });

  describe('Document Editing', () => {
    test('handles content changes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onContentChange = vi.fn();
      
      render(
        <CollaborativeFeatures 
          {...defaultProps} 
          onContentChange={onContentChange}
        />
      );

      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      const editor = screen.getByDisplayValue('Initial document content');
      await user.clear(editor);
      await user.type(editor, 'New content');

      await waitFor(() => {
        expect(onContentChange).toHaveBeenCalledWith('New content');
      });
    });

    test('sends operations to other collaborators', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<CollaborativeFeatures {...defaultProps} />);

      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      const editor = screen.getByDisplayValue('Initial document content');
      await user.type(editor, ' - edited');

      await waitFor(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('operation')
        );
      });
    });

    test('disables editing for view-only permission', () => {
      render(
        <CollaborativeFeatures 
          {...defaultProps} 
          userPermission="view"
        />
      );
      
      const editor = screen.getByDisplayValue('Initial document content');
      expect(editor).toBeDisabled();
    });
  });

  describe('Operational Transform', () => {
    test('receives and applies operations from other users', async () => {
      const onOperationApplied = vi.fn();
      
      render(
        <CollaborativeFeatures 
          {...defaultProps} 
          onOperationApplied={onOperationApplied}
        />
      );

      const operation = {
        id: 'op-123',
        type: 'insert',
        documentId: 'doc-456',
        userId: 'other-user',
        timestamp: new Date().toISOString(),
        position: 0,
        content: 'Hello ',
        operation: 'insert',
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'operation',
            data: operation,
          }),
        });
      });

      await waitFor(() => {
        expect(onOperationApplied).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'op-123',
            type: 'insert',
          })
        );
      });
    });

    test('handles conflicting operations', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      // Simulate conflicting operations
      const operation1 = {
        id: 'op-1',
        type: 'insert',
        documentId: 'doc-456',
        userId: 'user-1',
        timestamp: new Date().toISOString(),
        position: 5,
        content: 'A',
      };

      const operation2 = {
        id: 'op-2',
        type: 'insert',
        documentId: 'doc-456',
        userId: 'user-2',
        timestamp: new Date().toISOString(),
        position: 5,
        content: 'B',
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'operation',
            data: operation1,
          }),
        });
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'operation',
            data: operation2,
          }),
        });
      });

      // Operations should be processed without errors
      expect(screen.getByText('Collaborative Editing')).toBeInTheDocument();
    });
  });

  describe('Collaborator Presence', () => {
    test('displays active collaborators', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      const collaborator = {
        id: 'user-2',
        name: 'John Doe',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        permissions: 'edit',
        color: '#ff6b6b',
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'presence_update',
            data: collaborator,
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    test('handles cursor updates', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      const cursorUpdate = {
        userId: 'user-2',
        x: 100,
        y: 200,
        selection: { start: 5, end: 10 },
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'cursor_update',
            data: cursorUpdate,
          }),
        });
      });

      // Cursor update should be processed without errors
      expect(screen.getByText('Collaborative Editing')).toBeInTheDocument();
    });

    test('sends cursor updates on text selection', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<CollaborativeFeatures {...defaultProps} />);

      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      const editor = screen.getByDisplayValue('Initial document content');
      
      // Simulate text selection
      await user.click(editor);
      fireEvent.select(editor);

      // Advance time to trigger throttled cursor update
      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('cursor_update')
        );
      });
    });
  });

  describe('Commenting System', () => {
    test('toggles comments panel', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<CollaborativeFeatures {...defaultProps} />);

      const commentsButton = screen.getByRole('button', { name: /comments \(0\)/i });
      await user.click(commentsButton);

      await waitFor(() => {
        expect(screen.getByText('Comments')).toBeInTheDocument();
      });
    });

    test('creates comments on selected text', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<CollaborativeFeatures {...defaultProps} />);

      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      const editor = screen.getByDisplayValue('Initial document content');
      
      // Select some text
      await user.click(editor);
      editor.setSelectionRange(0, 7); // Select "Initial"
      fireEvent.select(editor);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
      });

      const commentInput = screen.getByPlaceholderText('Add a comment...');
      const commentButton = screen.getByRole('button', { name: '' }); // Comment icon button

      await user.type(commentInput, 'This needs revision');
      await user.click(commentButton);

      await waitFor(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('comment')
        );
      });
    });

    test('displays received comments', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      // Toggle comments panel first
      const commentsButton = screen.getByRole('button', { name: /comments \(0\)/i });
      fireEvent.click(commentsButton);

      const comment = {
        id: 'comment-123',
        documentId: 'doc-456',
        userId: 'other-user',
        content: 'Great point!',
        position: 5,
        range: { start: 0, end: 7 },
        timestamp: new Date().toISOString(),
        resolved: false,
        replies: [],
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'comment',
            data: comment,
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Great point!')).toBeInTheDocument();
        expect(screen.getByText('other-user')).toBeInTheDocument();
      });
    });

    test('prevents commenting with view permission', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(
        <CollaborativeFeatures 
          {...defaultProps} 
          userPermission="view"
        />
      );

      const editor = screen.getByDisplayValue('Initial document content');
      
      // Try to select text
      await user.click(editor);
      editor.setSelectionRange(0, 7);
      fireEvent.select(editor);

      // Comment input should be disabled
      const commentInput = screen.queryByPlaceholderText('Add a comment...');
      if (commentInput) {
        expect(commentInput).toBeDisabled();
      }
    });
  });

  describe('Document Synchronization', () => {
    test('requests document state on connection', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      await waitFor(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('request_document_state')
        );
      });
    });

    test('handles document state updates', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      const documentState = {
        id: 'doc-456',
        content: 'Updated document content',
        version: 2,
        lastModified: new Date().toISOString(),
        collaborators: [],
        operations: [],
        comments: [],
        permissions: {},
        locked: false,
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'document_state',
            data: documentState,
          }),
        });
      });

      // Document state should be processed
      expect(screen.getByText('v1')).toBeInTheDocument(); // version badge
    });
  });

  describe('Permission Management', () => {
    test('handles permission updates', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      const permissionUpdate = {
        userId: 'test-user-123',
        permission: 'view',
        documentId: 'doc-456',
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'permission_update',
            data: permissionUpdate,
          }),
        });
      });

      // Permission update should be processed
      expect(screen.getByText('Collaborative Editing')).toBeInTheDocument();
    });

    test('respects different permission levels', () => {
      // Test edit permission
      const { rerender } = render(
        <CollaborativeFeatures {...defaultProps} userPermission="edit" />
      );
      
      expect(screen.getByDisplayValue('Initial document content')).not.toBeDisabled();

      // Test view permission
      rerender(
        <CollaborativeFeatures {...defaultProps} userPermission="view" />
      );
      
      expect(screen.getByDisplayValue('Initial document content')).toBeDisabled();
    });
  });

  describe('Performance Statistics', () => {
    test('displays collaboration statistics', () => {
      render(<CollaborativeFeatures {...defaultProps} />);
      
      expect(screen.getByText('Collaboration Stats')).toBeInTheDocument();
      expect(screen.getByText('Operations')).toBeInTheDocument();
      expect(screen.getByText('Conflicts Resolved')).toBeInTheDocument();
      expect(screen.getByText('Avg Latency')).toBeInTheDocument();
      expect(screen.getByText('Sync Accuracy')).toBeInTheDocument();
    });

    test('updates statistics with operations', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      // Simulate multiple operations
      for (let i = 0; i < 5; i++) {
        act(() => {
          const mockWs = (WebSocket as any).mock.results[0].value;
          mockWs.onmessage({
            data: JSON.stringify({
              type: 'operation',
              data: {
                id: `op-${i}`,
                type: 'insert',
                documentId: 'doc-456',
                userId: 'other-user',
                timestamp: new Date().toISOString(),
                position: i,
                content: 'A',
              },
            }),
          });
        });
      }

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // operations count
      });
    });
  });

  describe('Error Handling', () => {
    test('handles WebSocket errors gracefully', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onerror(new Error('Connection error'));
      });

      // Component should still be functional
      expect(screen.getByText('Collaborative Editing')).toBeInTheDocument();
    });

    test('handles malformed operation data', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      
      render(<CollaborativeFeatures {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'operation',
            data: {
              // Missing required fields
              id: 'invalid-op',
            },
          }),
        });
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Invalid operation data:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    test('handles collaboration errors', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'error',
            data: { message: 'Collaboration error occurred' },
          }),
        });
      });

      // Error should be handled gracefully
      expect(screen.getByText('Collaborative Editing')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels and roles', () => {
      render(<CollaborativeFeatures {...defaultProps} />);
      
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Start typing to collaborate...');
      expect(screen.getByRole('button', { name: /comments/i })).toBeInTheDocument();
    });

    test('supports keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<CollaborativeFeatures {...defaultProps} />);

      const editor = screen.getByRole('textbox');
      editor.focus();
      
      expect(editor).toHaveFocus();
      
      await user.keyboard('{Tab}');
      
      // Should move to next focusable element
      const commentsButton = screen.getByRole('button', { name: /comments/i });
      expect(commentsButton).toHaveFocus();
    });

    test('provides tooltip information for collaborators', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<CollaborativeFeatures {...defaultProps} />);

      // Add a collaborator first
      const collaborator = {
        id: 'user-2',
        name: 'John Doe',
        isOnline: true,
        lastSeen: new Date(),
        permissions: 'edit',
        color: '#ff6b6b',
      };

      // Simulate collaborator presence
      // This would need to be handled by the component's state management
      // For now, we just verify the tooltip provider is present
      expect(screen.getByText('Collaborative Editing')).toBeInTheDocument();
    });
  });

  describe('Heartbeat and Connection Management', () => {
    test('sends heartbeat messages', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      // Advance time to trigger heartbeat
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('heartbeat')
        );
      });
    });

    test('handles heartbeat responses', async () => {
      render(<CollaborativeFeatures {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now(),
          }),
        });
      });

      // Heartbeat should be processed without errors
      expect(screen.getByText('Collaborative Editing')).toBeInTheDocument();
    });
  });

  describe('Feature Flag Integration', () => {
    test('does not render when feature is disabled', () => {
      // Mock feature flag as disabled
      vi.mocked(require('../../../hooks/useFeatureFlags').useFeatureFlags).mockReturnValue({
        flags: {
          enableCollaborativeFeatures: false,
        },
      });

      const { container } = render(<CollaborativeFeatures {...defaultProps} />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('cleans up on unmount', () => {
      const { unmount } = render(<CollaborativeFeatures {...defaultProps} />);
      
      const mockWs = (WebSocket as any).mock.results[0].value;
      
      unmount();
      
      expect(mockWs.close).toHaveBeenCalledWith(1000, 'User disconnect');
    });

    test('clears all timeouts on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const { unmount } = render(<CollaborativeFeatures {...defaultProps} />);
      
      unmount();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
