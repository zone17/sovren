/**
 * Tests for Content Repurposing Service
 * EPIC-009: Rule-based content adaptation
 */

import { RepurposingService } from '../RepurposingService';

describe('RepurposingService', () => {
  let service: RepurposingService;
  let mockDb: any;
  let mockLogger: any;

  const creatorId = 'creator-pubkey-123';
  const contentId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn(),
      update: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };

    service = new RepurposingService(mockDb, mockLogger);
  });

  describe('repurpose', () => {
    const longContent = {
      id: contentId,
      title: 'How to Build Great Software',
      body: 'First paragraph about software engineering.\n\nSecond paragraph about testing.\n\nThird paragraph about deployment.\n\nFourth paragraph about monitoring.',
      creator_id: creatorId,
    };

    beforeEach(() => {
      mockDb.single.mockResolvedValue({ data: longContent, error: null });
      mockDb.insert.mockResolvedValue({ error: null });
    });

    it('should generate repurposed versions for each target platform', async () => {
      const results = await service.repurpose(creatorId, contentId, ['twitter', 'mastodon']);

      expect(results).toHaveLength(2);
      expect(results[0].platform).toBe('twitter');
      expect(results[0].format_type).toBe('thread');
      expect(results[1].platform).toBe('mastodon');
      expect(results[1].format_type).toBe('summary');
    });

    it('should generate thread format for Twitter', async () => {
      const results = await service.repurpose(creatorId, contentId, ['twitter']);

      expect(results[0].format_type).toBe('thread');
      expect(results[0].text).toContain('1/');
      expect(results[0].character_count).toBeGreaterThan(0);
    });

    it('should generate summary format for Mastodon', async () => {
      const results = await service.repurpose(creatorId, contentId, ['mastodon']);

      expect(results[0].format_type).toBe('summary');
      expect(results[0].character_limit).toBe(500);
    });

    it('should generate short_post format for Bluesky', async () => {
      const results = await service.repurpose(creatorId, contentId, ['bluesky']);

      expect(results[0].format_type).toBe('short_post');
      expect(results[0].character_limit).toBe(300);
    });

    it('should generate video_description format for YouTube', async () => {
      const results = await service.repurpose(creatorId, contentId, ['youtube']);

      expect(results[0].format_type).toBe('video_description');
      expect(results[0].character_limit).toBe(5000);
    });

    it('should include backlink in all repurposed versions', async () => {
      const results = await service.repurpose(creatorId, contentId, ['twitter', 'mastodon', 'bluesky']);

      for (const result of results) {
        expect(result.backlink_url).toContain(contentId);
        expect(result.text).toContain(result.backlink_url);
      }
    });

    it('should save repurposed content as unapproved drafts', async () => {
      const results = await service.repurpose(creatorId, contentId, ['twitter']);

      expect(results[0].approved).toBe(false);
    });

    it('should throw when content not found', async () => {
      mockDb.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      await expect(service.repurpose(creatorId, contentId, ['twitter'])).rejects.toThrow(
        'Content not found or access denied'
      );
    });

    it('should insert repurposed content into database', async () => {
      await service.repurpose(creatorId, contentId, ['twitter']);

      expect(mockDb.from).toHaveBeenCalledWith('repurposed_content');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('getRepurposed', () => {
    it('should return repurposed versions from database', async () => {
      const mockData = [
        {
          id: 'rep-1',
          source_content_id: contentId,
          platform: 'twitter',
          format_type: 'thread',
          text: 'Thread content',
          character_count: 15,
          approved: false,
          backlink_url: 'https://sovren.app/content/123',
        },
      ];

      mockDb.order.mockResolvedValue({ data: mockData, error: null });

      const results = await service.getRepurposed(creatorId, contentId);

      expect(results).toHaveLength(1);
      expect(results[0].platform).toBe('twitter');
      expect(results[0].character_limit).toBe(280);
    });
  });

  describe('approve', () => {
    it('should approve a repurposed version', async () => {
      const mockApproved = {
        id: 'rep-1',
        source_content_id: contentId,
        platform: 'mastodon',
        format_type: 'summary',
        text: 'Summary text',
        character_count: 12,
        approved: true,
        backlink_url: 'https://sovren.app/content/123',
      };

      mockDb.single.mockResolvedValue({ data: mockApproved, error: null });

      const result = await service.approve(creatorId, 'rep-1');

      expect(result.approved).toBe(true);
      expect(result.character_limit).toBe(500);
    });

    it('should throw when repurposed content not found', async () => {
      mockDb.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      await expect(service.approve(creatorId, 'nonexistent')).rejects.toThrow(
        'Repurposed content not found or access denied'
      );
    });
  });
});
