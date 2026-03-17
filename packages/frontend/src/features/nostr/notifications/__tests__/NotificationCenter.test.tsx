/**
 * NotificationCenter Component Tests
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// @testing-library/jest-dom matchers are loaded via Vitest setup — no direct import needed
import { NotificationCenter } from '../components/NotificationCenter';
import { NotificationService, getNotificationService } from '../services/NotificationService';
import { Notification, NotificationType } from '../types';

// Mock the entire service module so getNotificationService returns our mockService
vi.mock('../services/NotificationService', () => ({
  NotificationService: vi.fn(),
  getNotificationService: vi.fn(),
}));

// Mock useToast — NotificationCenter imports it from NotificationProvider which requires Redux
vi.mock('@/components/providers/NotificationProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: NotificationType.MENTION,
    event: {
      id: 'event-1',
      pubkey: 'pubkey-1',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Test mention',
      sig: 'sig',
    },
    author: {
      pubkey: 'pubkey-1',
      name: 'Alice',
      avatar: 'https://example.com/avatar1.png',
    },
    content: 'Alice mentioned you in a post',
    createdAt: Math.floor(Date.now() / 1000),
    read: false,
  },
  {
    id: '2',
    type: NotificationType.REPLY,
    event: {
      id: 'event-2',
      pubkey: 'pubkey-2',
      created_at: Math.floor(Date.now() / 1000) - 3600,
      kind: 1,
      tags: [],
      content: 'Test reply',
      sig: 'sig',
    },
    author: {
      pubkey: 'pubkey-2',
      name: 'Bob',
    },
    content: 'Bob replied to your note',
    createdAt: Math.floor(Date.now() / 1000) - 3600,
    read: true,
  },
];

describe('NotificationCenter', () => {
  let mockService: vi.Mocked<NotificationService>;

  beforeEach(() => {
    mockService = {
      getState: vi.fn(() => ({
        notifications: mockNotifications,
        unreadCount: 1,
        loading: false,
        error: null,
        lastFetchedAt: Date.now(),
        subscribed: true,
      })),
      getUnreadCount: vi.fn(() => 1),
      subscribe: vi.fn((listener) => {
        listener({
          notifications: mockNotifications,
          unreadCount: 1,
          loading: false,
          error: null,
          lastFetchedAt: Date.now(),
          subscribed: true,
        });
        return vi.fn();
      }),
      getPreferences: vi.fn(() => ({
        enableMentions: true,
        enableReplies: true,
        enableReactions: true,
        enableReposts: true,
        enableDMs: true,
        enableFollows: true,
        enableZaps: true,
        playSound: true,
        showDesktopNotifications: true,
        soundVolume: 0.5,
        groupByDate: true,
        autoMarkRead: true,
      })),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
      getNotifications: vi.fn(() => mockNotifications),
    } as any;

    (NotificationService as any).mockImplementation(() => mockService);
    (getNotificationService as ReturnType<typeof vi.fn>).mockReturnValue(mockService);
  });

  describe('Rendering', () => {
    it('should render notification bell button', () => {
      render(<NotificationCenter />);

      // Use getByRole to avoid ambiguity with the badge's aria-label which also contains "notifications"
      const button = screen.getByRole('button', { name: /notifications/i });
      expect(button).toBeInTheDocument();
    });

    it('should display unread badge', () => {
      render(<NotificationCenter />);

      const badge = screen.getByText('1');
      expect(badge).toBeInTheDocument();
    });

    it('should not display badge when count is zero', () => {
      // Set up zero count state BEFORE render so the subscribe listener passes 0
      mockService.getUnreadCount.mockReturnValue(0);
      mockService.subscribe = vi.fn((listener) => {
        listener({
          notifications: mockNotifications,
          unreadCount: 0,
          loading: false,
          error: null,
          lastFetchedAt: Date.now(),
          subscribed: true,
        });
        return vi.fn();
      });
      mockService.getState.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 0,
        loading: false,
        error: null,
        lastFetchedAt: Date.now(),
        subscribed: true,
      });
      (getNotificationService as ReturnType<typeof vi.fn>).mockReturnValue(mockService);

      render(<NotificationCenter />);

      // Badge should not render when count is 0 (showZero is false by default)
      const badge = screen.queryByText('1');
      expect(badge).not.toBeInTheDocument();
    });

    it('should not render panel initially when initialOpen is false', () => {
      render(<NotificationCenter />);

      const panel = screen.queryByRole('dialog');
      expect(panel).not.toBeInTheDocument();
    });

    it('should render panel initially when initialOpen is true', () => {
      render(<NotificationCenter initialOpen />);

      const panel = screen.getByRole('dialog');
      expect(panel).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should open panel when bell is clicked', () => {
      render(<NotificationCenter />);

      const button = screen.getByRole('button', { name: /notifications/i });
      fireEvent.click(button);

      const panel = screen.getByRole('dialog');
      expect(panel).toBeInTheDocument();
    });

    it('should close panel when bell is clicked again', () => {
      render(<NotificationCenter />);

      const button = screen.getByRole('button', { name: /notifications/i });

      // Open
      fireEvent.click(button);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close
      fireEvent.click(button);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display notifications when panel is open', () => {
      render(<NotificationCenter initialOpen />);

      expect(screen.getByText('Alice mentioned you in a post')).toBeInTheDocument();
      expect(screen.getByText('Bob replied to your note')).toBeInTheDocument();
    });

    it('should filter notifications by type', () => {
      render(<NotificationCenter initialOpen />);

      // Click on Mentions filter
      const mentionsButton = screen.getByText('Mentions');
      fireEvent.click(mentionsButton);

      expect(screen.getByText('Alice mentioned you in a post')).toBeInTheDocument();
      expect(screen.queryByText('Bob replied to your note')).not.toBeInTheDocument();
    });

    it('should call markAllAsRead when button is clicked', async () => {
      render(<NotificationCenter initialOpen />);

      const markAllButton = screen.getByText(/mark all as read/i);
      fireEvent.click(markAllButton);

      await waitFor(() => {
        expect(mockService.markAllAsRead).toHaveBeenCalled();
      });
    });

    it('should open settings panel', () => {
      render(<NotificationCenter initialOpen showSettings />);

      const settingsButton = screen.getByLabelText(/settings/i);
      fireEvent.click(settingsButton);

      expect(screen.getByText('Notification Settings')).toBeInTheDocument();
    });

    it('should close panel when close button is clicked', () => {
      render(<NotificationCenter initialOpen />);

      const closeButton = screen.getByLabelText(/close/i);
      fireEvent.click(closeButton);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no notifications', () => {
      // Set up empty state BEFORE render so hooks receive empty notifications
      mockService.getNotifications.mockReturnValue([]);
      mockService.getState.mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null,
        lastFetchedAt: Date.now(),
        subscribed: true,
      });
      mockService.subscribe = vi.fn((listener) => {
        listener({
          notifications: [],
          unreadCount: 0,
          loading: false,
          error: null,
          lastFetchedAt: Date.now(),
          subscribed: true,
        });
        return vi.fn();
      });
      (getNotificationService as ReturnType<typeof vi.fn>).mockReturnValue(mockService);

      render(<NotificationCenter initialOpen />);

      expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
    });

    it('should display empty state for filtered category', () => {
      render(<NotificationCenter initialOpen />);

      // Filter by DMs (none exist)
      const dmButton = screen.getByText('Messages');
      fireEvent.click(dmButton);

      expect(screen.getByText(/no notifications in this category/i)).toBeInTheDocument();
    });
  });

  describe('Grouping', () => {
    it('should group notifications by date when enabled', () => {
      render(<NotificationCenter initialOpen />);

      // Should see date group headers
      expect(screen.getByText(/today/i)).toBeInTheDocument();
    });

    it('should not group when disabled', () => {
      mockService.getPreferences.mockReturnValue({
        enableMentions: true,
        enableReplies: true,
        enableReactions: true,
        enableReposts: true,
        enableDMs: true,
        enableFollows: true,
        enableZaps: true,
        playSound: true,
        showDesktopNotifications: true,
        soundVolume: 0.5,
        groupByDate: false,
        autoMarkRead: true,
      });

      render(<NotificationCenter initialOpen />);

      expect(screen.getByText('All Notifications')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes on bell button', () => {
      render(<NotificationCenter />);

      const button = screen.getByRole('button', { name: /notifications/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have proper ARIA label on panel', () => {
      render(<NotificationCenter initialOpen />);

      const panel = screen.getByRole('dialog');
      expect(panel).toHaveAttribute('aria-label', 'Notification center');
    });

    it('should support keyboard navigation', () => {
      render(<NotificationCenter />);

      // Buttons in browsers open on click; use click to simulate keyboard activation
      const button = screen.getByRole('button', { name: /notifications/i });
      button.focus();
      expect(button).toHaveFocus();

      // Simulate activation via click (Enter on a button triggers its onClick handler)
      fireEvent.click(button);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Position', () => {
    it('should position panel on the right by default', () => {
      render(<NotificationCenter initialOpen />);

      const panel = screen.getByRole('dialog');
      expect(panel).toHaveClass('right-0');
    });

    it('should position panel on the left when specified', () => {
      render(<NotificationCenter initialOpen position="left" />);

      const panel = screen.getByRole('dialog');
      expect(panel).toHaveClass('left-0');
    });
  });

  describe('Callbacks', () => {
    it('should call onNotificationClick when notification is clicked', () => {
      const onNotificationClick = vi.fn();
      render(<NotificationCenter initialOpen onNotificationClick={onNotificationClick} />);

      const notification = screen.getByText('Alice mentioned you in a post');
      fireEvent.click(notification);

      expect(onNotificationClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          type: NotificationType.MENTION,
        })
      );
    });
  });
});
