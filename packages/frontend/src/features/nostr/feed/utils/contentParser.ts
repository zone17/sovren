/**
 * Content Parser Utilities
 * Parse NOSTR event content for media, links, mentions, and hashtags
 */

import type { ParsedContent } from '../types';

/**
 * URL regex pattern
 */
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Image URL regex pattern
 */
const IMAGE_REGEX = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg))/gi;

/**
 * Video URL regex pattern
 */
const VIDEO_REGEX = /(https?:\/\/[^\s]+\.(mp4|webm|ogg|mov))/gi;

/**
 * Hashtag regex pattern
 */
const HASHTAG_REGEX = /#([a-zA-Z0-9_]+)/g;

/**
 * Nostr mention regex pattern (nostr:npub1... or @npub1...)
 */
const MENTION_REGEX = /(?:nostr:|@)(npub1[a-z0-9]{58})/gi;

/**
 * Parse NOSTR event content
 */
export const parseContent = (content: string): ParsedContent => {
  const images: string[] = [];
  const videos: string[] = [];
  const links: string[] = [];
  const hashtags: string[] = [];
  const mentions: string[] = [];

  // Extract images
  const imageMatches = content.matchAll(IMAGE_REGEX);
  for (const match of imageMatches) {
    images.push(match[0]);
  }

  // Extract videos
  const videoMatches = content.matchAll(VIDEO_REGEX);
  for (const match of videoMatches) {
    videos.push(match[0]);
  }

  // Extract all URLs (excluding images and videos)
  const urlMatches = content.matchAll(URL_REGEX);
  for (const match of urlMatches) {
    const url = match[0];
    if (!images.includes(url) && !videos.includes(url)) {
      links.push(url);
    }
  }

  // Extract hashtags
  const hashtagMatches = content.matchAll(HASHTAG_REGEX);
  for (const match of hashtagMatches) {
    hashtags.push(match[1]); // Get the tag without #
  }

  // Extract mentions
  const mentionMatches = content.matchAll(MENTION_REGEX);
  for (const match of mentionMatches) {
    mentions.push(match[1]); // Get the npub identifier
  }

  // Create text without media URLs
  let text = content;
  [...images, ...videos].forEach(url => {
    text = text.replace(url, '').trim();
  });

  return {
    text,
    images,
    videos,
    links,
    hashtags,
    mentions,
  };
};

/**
 * Extract hashtags from content
 */
export const extractHashtags = (content: string): string[] => {
  const hashtags: string[] = [];
  const matches = content.matchAll(HASHTAG_REGEX);
  for (const match of matches) {
    hashtags.push(match[1]);
  }
  return hashtags;
};

/**
 * Extract mentions from content
 */
export const extractMentions = (content: string): string[] => {
  const mentions: string[] = [];
  const matches = content.matchAll(MENTION_REGEX);
  for (const match of matches) {
    mentions.push(match[1]);
  }
  return mentions;
};

/**
 * Truncate text to max length with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Format relative time (e.g., "2h ago", "5m ago")
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;

  return new Date(timestamp * 1000).toLocaleDateString();
};

/**
 * Format engagement count (e.g., "1.2K", "3.4M")
 */
export const formatCount = (count: number): string => {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
};
