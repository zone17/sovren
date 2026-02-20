/**
 * FeedItem Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FeedItem } from '../components/FeedItem';
import type { FeedEvent } from '../types';

describe('FeedItem', () => {
  const mockFeedEvent: FeedEvent = {
    event: {
      id: 'event123',
      pubkey: 'pubkey123',
      created_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      kind: 1,
      tags: [],
      content: 'Test post content',
      sig: 'sig123',
    },
    engagement: {
      reactions: 42,
      reposts: 12,
      replies: 5,
      isLikedByUser: false,
      isRepostedByUser: false,
    },
    authorProfile: {
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      display_name: 'Test User',
    },
    parsedContent: {
      text: 'Test post content',
      images: [],
      videos: [],
      links: [],
      mentions: [],
      hashtags: [],
    },
    timestamp: Math.floor(Date.now() / 1000) - 3600,
  };

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<FeedItem feedEvent={mockFeedEvent} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('displays author name', () => {
      render(<FeedItem feedEvent={mockFeedEvent} />);
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('displays post content', () => {
      render(<FeedItem feedEvent={mockFeedEvent} />);
      expect(screen.getByText('Test post content')).toBeInTheDocument();
    });

    it('displays engagement counts', () => {
      render(<FeedItem feedEvent={mockFeedEvent} />);
      expect(screen.getByText('42')).toBeInTheDocument(); // Reactions
      expect(screen.getByText('12')).toBeInTheDocument(); // Reposts
      expect(screen.getByText('5')).toBeInTheDocument(); // Replies
    });

    it('renders author avatar', () => {
      render(<FeedItem feedEvent={mockFeedEvent} />);
      const avatar = screen.getByAltText('Test User');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('displays relative time', () => {
      render(<FeedItem feedEvent={mockFeedEvent} />);
      expect(screen.getByText(/ago/i)).toBeInTheDocument();
    });

    it('renders images when present', () => {
      const eventWithImage = {
        ...mockFeedEvent,
        parsedContent: {
          ...mockFeedEvent.parsedContent,
          images: ['https://example.com/image.jpg'],
        },
      };

      render(<FeedItem feedEvent={eventWithImage} />);
      const image = screen.getByAltText('Image 1');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
    });

    it('renders condensed view when condensed prop is true', () => {
      render(<FeedItem feedEvent={mockFeedEvent} condensed={true} />);
      const avatar = screen.getByAltText('Test User');
      expect(avatar).toHaveClass('w-8', 'h-8'); // Smaller avatar
    });
  });

  describe('Interactions', () => {
    it('calls onClick when card is clicked', async () => {
      const handleClick = vi.fn();
      render(<FeedItem feedEvent={mockFeedEvent} onClick={handleClick} />);

      const article = screen.getByRole('article');
      await userEvent.click(article);

      expect(handleClick).toHaveBeenCalledWith(mockFeedEvent);
    });

    it('calls onProfileClick when avatar is clicked', async () => {
      const handleProfileClick = vi.fn();
      render(<FeedItem feedEvent={mockFeedEvent} onProfileClick={handleProfileClick} />);

      const avatar = screen.getByRole('button', { name: /view profile/i });
      await userEvent.click(avatar);

      expect(handleProfileClick).toHaveBeenCalledWith('pubkey123');
    });

    it('calls onLike when like button is clicked', async () => {
      const handleLike = vi.fn();
      render(<FeedItem feedEvent={mockFeedEvent} onLike={handleLike} />);

      const likeButton = screen.getByLabelText(/like post/i);
      await userEvent.click(likeButton);

      expect(handleLike).toHaveBeenCalledWith(mockFeedEvent.event);
    });

    it('calls onRepost when repost button is clicked', async () => {
      const handleRepost = vi.fn();
      render(<FeedItem feedEvent={mockFeedEvent} onRepost={handleRepost} />);

      const repostButton = screen.getByLabelText(/repost/i);
      await userEvent.click(repostButton);

      expect(handleRepost).toHaveBeenCalledWith(mockFeedEvent.event);
    });

    it('calls onReply when reply button is clicked', async () => {
      const handleReply = vi.fn();
      render(<FeedItem feedEvent={mockFeedEvent} onReply={handleReply} />);

      const replyButton = screen.getByLabelText(/reply to post/i);
      await userEvent.click(replyButton);

      expect(handleReply).toHaveBeenCalledWith(mockFeedEvent.event);
    });

    it('stops event propagation on action buttons', async () => {
      const handleClick = vi.fn();
      const handleLike = vi.fn();

      render(
        <FeedItem feedEvent={mockFeedEvent} onClick={handleClick} onLike={handleLike} />
      );

      const likeButton = screen.getByLabelText(/like post/i);
      await userEvent.click(likeButton);

      expect(handleLike).toHaveBeenCalled();
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<FeedItem feedEvent={mockFeedEvent} />);

      expect(screen.getByRole('article')).toHaveAttribute(
        'aria-label',
        'Post by Test User'
      );
      expect(screen.getByLabelText(/like post/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/repost/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/reply to post/i)).toBeInTheDocument();
    });

    it('indicates liked state with aria-pressed', () => {
      const likedEvent = {
        ...mockFeedEvent,
        engagement: { ...mockFeedEvent.engagement, isLikedByUser: true },
      };

      render(<FeedItem feedEvent={likedEvent} />);
      const likeButton = screen.getByLabelText(/like post/i);

      expect(likeButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('indicates reposted state with aria-pressed', () => {
      const repostedEvent = {
        ...mockFeedEvent,
        engagement: { ...mockFeedEvent.engagement, isRepostedByUser: true },
      };

      render(<FeedItem feedEvent={repostedEvent} />);
      const repostButton = screen.getByLabelText(/repost/i);

      expect(repostButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('has keyboard navigable buttons', () => {
      render(<FeedItem feedEvent={mockFeedEvent} />);

      const likeButton = screen.getByLabelText(/like post/i);
      likeButton.focus();

      expect(likeButton).toHaveFocus();
    });

    it('lazy loads images for performance', () => {
      const eventWithImage = {
        ...mockFeedEvent,
        parsedContent: {
          ...mockFeedEvent.parsedContent,
          images: ['https://example.com/image.jpg'],
        },
      };

      render(<FeedItem feedEvent={eventWithImage} />);
      const image = screen.getByAltText('Image 1');

      expect(image).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('Edge Cases', () => {
    it('handles missing author profile', () => {
      const eventWithoutProfile = {
        ...mockFeedEvent,
        authorProfile: undefined,
      };

      render(<FeedItem feedEvent={eventWithoutProfile} />);
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('handles missing parsed content', () => {
      const eventWithoutParsedContent = {
        ...mockFeedEvent,
        parsedContent: undefined,
      };

      render(<FeedItem feedEvent={eventWithoutParsedContent} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('handles zero engagement counts', () => {
      const eventWithZeroEngagement = {
        ...mockFeedEvent,
        engagement: {
          reactions: 0,
          reposts: 0,
          replies: 0,
          isLikedByUser: false,
          isRepostedByUser: false,
        },
      };

      render(<FeedItem feedEvent={eventWithZeroEngagement} />);
      expect(screen.getAllByText('0')).toHaveLength(3);
    });

    it('renders without optional callbacks', () => {
      render(<FeedItem feedEvent={mockFeedEvent} />);
      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });
});
