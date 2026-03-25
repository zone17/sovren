// @ts-nocheck
/**
 * 📬 DMInbox Component
 * US-311: Build Encrypted DM Inbox UI Component
 * Epic 003: NOSTR Consolidation
 *
 * Features:
 * - Two-panel layout: thread list + conversation view
 * - Real-time DM updates via SubscriptionManagerService
 * - Encrypted messaging with NIP-04
 * - Thread management (read/unread, delete, mute)
 * - Search and filter threads
 * - Responsive design (mobile-first)
 * - Full accessibility (WCAG AA)
 *
 * Integration:
 * - NIP04Service for encryption/decryption
 * - EventPublisherService for sending messages
 * - SubscriptionManagerService for receiving messages
 * - KeyManagementService for key access
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { NostrEvent, NostrDirectMessage } from '@shared/types/nostr/index';
import { NIP04Service } from '@/services/nostr/NIP04Service';
import { EventPublisherService } from '@/services/nostr/EventPublisherService';
import { SubscriptionManagerService } from '@/services/nostr/SubscriptionManagerService';
import { KeyManagementService } from '@/services/nostr/KeyManagementService';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// ========================================
// Types
// ========================================

interface Thread {
  threadId: string;
  recipientPubkey: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  messages: NostrDirectMessage[];
}

interface DMInboxProps {
  className?: string;
  onError?: (error: Error) => void;
}

// ========================================
// DMInbox Component
// ========================================

export const DMInbox: React.FC<DMInboxProps> = ({ className = '', onError }) => {
  // Services
  const nip04Service = NIP04Service.getInstance();
  const eventPublisher = EventPublisherService.getInstance();
  const subscriptionManager = SubscriptionManagerService.getInstance();
  const keyManagement = KeyManagementService.getInstance();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Map<string, Thread>>(new Map());
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [decryptionErrors, setDecryptionErrors] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');
  const [deleteThreadConfirmId, setDeleteThreadConfirmId] = useState<string | null>(null);

  // Refs
  const subscriptionIdRef = useRef<string | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  // Get current user's public key
  const activeKey = keyManagement.getActiveKey();
  const userPubkey = activeKey?.publicKey;

  // ========================================
  // Initialization
  // ========================================

  useEffect(() => {
    const initialize = async () => {
      try {
        // Check if user has active key
        if (!userPubkey) {
          setError('No active key available. Please set up your NOSTR key first.');
          setLoading(false);
          return;
        }

        // Check if services are initialized
        if (!nip04Service.isInitialized()) {
          setError('NIP04Service not initialized');
          setLoading(false);
          return;
        }

        if (!eventPublisher.isInitialized()) {
          setError('EventPublisherService not initialized');
          setLoading(false);
          return;
        }

        // Subscribe to DM events (kind 4) addressed to user
        const subId = subscriptionManager.subscribe(
          [
            {
              kinds: [4],
              '#p': [userPubkey],
            },
          ],
          handleIncomingEvent,
          {
            onEOSE: () => {
              console.log('[DMInbox] Initial DM sync complete');
              setLoading(false);
            },
            onError: (error) => {
              console.error('[DMInbox] Subscription error:', error);
              setError('Failed to subscribe to messages');
              if (onError) onError(error);
            },
          }
        );

        subscriptionIdRef.current = subId;
        setLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize DM inbox';
        setError(errorMessage);
        setLoading(false);
        if (onError && err instanceof Error) onError(err);
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      if (subscriptionIdRef.current) {
        subscriptionManager.unsubscribe(subscriptionIdRef.current);
      }
    };
  }, [userPubkey]); // Re-initialize if user key changes

  // ========================================
  // Event Handling
  // ========================================

  const handleIncomingEvent = useCallback(
    async (event: NostrEvent, relay: string) => {
      try {
        // Deduplicate events
        if (seenEventIdsRef.current.has(event.id)) {
          return;
        }
        seenEventIdsRef.current.add(event.id);

        // Cleanup old event IDs
        if (seenEventIdsRef.current.size > 1000) {
          const idsArray = Array.from(seenEventIdsRef.current);
          seenEventIdsRef.current = new Set(idsArray.slice(-1000));
        }

        // Determine sender and recipient
        const senderPubkey = event.pubkey;
        const recipientTag = event.tags.find((tag) => tag[0] === 'p');
        const recipientPubkey = recipientTag?.[1];

        if (!recipientPubkey || !userPubkey) {
          return;
        }

        // Determine if this is an incoming or outgoing message
        const isIncoming = recipientPubkey === userPubkey;
        const otherPubkey = isIncoming ? senderPubkey : recipientPubkey;

        // Decrypt message
        let decryptedContent: string;
        try {
          decryptedContent = await nip04Service.decrypt(event.content, otherPubkey, {
            useActiveKey: true,
            fallbackToNative: true,
          });
        } catch (decryptError) {
          console.error('[DMInbox] Decryption failed:', decryptError);
          setDecryptionErrors((prev) => new Set(prev).add(event.id));
          decryptedContent = '[Failed to decrypt message]';
        }

        // Create message object
        const message: NostrDirectMessage = {
          id: event.id,
          from: senderPubkey,
          to: recipientPubkey,
          content: event.content,
          timestamp: event.created_at * 1000,
          decrypted: decryptedContent,
        };

        // Get or create thread
        const threadId = nip04Service.getThreadId(userPubkey, otherPubkey);

        setThreads((prevThreads) => {
          const updatedThreads = new Map(prevThreads);
          const existingThread = updatedThreads.get(threadId);

          if (existingThread) {
            // Add message to existing thread
            const updatedMessages = [...existingThread.messages, message].sort(
              (a, b) => a.timestamp - b.timestamp
            );

            // Remove duplicates
            const uniqueMessages = Array.from(
              new Map(updatedMessages.map((m) => [m.id, m])).values()
            );

            const unreadIncrement = isIncoming ? 1 : 0;

            updatedThreads.set(threadId, {
              ...existingThread,
              messages: uniqueMessages,
              lastMessage: decryptedContent,
              lastMessageTime: message.timestamp,
              unreadCount: existingThread.unreadCount + unreadIncrement,
            });
          } else {
            // Create new thread
            updatedThreads.set(threadId, {
              threadId,
              recipientPubkey: otherPubkey,
              lastMessage: decryptedContent,
              lastMessageTime: message.timestamp,
              unreadCount: isIncoming ? 1 : 0,
              messages: [message],
            });
          }

          return updatedThreads;
        });

        // Announce new message to screen readers
        if (isIncoming) {
          setAnnouncement(`New message from ${otherPubkey.slice(0, 8)}...`);
          setTimeout(() => setAnnouncement(''), 3000);
        }

        // Auto-scroll to bottom if viewing this thread
        if (selectedThreadId === threadId) {
          setTimeout(() => {
            conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      } catch (err) {
        console.error('[DMInbox] Error handling incoming event:', err);
      }
    },
    [userPubkey, selectedThreadId, nip04Service]
  );

  // ========================================
  // Message Sending
  // ========================================

  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !selectedThreadId || !userPubkey || sending) {
      return;
    }

    const thread = threads.get(selectedThreadId);
    if (!thread) {
      return;
    }

    setSending(true);

    try {
      // Encrypt message
      const encryptedContent = await nip04Service.encrypt(messageInput, thread.recipientPubkey, {
        useActiveKey: true,
      });

      // Create and publish DM event
      const result = await eventPublisher.createAndPublish(
        {
          kind: 4,
          content: encryptedContent,
          tags: [['p', thread.recipientPubkey]],
        },
        {
          strategy: 'broadcast',
        }
      );

      if (!result.success) {
        throw new Error('Failed to publish message to relays');
      }

      // Optimistic UI update
      const optimisticMessage: NostrDirectMessage = {
        id: result.eventId || `temp_${Date.now()}`,
        from: userPubkey,
        to: thread.recipientPubkey,
        content: encryptedContent,
        timestamp: Date.now(),
        decrypted: messageInput,
      };

      setThreads((prevThreads) => {
        const updatedThreads = new Map(prevThreads);
        const currentThread = updatedThreads.get(selectedThreadId);

        if (currentThread) {
          updatedThreads.set(selectedThreadId, {
            ...currentThread,
            messages: [...currentThread.messages, optimisticMessage],
            lastMessage: messageInput,
            lastMessageTime: optimisticMessage.timestamp,
          });
        }

        return updatedThreads;
      });

      // Clear input
      setMessageInput('');

      // Scroll to bottom
      setTimeout(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('[DMInbox] Failed to send message:', err);
      setError('Failed to send message');
      if (onError && err instanceof Error) onError(err);
    } finally {
      setSending(false);
    }
  }, [
    messageInput,
    selectedThreadId,
    userPubkey,
    threads,
    sending,
    nip04Service,
    eventPublisher,
    onError,
  ]);

  // ========================================
  // Thread Management
  // ========================================

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      setSelectedThreadId(threadId);

      // Mark as read
      const thread = threads.get(threadId);
      if (thread && thread.unreadCount > 0) {
        await nip04Service.markAsRead(userPubkey!, thread.recipientPubkey);

        setThreads((prevThreads) => {
          const updatedThreads = new Map(prevThreads);
          const currentThread = updatedThreads.get(threadId);

          if (currentThread) {
            updatedThreads.set(threadId, {
              ...currentThread,
              unreadCount: 0,
            });
          }

          return updatedThreads;
        });
      }

      // Scroll to bottom
      setTimeout(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    },
    [threads, userPubkey, nip04Service]
  );

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      const thread = threads.get(threadId);
      if (!thread) return;
      setDeleteThreadConfirmId(threadId);
    },
    [threads]
  );

  const handleConfirmDeleteThread = useCallback(async () => {
    if (!deleteThreadConfirmId) return;
    const thread = threads.get(deleteThreadConfirmId);
    if (!thread) return;

    await nip04Service.clearThread(userPubkey!, thread.recipientPubkey);

    setThreads((prevThreads) => {
      const updatedThreads = new Map(prevThreads);
      updatedThreads.delete(deleteThreadConfirmId);
      return updatedThreads;
    });

    if (selectedThreadId === deleteThreadConfirmId) {
      setSelectedThreadId(null);
    }
    setDeleteThreadConfirmId(null);
  }, [deleteThreadConfirmId, threads, nip04Service, userPubkey, selectedThreadId]);

  // ========================================
  // Filtering & Sorting
  // ========================================

  const filteredThreads = useMemo(() => {
    const threadArray = Array.from(threads.values());

    // Filter by search query
    const filtered = searchQuery
      ? threadArray.filter(
          (thread) =>
            thread.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
            thread.recipientPubkey.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : threadArray;

    // Sort by most recent
    return filtered.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  }, [threads, searchQuery]);

  const selectedThread = selectedThreadId ? threads.get(selectedThreadId) : null;

  // ========================================
  // Utility Functions
  // ========================================

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  const formatPubkey = (pubkey: string): string => {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  };

  // ========================================
  // Render
  // ========================================

  if (error && !userPubkey) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">No Active Key</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (loading && !error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full bg-muted ${className}`} aria-label="Direct Messages" role="main">
      {/* Live region for announcements */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Thread List Panel */}
      <div
        className="w-full md:w-1/3 bg-card border-r border-border flex flex-col"
        data-testid="thread-list"
        aria-label="Thread list"
      >
        {/* Search */}
        <div className="p-4 border-b border-border">
          <input
            type="search"
            placeholder="Search conversations..."
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search threads"
          />
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 ? (
            <div className="flex items-center justify-center h-full p-8 text-center">
              <div>
                <p className="text-muted-foreground mb-2">No messages yet</p>
                <p className="text-sm text-muted-foreground/60">
                  Your encrypted conversations will appear here
                </p>
              </div>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <div
                key={thread.threadId}
                data-testid="thread-item"
                className={`p-4 border-b border-border cursor-pointer hover:bg-accent transition-colors ${
                  selectedThreadId === thread.threadId
                    ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
                    : ''
                }`}
                onClick={() => handleSelectThread(thread.threadId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectThread(thread.threadId);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Conversation with ${formatPubkey(thread.recipientPubkey)}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="font-medium text-foreground truncate flex-1">
                    {formatPubkey(thread.recipientPubkey)}
                  </div>
                  <div className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                    {formatTimestamp(thread.lastMessageTime)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate flex-1">
                    {thread.lastMessage}
                  </p>
                  {thread.unreadCount > 0 && (
                    <span
                      className="ml-2 bg-indigo-600 text-white text-xs rounded-full px-2 py-1 flex-shrink-0"
                      aria-label={`${thread.unreadCount} unread messages`}
                    >
                      {thread.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation View Panel */}
      <div
        className="flex-1 flex flex-col bg-card"
        data-testid="conversation-view"
        data-active={selectedThread !== null}
        aria-label="Conversation"
      >
        {selectedThread ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground">
                  {formatPubkey(selectedThread.recipientPubkey)}
                </h2>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    title="Encrypted with NIP-04"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Encrypted with NIP-04
                </p>
              </div>
              <button
                onClick={() => handleDeleteThread(selectedThread.threadId)}
                className="text-red-600 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                aria-label="Delete conversation"
              >
                Delete
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedThread.messages.map((message) => {
                const isFromUser = message.from === userPubkey;
                const hasDecryptionError = decryptionErrors.has(message.id);

                return (
                  <div
                    key={message.id}
                    className={`flex ${isFromUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        isFromUser
                          ? 'bg-indigo-600 text-white'
                          : hasDecryptionError
                            ? 'bg-red-100 text-red-700'
                            : 'bg-muted text-foreground'
                      }`}
                    >
                      <p className="break-words">{message.decrypted}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isFromUser ? 'text-indigo-200' : 'text-muted-foreground'
                        }`}
                      >
                        {formatTimestamp(message.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={conversationEndRef} />
            </div>

            {/* Message Composer */}
            <div className="p-4 border-t border-border bg-muted">
              {error && (
                <div className="mb-2 p-2 bg-red-100 text-red-700 text-sm rounded">
                  Failed to send message. Please try again.
                </div>
              )}
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="w-full px-4 py-2 border border-border rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={2}
                    aria-label="Message input"
                    disabled={sending}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span
                      className="text-xs text-muted-foreground"
                      data-testid="char-counter"
                      aria-live="polite"
                    >
                      {messageInput.length}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Press Enter to send, Shift+Enter for new line
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sending}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-muted disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  aria-label="Send message"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full p-8 text-center">
            <div>
              <svg
                className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-muted-foreground">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteThreadConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteThreadConfirmId(null);
        }}
        title="Delete conversation"
        description="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteThread}
      />
    </div>
  );
};

export default DMInbox;
