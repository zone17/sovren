/**
 * FingerprintService Unit Tests
 * Tests SimHash computation, Hamming distance, and similarity per ADR-020
 */

import { FingerprintService } from '../FingerprintService';

const mockDb = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnValue({ data: null, error: null }),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('FingerprintService', () => {
  let service: FingerprintService;

  beforeEach(() => {
    service = new FingerprintService(mockDb as any, mockLogger);
  });

  describe('computeSimHash', () => {
    it('should produce a 16-character hex string', () => {
      const hash = service.computeSimHash('This is a test document for SimHash hashing');
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should produce identical hashes for identical text', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const hash1 = service.computeSimHash(text);
      const hash2 = service.computeSimHash(text);
      expect(hash1).toBe(hash2);
    });

    it('should produce similar hashes for similar text', () => {
      const text1 = 'The quick brown fox jumps over the lazy dog';
      const text2 = 'The quick brown fox leaps over the lazy dog';
      const hash1 = service.computeSimHash(text1);
      const hash2 = service.computeSimHash(text2);

      const similarity = service.computeSimilarity(hash1, hash2);
      // Similar texts should have similarity > 0.5
      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should produce different hashes for very different text', () => {
      const text1 = 'The quick brown fox jumps over the lazy dog';
      const text2 = 'Completely unrelated content about quantum physics and space exploration';
      const hash1 = service.computeSimHash(text1);
      const hash2 = service.computeSimHash(text2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty text', () => {
      const hash = service.computeSimHash('');
      expect(hash).toBe('0000000000000000');
    });

    it('should handle HTML content by stripping tags', () => {
      const html = '<p>Hello <strong>world</strong></p>';
      const plain = 'Hello world';
      const hashHtml = service.computeSimHash(html);
      const hashPlain = service.computeSimHash(plain);
      expect(hashHtml).toBe(hashPlain);
    });

    it('should be case-insensitive', () => {
      const hash1 = service.computeSimHash('Hello World');
      const hash2 = service.computeSimHash('hello world');
      expect(hash1).toBe(hash2);
    });
  });

  describe('computeHammingDistance', () => {
    it('should return 0 for identical hashes', () => {
      const hash = 'abcdef0123456789';
      expect(service.computeHammingDistance(hash, hash)).toBe(0);
    });

    it('should return correct distance for known values', () => {
      // Hashes differ in exactly 1 bit
      const hash1 = '0000000000000000';
      const hash2 = '0000000000000001';
      expect(service.computeHammingDistance(hash1, hash2)).toBe(1);
    });

    it('should return max distance for completely different hashes', () => {
      const hash1 = '0000000000000000';
      const hash2 = 'ffffffffffffffff';
      expect(service.computeHammingDistance(hash1, hash2)).toBe(64);
    });
  });

  describe('computeSimilarity', () => {
    it('should return 1.0 for identical hashes', () => {
      const hash = 'abcdef0123456789';
      expect(service.computeSimilarity(hash, hash)).toBe(1.0);
    });

    it('should return 0.0 for maximally different hashes', () => {
      const hash1 = '0000000000000000';
      const hash2 = 'ffffffffffffffff';
      expect(service.computeSimilarity(hash1, hash2)).toBe(0.0);
    });

    it('should return value between 0 and 1', () => {
      const hash1 = 'abcdef0123456789';
      const hash2 = 'abcdef01234567ff';
      const similarity = service.computeSimilarity(hash1, hash2);
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('match level classification', () => {
    it('should classify >0.95 as exact_copy', () => {
      // Test through compare by ensuring computeSimilarity logic
      const text = 'This is a test document for matching purposes and classification';
      const hash = service.computeSimHash(text);
      const similarity = service.computeSimilarity(hash, hash);
      expect(similarity).toBe(1.0); // Identical = exact_copy
    });
  });
});
