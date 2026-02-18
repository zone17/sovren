/**
 * Content Repurposing Service
 * EPIC-009: Rule-based content adaptation for different platforms
 *
 * Converts long-form content into platform-optimized formats:
 * - Thread (for Twitter/Bluesky): Split by paragraphs, numbered segments
 * - Summary (for Mastodon): Key points + backlink
 * - Short post (for Bluesky): Title + first sentence + backlink
 * - Video description (for YouTube): Full description with metadata
 */

import { v4 as uuidv4 } from 'uuid';
import type { IRepurposingService } from '../../interfaces/distribution/IRepurposingService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type {
  RepurposedContent,
  SupportedPlatform,
  RepurposeFormatType,
} from '@sovren/shared/types/distribution';

const PLATFORM_CHAR_LIMITS: Record<SupportedPlatform, number> = {
  mastodon: 500,
  bluesky: 300,
  twitter: 280,
  youtube: 5000,
};

const PLATFORM_FORMAT_MAP: Record<SupportedPlatform, RepurposeFormatType> = {
  twitter: 'thread',
  bluesky: 'short_post',
  mastodon: 'summary',
  youtube: 'video_description',
};

export class RepurposingService implements IRepurposingService {
  private readonly db: ISupabaseClient;
  private readonly logger: ILogger;

  constructor(db: ISupabaseClient, logger: ILogger) {
    this.db = db;
    this.logger = logger;
  }

  async repurpose(
    creatorId: string,
    contentId: string,
    targetPlatforms: SupportedPlatform[]
  ): Promise<RepurposedContent[]> {
    // Fetch source content
    const { data: content, error: contentError } = await this.db
      .from('content')
      .select('id, title, body, creator_id')
      .eq('id', contentId)
      .eq('creator_id', creatorId)
      .single();

    if (contentError || !content) {
      throw new Error('Content not found or access denied');
    }

    const sourceText = content.body || '';
    const title = content.title || '';
    const backlink = `${process.env.FRONTEND_URL || 'https://sovren.app'}/content/${contentId}`;

    const results: RepurposedContent[] = [];

    for (const platform of targetPlatforms) {
      const formatType = PLATFORM_FORMAT_MAP[platform];
      const charLimit = PLATFORM_CHAR_LIMITS[platform];

      let text: string;
      switch (formatType) {
        case 'thread':
          text = this.toThread(title, sourceText, backlink, charLimit);
          break;
        case 'summary':
          text = this.toSummary(title, sourceText, backlink, charLimit);
          break;
        case 'short_post':
          text = this.toShortPost(title, sourceText, backlink, charLimit);
          break;
        case 'video_description':
          text = this.toVideoDescription(title, sourceText, backlink, charLimit);
          break;
        default:
          text = this.toShortPost(title, sourceText, backlink, charLimit);
      }

      const id = uuidv4();
      const row = {
        id,
        creator_id: creatorId,
        source_content_id: contentId,
        platform,
        format_type: formatType,
        text,
        character_count: text.length,
        approved: false,
        backlink_url: backlink,
      };

      const { error: insertError } = await this.db
        .from('repurposed_content')
        .insert(row);

      if (insertError) {
        throw insertError;
      }

      results.push({
        id,
        source_content_id: contentId,
        platform,
        format_type: formatType,
        text,
        character_count: text.length,
        character_limit: charLimit,
        approved: false,
        backlink_url: backlink,
      });
    }

    this.logger.info('[RepurposingService] Content repurposed', {
      creatorId,
      contentId,
      platforms: targetPlatforms,
    });

    return results;
  }

  async getRepurposed(creatorId: string, contentId: string): Promise<RepurposedContent[]> {
    const { data, error } = await this.db
      .from('repurposed_content')
      .select('id, source_content_id, platform, format_type, text, character_count, approved, backlink_url')
      .eq('creator_id', creatorId)
      .eq('source_content_id', contentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((row: any) => ({
      ...row,
      character_limit: PLATFORM_CHAR_LIMITS[row.platform as SupportedPlatform] || 500,
    }));
  }

  async approve(creatorId: string, repurposedId: string): Promise<RepurposedContent> {
    const { data, error } = await this.db
      .from('repurposed_content')
      .update({ approved: true, updated_at: new Date().toISOString() })
      .eq('id', repurposedId)
      .eq('creator_id', creatorId)
      .select('id, source_content_id, platform, format_type, text, character_count, approved, backlink_url')
      .single();

    if (error || !data) {
      throw new Error('Repurposed content not found or access denied');
    }

    return {
      ...data,
      character_limit: PLATFORM_CHAR_LIMITS[data.platform as SupportedPlatform] || 500,
    };
  }

  // ============================================================================
  // Rule-Based Conversion Strategies
  // ============================================================================

  private toThread(title: string, body: string, backlink: string, charLimit: number): string {
    const paragraphs = body
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length <= 1) {
      return this.truncateWithBacklink(title ? `${title}\n\n${body}` : body, backlink, charLimit);
    }

    const parts: string[] = [];
    const totalParts = Math.min(paragraphs.length + 1, 10); // Cap at 10 thread segments

    // First part: hook with title
    const hook = title ? `${title}\n\n${paragraphs[0]}` : paragraphs[0];
    parts.push(this.truncate(`1/${totalParts} ${hook}`, charLimit));

    // Middle parts: content paragraphs
    for (let i = 1; i < paragraphs.length && parts.length < totalParts - 1; i++) {
      parts.push(this.truncate(`${parts.length + 1}/${totalParts} ${paragraphs[i]}`, charLimit));
    }

    // Last part: backlink
    parts.push(`${parts.length + 1}/${totalParts} Read the full post: ${backlink}`);

    return parts.join('\n\n---\n\n');
  }

  private toSummary(title: string, body: string, backlink: string, charLimit: number): string {
    const paragraphs = body
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Extract heading-like lines (lines that look like h2/h3)
    const headings = body
      .split('\n')
      .filter((line) => line.match(/^#{2,3}\s/) || (line.length < 80 && line.length > 5 && !line.endsWith('.')))
      .map((h) => h.replace(/^#{2,3}\s/, '').trim())
      .slice(0, 5);

    let summary = title ? `${title}\n\n` : '';

    if (headings.length > 0) {
      summary += headings.map((h) => `- ${h}`).join('\n');
    } else if (paragraphs.length > 0) {
      summary += paragraphs[0];
    }

    return this.truncateWithBacklink(summary, backlink, charLimit);
  }

  private toShortPost(title: string, body: string, backlink: string, charLimit: number): string {
    const firstSentence = body.split(/[.!?]\s/)[0] || body.substring(0, 100);
    const text = title ? `${title}: ${firstSentence}` : firstSentence;
    return this.truncateWithBacklink(text, backlink, charLimit);
  }

  private toVideoDescription(
    title: string,
    body: string,
    backlink: string,
    charLimit: number
  ): string {
    let description = title ? `${title}\n\n` : '';
    description += body;
    description += `\n\n---\nOriginal post: ${backlink}`;
    return this.truncate(description, charLimit);
  }

  private truncateWithBacklink(text: string, backlink: string, charLimit: number): string {
    const suffix = `\n\n${backlink}`;
    const maxTextLength = charLimit - suffix.length;

    if (text.length <= maxTextLength) {
      return text + suffix;
    }

    return text.substring(0, maxTextLength - 3) + '...' + suffix;
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
