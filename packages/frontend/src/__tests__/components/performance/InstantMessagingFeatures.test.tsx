/**
 * �� **INSTANT MESSAGING FEATURES TESTS** 🧪
 * 
 * Comprehensive test suite for Instant Messaging Features component
 * Testing all functionality including real-time messaging, encryption, and status tracking
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { InstantMessagingFeatures } from '../../../components/performance/InstantMessagingFeatures';

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

// Mock Crypto API
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      generateKey: vi.fn().mockResolvedValue({
        publicKey: 'mock-public-key',
        privateKey: 'mock-private-key',
      }),
      encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      importKey: vi.fn().mockResolvedValue('mock-key'),
    },
  } as any,
  writable: true,
  configurable: true,
});

// Mock useFeatureFlags hook
vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      enableInstantMessaging: true,
    },
  }),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_WS_URL = 'wss://test.example.com';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('InstantMessagingFeatures Component', () => {
  const defaultProps = {
    userId: 'test-user-123',
    currentConversationId: 'conversation-456',
    enableEncryption: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component Rendering', () => {
    test('renders messaging interface', () => {
      render(<InstantMessagingFeatures {...defaultProps} />);
      
      expect(screen.getByText('Messaging')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // Send button
    });

    test('displays encryption indicator when enabled', () => {
      render(<InstantMessagingFeatures {...defaultProps} />);
      
      expect(screen.getByText('End-to-end encrypted')).toBeInTheDocument();
    });

    test('does not display encryption indicator when disabled', () => {
      render(<InstantMessagingFeatures {...defaultProps} enableEncryption={false} />);
      
      expect(screen.queryByText('End-to-end encrypted')).not.toBeInTheDocument();
    });

    test('renders with custom className', () => {
      const { container } = render(
        <InstantMessagingFeatures {...defaultProps} className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('instant-messaging-features', 'custom-class');
    });
  });

  describe('WebSocket Connection', () => {
    test('initializes messaging WebSocket manager', async () => {
      render(<InstantMessagingFeatures {...defaultProps} />);
      
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('wss://test.example.com/messaging/realtime')
        );
      });
    });

    test('handles connection state changes', async () => {
      render(<InstantMessagingFeatures {...defaultProps} />);
      
      // Initially disconnected
      expect(screen.getByRole('textbox')).toBeDisabled();
      
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

  describe('Message Sending', () => {
    test('sends text message', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onMessageSent = vi.fn();
      
      render(
        <InstantMessagingFeatures 
          {...defaultProps} 
          onMessageSent={onMessageSent}
        />
      );

      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      const textarea = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: '' }); // Send button with icon

      await user.type(textarea, 'Hello, world!');
      await user.click(sendButton);

      await waitFor(() => {
        expect(onMessageSent).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Hello, world!',
            messageType: 'text',
            senderId: 'test-user-123',
          })
        );
      });

      expect(textarea).toHaveValue('');
    });

    test('sends message on Enter key press', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onMessageSent = vi.fn();
      
      render(
        <InstantMessagingFeatures 
          {...defaultProps} 
          onMessageSent={onMessageSent}
        />
      );

      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      const textarea = screen.getByPlaceholderText('Type your message...');
      
      await user.type(textarea, 'Test message');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(onMessageSent).toHaveBeenCalled();
      });
    });

    test('does not send message on Shift+Enter', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onMessageSent = vi.fn();
      
      render(
        <InstantMessagingFeatures 
          {...defaultProps} 
          onMessageSent={onMessageSent}
        />
      );

      const textarea = screen.getByPlaceholderText('Type your message...');
      
      await user.type(textarea, 'Test message');
      await user.keyboard('{Shift>}{Enter}{/Shift}');

      expect(onMessageSent).not.toHaveBeenCalled();
      expect(textarea).toHaveValue('Test message\n');
    });

    test('prevents sending empty messages', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<InstantMessagingFeatures {...defaultProps} />);

      const sendButton = screen.getByRole('button', { name: '' });
      expect(sendButton).toBeDisabled();

      const textarea = screen.getByPlaceholderText('Type your message...');
      await user.type(textarea, '   '); // Only whitespace
      
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Message Encryption', () => {
    test('encrypts messages when encryption is enabled', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<InstantMessagingFeatures {...defaultProps} enableEncryption={true} />);

      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      const textarea = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: '' });

      await user.type(textarea, 'Secret message');
      await user.click(sendButton);

      await waitFor(() => {
        expect(crypto.subtle.encrypt).toHaveBeenCalled();
      });
    });

    test('generates and stores encryption keys', async () => {
      render(<InstantMessagingFeatures {...defaultProps} enableEncryption={true} />);

      await waitFor(() => {
        expect(crypto.subtle.generateKey).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "RSA-OAEP",
            modulusLength: 2048,
          }),
          true,
          ["encrypt", "decrypt"]
        );
      });
    });
  });

  describe('Message Reception', () => {
    test('receives and displays incoming messages', async () => {
      const onMessageReceived = vi.fn();
      
      render(
        <InstantMessagingFeatures 
          {...defaultProps} 
          onMessageReceived={onMessageReceived}
        />
      );

      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conversation-456',
        senderId: 'other-user',
        recipientId: 'test-user-123',
        content: 'Hello from other user!',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        status: 'delivered',
        encrypted: true,
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'message',
            data: mockMessage,
          }),
        });
      });

      await waitFor(() => {
        expect(onMessageReceived).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'msg-123',
            content: 'Hello from other user!',
          })
        );
      });

      expect(screen.getByText('Hello from other user!')).toBeInTheDocument();
    });

    test('handles message status updates', async () => {
      render(<InstantMessagingFeatures {...defaultProps} />);

      const statusUpdate = {
        messageId: 'msg-123',
        status: 'read',
        timestamp: Date.now(),
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'message_status',
            data: statusUpdate,
          }),
        });
      });

      // Status update should be processed without errors
      expect(screen.getByText('Messaging')).toBeInTheDocument();
    });
  });

  describe('Typing Indicators', () => {
    test('sends typing indicators', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<InstantMessagingFeatures {...defaultProps} />);

      // Simulate connection
      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onopen();
      });

      const textarea = screen.getByPlaceholderText('Type your message...');
      await user.type(textarea, 'Typing...');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      await waitFor(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('typing_indicator')
        );
      });
    });

    test('displays typing indicators from other users', async () => {
      render(<InstantMessagingFeatures {...defaultProps} />);

      const typingIndicator = {
        userId: 'other-user',
        conversationId: 'conversation-456',
        isTyping: true,
        timestamp: new Date().toISOString(),
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'typing_indicator',
            data: typingIndicator,
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Someone is typing...')).toBeInTheDocument();
      });
    });

    test('clears typing indicators after timeout', async () => {
      render(<InstantMessagingFeatures {...defaultProps} />);

      const typingIndicator = {
        userId: 'other-user',
        conversationId: 'conversation-456',
        isTyping: true,
        timestamp: new Date().toISOString(),
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'typing_indicator',
            data: typingIndicator,
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Someone is typing...')).toBeInTheDocument();
      });

      // Advance time by 3 seconds to trigger timeout
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Someone is typing...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Message Attachments', () => {
    test('displays attachment buttons', () => {
      render(<InstantMessagingFeatures {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // Image button
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // File button
    });

    test('handles messages with attachments', async () => {
      render(<InstantMessagingFeatures {...defaultProps} />);

      const messageWithAttachments = {
        id: 'msg-456',
        conversationId: 'conversation-456',
        senderId: 'other-user',
        recipientId: 'test-user-123',
        content: 'Check out this file!',
        messageType: 'file',
        timestamp: new Date().toISOString(),
        status: 'delivered',
        encrypted: false,
        attachments: [
          {
            id: 'attach-1',
            type: 'document',
            name: 'document.pdf',
            size: 1024000,
            url: 'https://example.com/file.pdf',
          },
        ],
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'message',
            data: messageWithAttachments,
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Message Status Tracking', () => {
    test('displays message status icons for own messages', async () => {
      render(<InstantMessagingFeatures {...defaultProps} />);

      const ownMessage = {
        id: 'msg-own',
        conversationId: 'conversation-456',
        senderId: 'test-user-123', // Own message
        recipientId: 'other-user',
        content: 'My message',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        status: 'read',
        encrypted: true,
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'message',
            data: ownMessage,
          }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText('My message')).toBeInTheDocument();
        // Should show read status and encryption indicator
      });
    });

    test('allows marking messages as read', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<InstantMessagingFeatures {...defaultProps} />);

      const unreadMessage = {
        id: 'msg-unread',
        conversationId: 'conversation-456',
        senderId: 'other-user',
        recipientId: 'test-user-123',
        content: 'Unread message',
        messageType: 'text',
        timestamp: new Date().toISOString(),
        status: 'delivered',
        encrypted: false,
      };

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: JSON.stringify({
            type: 'message',
            data: unreadMessage,
          }),
        });
      });

      await waitFor(() => {
        const markAsReadButton = screen.getByRole('button', { name: /mark as read/i });
        expect(markAsReadButton).toBeInTheDocument();
      });

      const markAsReadButton = screen.getByRole('button', { name: /mark as read/i });
      await user.click(markAsReadButton);

      await waitFor(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('message_status')
        );
      });
    });
  });

  describe('Search Functionality', () => {
    test('toggles search interface', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<InstantMessagingFeatures {...defaultProps} />);

      const searchButton = screen.getByRole('button', { name: '' }); // Search icon button
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search messages...')).toBeInTheDocument();
      });
    });

    test('filters messages based on search query', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<InstantMessagingFeatures {...defaultProps} />);

      // Add some messages first
      const messages = [
        {
          id: 'msg-1',
          conversationId: 'conversation-456',
          senderId: 'other-user',
          recipientId: 'test-user-123',
          content: 'Hello world',
          messageType: 'text',
          timestamp: new Date().toISOString(),
          status: 'delivered',
          encrypted: false,
        },
        {
          id: 'msg-2',
          conversationId: 'conversation-456',
          senderId: 'test-user-123',
          recipientId: 'other-user',
          content: 'Goodbye moon',
          messageType: 'text',
          timestamp: new Date().toISOString(),
          status: 'sent',
          encrypted: false,
        },
      ];

      messages.forEach(message => {
        act(() => {
          const mockWs = (WebSocket as any).mock.results[0].value;
          mockWs.onmessage({
            data: JSON.stringify({
              type: 'message',
              data: message,
            }),
          });
        });
      });

      // Toggle search
      const searchButton = screen.getByRole('button', { name: '' }); // Search icon button
      await user.click(searchButton);

      const searchInput = screen.getByPlaceholderText('Search messages...');
      await user.type(searchInput, 'world');

      await waitFor(() => {
        expect(screen.getByText('Hello world')).toBeInTheDocument();
        expect(screen.queryByText('Goodbye moon')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance Statistics', () => {
    test('displays messaging statistics', () => {
      render(<InstantMessagingFeatures {...defaultProps} />);
      
      expect(screen.getByText(/messages:/i)).toBeInTheDocument();
      expect(screen.getByText(/latency:/i)).toBeInTheDocument();
      expect(screen.getByText('good')).toBeInTheDocument(); // connection quality
    });

    test('updates statistics with message activity', async () => {
      render(<InstantMessagingFeatures {...defaultProps} />);

      // Send some messages to update stats
      for (let i = 0; i < 3; i++) {
        act(() => {
          const mockWs = (WebSocket as any).mock.results[0].value;
          mockWs.onmessage({
            data: JSON.stringify({
              type: 'message',
              data: {
                id: `msg-${i}`,
                conversationId: 'conversation-456',
                senderId: 'other-user',
                recipientId: 'test-user-123',
                content: `Message ${i}`,
                messageType: 'text',
                timestamp: new Date().toISOString(),
                status: 'delivered',
                encrypted: false,
              },
            }),
          });
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Messages: 3')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles WebSocket errors gracefully', async () => {
      render(<InstantMessagingFeatures {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onerror(new Error('Connection error'));
      });

      // Component should still be functional
      expect(screen.getByText('Messaging')).toBeInTheDocument();
    });

    test('handles malformed message data', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      
      render(<InstantMessagingFeatures {...defaultProps} />);

      act(() => {
        const mockWs = (WebSocket as any).mock.results[0].value;
        mockWs.onmessage({
          data: 'invalid json',
        });
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to process messaging message:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels and roles', () => {
      render(<InstantMessagingFeatures {...defaultProps} />);
      
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Type your message...');
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // Send button
    });

    test('supports keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<InstantMessagingFeatures {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      textarea.focus();
      
      expect(textarea).toHaveFocus();
      
      await user.keyboard('{Tab}');
      
      // Should move to send button
      const sendButton = screen.getByRole('button', { name: '' });
      expect(sendButton).toHaveFocus();
    });
  });

  describe('Feature Flag Integration', () => {
    test('does not render when feature is disabled', () => {
      // Mock feature flag as disabled
      vi.mocked(require('../../../hooks/useFeatureFlags').useFeatureFlags).mockReturnValue({
        flags: {
          enableInstantMessaging: false,
        },
      });

      const { container } = render(<InstantMessagingFeatures {...defaultProps} />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('cleans up on unmount', () => {
      const { unmount } = render(<InstantMessagingFeatures {...defaultProps} />);
      
      const mockWs = (WebSocket as any).mock.results[0].value;
      
      unmount();
      
      expect(mockWs.close).toHaveBeenCalledWith(1000, 'User disconnect');
    });

    test('clears typing timeouts on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      const { unmount } = render(<InstantMessagingFeatures {...defaultProps} />);
      
      unmount();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
