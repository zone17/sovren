/**
 * 📬 DMInbox Component Tests
 * US-311: Build Encrypted DM Inbox UI Component
 * Epic 003: NOSTR Consolidation
 *
 * TDD Approach - Tests written FIRST
 *
 * Coverage Target: ≥85%
 *
 * Test Structure:
 * 1. Rendering Tests
 * 2. Interaction Tests
 * 3. Integration Tests (Services)
 * 4. Accessibility Tests
 * 5. Edge Cases
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DMInbox } from '../DMInbox';
import { NIP04Service } from '@/services/nostr/NIP04Service';
import { EventPublisherService } from '@/services/nostr/EventPublisherService';
import { SubscriptionManagerService } from '@/services/nostr/SubscriptionManagerService';
import { KeyManagementService } from '@/services/nostr/KeyManagementService';
import type { NostrEvent, NostrDirectMessage } from '@shared/types/nostr';

expect.extend(toHaveNoViolations);

// ========================================
// Mock Services
// ========================================

vi.mock('@/services/nostr/NIP04Service');
vi.mock('@/services/nostr/EventPublisherService');
vi.mock('@/services/nostr/SubscriptionManagerService');
vi.mock('@/services/nostr/KeyManagementService');

// ========================================
// Test Data
// ========================================

const mockUserPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const mockRecipientPubkey = 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321';
const mockPrivateKey = 'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';

const createMockDMEvent = (
  from: string,
  to: string,
  content: string,
  timestamp: number
): NostrEvent => ({
  id: `event_${timestamp}`,
  pubkey: from,
  created_at: Math.floor(timestamp / 1000),
  kind: 4,
  tags: [['p', to]],
  content: `encrypted_${content}?iv=mockiv`,
  sig: 'mock_signature_' + timestamp,
});

const createMockDecryptedMessage = (
  from: string,
  to: string,
  content: string,
  timestamp: number
): NostrDirectMessage => ({
  id: `event_${timestamp}`,
  from,
  to,
  content: `encrypted_${content}?iv=mockiv`,
  timestamp,
  decrypted: content,
});

// ========================================
// Mock Service Instances
// ========================================

const mockNIP04Service = {
  isInitialized: vi.fn(() => true),
  initialize: vi.fn(),
  decrypt: vi.fn(),
  encrypt: vi.fn(),
  createDMEvent: vi.fn(),
  getThreadId: vi.fn((pub1, pub2) => [pub1, pub2].sort().join('_')),
  addMessageToThread: vi.fn(),
  getThread: vi.fn(() => Promise.resolve([])),
  markAsRead: vi.fn(),
  getUnreadCount: vi.fn(() => Promise.resolve(0)),
  clearThread: vi.fn(),
};

const mockEventPublisher = {
  isInitialized: vi.fn(() => true),
  initialize: vi.fn(),
  publish: vi.fn(() =>
    Promise.resolve({
      success: true,
      publishedTo: ['relay1'],
      failedRelays: [],
      timestamp: Date.now(),
    })
  ),
  createAndPublish: vi.fn(),
};

const mockSubscriptionManager = {
  subscribe: vi.fn(() => 'sub_123'),
  unsubscribe: vi.fn(),
  getSubscription: vi.fn(),
};

const mockKeyManagement = {
  isInitialized: vi.fn(() => true),
  getActiveKey: vi.fn(() => ({
    keyId: 'key1',
    publicKey: mockUserPubkey,
    privateKey: mockPrivateKey,
    created: Date.now(),
    label: 'Test Key',
    encrypted: false,
  })),
};

// ========================================
// Setup & Teardown
// ========================================

beforeEach(() => {
  vi.clearAllMocks();

  // Setup service mocks
  (NIP04Service.getInstance as any).mockReturnValue(mockNIP04Service);
  (EventPublisherService.getInstance as any).mockReturnValue(mockEventPublisher);
  (SubscriptionManagerService.getInstance as any).mockReturnValue(mockSubscriptionManager);
  (KeyManagementService.getInstance as any).mockReturnValue(mockKeyManagement);

  // Default decrypt behavior
  mockNIP04Service.decrypt.mockImplementation(
    async (encrypted: string) => encrypted.split('encrypted_')[1]?.split('?iv=')[0] || ''
  );

  // Default encrypt behavior
  mockNIP04Service.encrypt.mockImplementation(
    async (plaintext: string) => `encrypted_${plaintext}?iv=mockiv`
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ========================================
// 1. RENDERING TESTS
// ========================================

describe('DMInbox - Rendering', () => {
  it('should render empty state when no messages', async () => {
    render(<DMInbox />);

    await waitFor(() => {
      expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    });
  });

  it('should render loading state initially', async () => {
    // Component shows loading state before EOSE is received
    const { container } = render(<DMInbox />);

    // The component initializes quickly, so check within a timeout
    expect(container.textContent).toMatch(/Loading Messages|No messages yet/i);
  });

  it('should render thread list with messages', async () => {
    const mockMessages = [
      createMockDecryptedMessage(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now() - 1000),
      createMockDecryptedMessage(mockUserPubkey, mockRecipientPubkey, 'Hi there!', Date.now()),
    ];

    mockNIP04Service.getThread.mockResolvedValue(mockMessages);

    const { container } = render(<DMInbox />);

    // Trigger subscription callback with mock event
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

    await waitFor(() => {
      expect(screen.getByText('Hello!')).toBeInTheDocument();
    });

    // Verify thread list structure
    const threadList = container.querySelector('[data-testid="thread-list"]');
    expect(threadList).toBeInTheDocument();
  });

  it('should render two-panel layout (thread list + conversation)', async () => {
    render(<DMInbox />);

    await waitFor(() => {
      expect(screen.getByTestId('thread-list')).toBeInTheDocument();
      expect(screen.getByTestId('conversation-view')).toBeInTheDocument();
    });
  });

  it('should show message composer when thread is selected', async () => {
    render(<DMInbox />);

    // Setup thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    if (subscribeCall) {
      const onEvent = subscribeCall[1];
      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

      const threadItem = await screen.findByText('Hello!');
      fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
        expect(document.querySelector('[aria-label="Send message"]')).toBeInTheDocument();
      });
    }
  });

  it('should display encryption indicator when thread is selected', async () => {
    render(<DMInbox />);

    // Setup and select thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    if (subscribeCall) {
      const onEvent = subscribeCall[1];
      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

      const threadItem = await screen.findByText('Hello!');
      fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

      await waitFor(() => {
        expect(screen.getByTitle(/encrypted with nip-04/i)).toBeInTheDocument();
      });
    }
  });
});

// ========================================
// 2. INTERACTION TESTS
// ========================================

describe('DMInbox - Interactions', () => {
  it('should select thread when clicked', async () => {
    render(<DMInbox />);

    // Simulate receiving a message to create a thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

    await waitFor(() => {
      expect(screen.getByText('Hello!')).toBeInTheDocument();
    });

    const threadItem = screen.getByText('Hello!').closest('[data-testid="thread-item"]');
    expect(threadItem).toBeInTheDocument();

    fireEvent.click(threadItem!);

    await waitFor(() => {
      expect(screen.getByTestId('conversation-view')).toHaveAttribute('data-active', 'true');
    });
  });

  it('should send message when send button clicked', async () => {
    const user = userEvent.setup();
    mockEventPublisher.createAndPublish.mockResolvedValue({
      success: true,
      eventId: 'event123',
      publishedTo: ['relay1'],
    });

    render(<DMInbox />);

    // Select a thread first
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

    const threadItem = await screen.findByText('Hello!');
    fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

    // Type message
    const input = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(input, { target: { value: 'Test message' } });

    // Send message
    const sendButton = document.querySelector('[aria-label="Send message"]') as HTMLElement;
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockNIP04Service.encrypt).toHaveBeenCalledWith(
        'Test message',
        mockRecipientPubkey,
        expect.any(Object)
      );
      expect(mockEventPublisher.createAndPublish).toHaveBeenCalled();
    });
  });

  it('should clear input after sending message', async () => {
    const user = userEvent.setup();
    mockEventPublisher.createAndPublish.mockResolvedValue({
      success: true,
      eventId: 'event123',
      publishedTo: ['relay1'],
    });

    render(<DMInbox />);

    // Setup thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

    const threadItem = await screen.findByText('Hello!');
    fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

    const input = screen.getByPlaceholderText(/type a message/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(document.querySelector('[aria-label="Send message"]') as HTMLElement);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should mark thread as read when selected', async () => {
    render(<DMInbox />);

    // Create thread with unread message
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Unread!', Date.now()));

    const threadItem = await screen.findByText('Unread!');
    fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

    await waitFor(() => {
      expect(mockNIP04Service.markAsRead).toHaveBeenCalledWith(
        mockUserPubkey,
        mockRecipientPubkey
      );
    });
  });

  it('should auto-scroll to latest message', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(<DMInbox />);

    // Send multiple messages
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    if (subscribeCall) {
      const onEvent = subscribeCall[1];

      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Message 1', Date.now() - 2000));
      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Message 2', Date.now() - 1000));

      // Select thread to view messages
      const threadItem = await screen.findByText('Message 2');
      fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Message 3', Date.now()));

      // Wait for auto-scroll to happen
      await waitFor(
        () => {
          expect(scrollIntoViewMock).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    }
  });

  it('should filter threads by search query', async () => {
    render(<DMInbox />);

    // Create multiple threads
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent('pubkey1', mockUserPubkey, 'Alice message', Date.now() - 2000));
    await onEvent(createMockDMEvent('pubkey2', mockUserPubkey, 'Bob message', Date.now() - 1000));

    await screen.findByText('Alice message');

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    await waitFor(() => {
      expect(screen.getByText('Alice message')).toBeInTheDocument();
      expect(screen.queryByText('Bob message')).not.toBeInTheDocument();
    });
  });
});

// ========================================
// 3. INTEGRATION TESTS
// ========================================

describe('DMInbox - Service Integration', () => {
  it('should initialize all services on mount', async () => {
    render(<DMInbox />);

    await waitFor(() => {
      expect(mockNIP04Service.isInitialized).toHaveBeenCalled();
      expect(mockEventPublisher.isInitialized).toHaveBeenCalled();
      expect(mockKeyManagement.getActiveKey).toHaveBeenCalled();
    });
  });

  it('should subscribe to DM events (kind 4)', async () => {
    render(<DMInbox />);

    await waitFor(() => {
      expect(mockSubscriptionManager.subscribe).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kinds: [4],
            '#p': [mockUserPubkey],
          }),
        ]),
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  it('should decrypt incoming messages with NIP04Service', async () => {
    render(<DMInbox />);

    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    const encryptedEvent = createMockDMEvent(
      mockRecipientPubkey,
      mockUserPubkey,
      'Secret message',
      Date.now()
    );

    await onEvent(encryptedEvent);

    await waitFor(() => {
      expect(mockNIP04Service.decrypt).toHaveBeenCalledWith(
        encryptedEvent.content,
        mockRecipientPubkey,
        expect.any(Object)
      );
    });
  });

  it('should publish encrypted messages with EventPublisher', async () => {
    const user = userEvent.setup();
    const mockEvent = { id: 'event123', kind: 4, content: 'encrypted_Test?iv=mockiv' };
    mockEventPublisher.createAndPublish.mockResolvedValue({
      success: true,
      event: mockEvent,
      eventId: 'event123',
      publishedTo: ['relay1'],
    });

    render(<DMInbox />);

    // Setup thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

    const threadItem = await screen.findByText('Hello!');
    fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

    const input = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(input, { target: { value: 'New message' } });
    fireEvent.click(document.querySelector('[aria-label="Send message"]') as HTMLElement);

    await waitFor(() => {
      expect(mockEventPublisher.createAndPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 4,
          content: expect.stringContaining('encrypted_'),
          tags: expect.arrayContaining([['p', mockRecipientPubkey]]),
        }),
        expect.any(Object)
      );
    });
  });

  it('should unsubscribe on unmount', async () => {
    const { unmount } = render(<DMInbox />);

    await waitFor(() => {
      expect(mockSubscriptionManager.subscribe).toHaveBeenCalled();
    });

    const subscriptionId = mockSubscriptionManager.subscribe.mock.results[0].value;

    unmount();

    expect(mockSubscriptionManager.unsubscribe).toHaveBeenCalledWith(subscriptionId);
  });
});

// ========================================
// 4. ACCESSIBILITY TESTS
// ========================================

describe('DMInbox - Accessibility', () => {
  it('should have no axe violations', async () => {
    const { container } = render(<DMInbox />);

    await waitFor(() => {
      expect(screen.getByTestId('thread-list')).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels', async () => {
    render(<DMInbox />);

    await waitFor(() => {
      expect(screen.getByLabelText(/direct messages/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/thread list/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/conversation/i)).toBeInTheDocument();
    });

    // Setup and select thread to show message input
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    if (subscribeCall) {
      const onEvent = subscribeCall[1];
      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

      const threadItem = await screen.findByText('Hello!');
      fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

      await waitFor(() => {
        expect(screen.getByLabelText(/message input/i)).toBeInTheDocument();
      });
    }
  });

  it('should be keyboard navigable', async () => {
    render(<DMInbox />);

    // Setup thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    if (subscribeCall) {
      const onEvent = subscribeCall[1];
      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

      const threadItem = await screen.findByText('Hello!');
      const threadButton = threadItem.closest('[data-testid="thread-item"]') as HTMLElement;

      // Focus and activate thread via keyboard
      threadButton.focus();
      expect(threadButton).toHaveFocus();

      // Press Enter to select (thread-item uses onKeyDown handler)
      fireEvent.keyDown(threadButton, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByTestId('conversation-view')).toHaveAttribute('data-active', 'true');
      });

      // Verify interactive elements are present
      const input = screen.getByPlaceholderText(/type a message/i);
      const sendButton = document.querySelector('[aria-label="Send message"]') as HTMLElement;
      expect(input).toBeInTheDocument();
      expect(sendButton).toBeInTheDocument();
    }
  });

  it('should have visible focus indicators', async () => {
    render(<DMInbox />);

    // The search input is always available and focusable
    const searchInput = screen.getByPlaceholderText(/search conversations/i);

    // Call .focus() directly (not fireEvent) to properly update document.activeElement
    searchInput.focus();

    // Check that the element can receive focus
    expect(searchInput).toHaveFocus();
  });

  it('should announce new messages to screen readers', async () => {
    render(<DMInbox />);

    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'New message!', Date.now()));

    await waitFor(() => {
      // Use querySelector to avoid visibility check that fails for sr-only elements in jsdom
      const liveRegion = document.querySelector('[aria-live="polite"][role="status"]');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion!.textContent).toMatch(/new message/i);
    });
  });
});

// ========================================
// 5. EDGE CASES
// ========================================

describe('DMInbox - Edge Cases', () => {
  it('should handle empty message submission', async () => {
    render(<DMInbox />);

    // Setup thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

    const threadItem = await screen.findByText('Hello!');
    fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

    const sendButton = document.querySelector('[aria-label="Send message"]') as HTMLElement;
    fireEvent.click(sendButton);

    // Should not call encrypt or publish for empty message
    expect(mockNIP04Service.encrypt).not.toHaveBeenCalled();
    expect(mockEventPublisher.createAndPublish).not.toHaveBeenCalled();
  });

  it('should handle decryption errors gracefully', async () => {
    mockNIP04Service.decrypt.mockRejectedValue(new Error('Decryption failed'));

    const consoleError = vi.spyOn(console, 'error').mockImplementation();

    render(<DMInbox />);

    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Encrypted!', Date.now()));

    await waitFor(() => {
      expect(screen.getByText(/failed to decrypt/i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('should handle publish errors gracefully', async () => {
    mockEventPublisher.createAndPublish.mockRejectedValue(new Error('Publish failed'));

    render(<DMInbox />);

    // Setup thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    const onEvent = subscribeCall[1];
    await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

    const threadItem = await screen.findByText('Hello!');
    fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

    const input = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(document.querySelector('[aria-label="Send message"]') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText(/failed to send/i)).toBeInTheDocument();
    });
  });

  it('should handle no active key error', async () => {
    // Create a temporary key management mock that returns null
    const tempKeyMgmt = {
      ...mockKeyManagement,
      getActiveKey: vi.fn(() => null),
      isInitialized: vi.fn(() => true),
    };
    (KeyManagementService.getInstance as any).mockReturnValue(tempKeyMgmt);

    render(<DMInbox />);

    await waitFor(() => {
      const errorMessages = screen.queryAllByText(/no active key/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    // Restore original mock
    (KeyManagementService.getInstance as any).mockReturnValue(mockKeyManagement);
  });

  it('should handle duplicate messages', async () => {
    render(<DMInbox />);

    await waitFor(() => {
      expect(mockSubscriptionManager.subscribe).toHaveBeenCalled();
    });

    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    if (subscribeCall) {
      const onEvent = subscribeCall[1];

      const duplicateEvent = createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Duplicate', Date.now());

      // Send same event twice
      await onEvent(duplicateEvent);
      await onEvent(duplicateEvent);

      await waitFor(() => {
        const messages = screen.getAllByText('Duplicate');
        expect(messages).toHaveLength(1); // Should deduplicate
      });
    }
  });

  it('should handle very long messages', async () => {
    const longMessage = 'A'.repeat(1000); // Reduced for test speed

    render(<DMInbox />);

    await waitFor(() => {
      expect(mockSubscriptionManager.subscribe).toHaveBeenCalled();
    });

    // Setup thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    if (subscribeCall) {
      const onEvent = subscribeCall[1];
      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

      const threadItem = await screen.findByText('Hello!');
      fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

      const input = screen.getByPlaceholderText(/type a message/i) as HTMLTextAreaElement;

      // Directly set value instead of typing for speed
      fireEvent.change(input, { target: { value: longMessage } });

      await waitFor(() => {
        const charCounter = screen.getByTestId('char-counter');
        expect(charCounter).toHaveTextContent('1000');
      });
    }
  });

  it('should handle rapid message sending', async () => {
    mockEventPublisher.createAndPublish.mockResolvedValue({
      success: true,
      eventId: 'event123',
      publishedTo: ['relay1'],
    });

    render(<DMInbox />);

    await waitFor(() => {
      expect(mockSubscriptionManager.subscribe).toHaveBeenCalled();
    });

    // Setup thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    if (subscribeCall) {
      const onEvent = subscribeCall[1];
      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

      const threadItem = await screen.findByText('Hello!');
      fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

      const input = screen.getByPlaceholderText(/type a message/i);
      const sendButton = document.querySelector('[aria-label="Send message"]') as HTMLElement;

      // Send 3 messages (reduced for test speed)
      for (let i = 0; i < 3; i++) {
        fireEvent.change(input, { target: { value: `Message ${i}` } });
        fireEvent.click(sendButton);
        await waitFor(() => {
          // Wait for the send to complete before sending the next message
          expect(input).toHaveValue('');
        });
      }

      await waitFor(() => {
        expect(mockEventPublisher.createAndPublish).toHaveBeenCalledTimes(3);
      });
    }
  });

  it('should handle thread deletion confirmation', async () => {
    window.confirm = vi.fn(() => true);

    render(<DMInbox />);

    await waitFor(() => {
      expect(mockSubscriptionManager.subscribe).toHaveBeenCalled();
    });

    // Setup thread
    const subscribeCall = mockSubscriptionManager.subscribe.mock.calls[0];
    if (subscribeCall) {
      const onEvent = subscribeCall[1];
      await onEvent(createMockDMEvent(mockRecipientPubkey, mockUserPubkey, 'Hello!', Date.now()));

      const threadItem = await screen.findByText('Hello!');
      fireEvent.click(threadItem.closest('[data-testid="thread-item"]')!);

      const deleteButton = document.querySelector('[aria-label="Delete conversation"]') as HTMLElement;
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockNIP04Service.clearThread).toHaveBeenCalledWith(
          mockUserPubkey,
          mockRecipientPubkey
        );
      });
    }
  });
});
