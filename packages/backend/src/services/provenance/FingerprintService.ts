/**
 * FingerprintService
 * SimHash for text + pHash for images per ADR-020
 * EPIC-008: Content Shield (US-E8-003)
 *
 * SimHash: 64-bit locality-sensitive hash for text content
 * pHash: 64-bit perceptual hash for images (placeholder — requires sharp)
 *
 * Similarity: Hamming distance / 64 bits
 * Thresholds: >0.95 exact_copy, 0.70-0.95 derivative, <0.70 coincidental
 */

import type {
  Fingerprint,
  FingerprintRegistry,
  CompareResult,
  MatchLevel,
  Pagination,
} from '@shared/types/provenance';
import type {
  IFingerprintService,
  CreateFingerprintInput,
  CompareInput,
} from '../../interfaces/provenance/IFingerprintService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';

export class FingerprintService implements IFingerprintService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async createFingerprint(
    creatorId: string,
    input: CreateFingerprintInput
  ): Promise<{ content_id: string; fingerprints: Fingerprint[]; created_at: string }> {
    const now = new Date().toISOString();
    const fingerprints: Fingerprint[] = [];

    if (input.content_type === 'text') {
      const hash = this.computeSimHash(input.content_data);
      const fp: Fingerprint = {
        content_id: input.content_id,
        hash_type: 'simhash',
        hash_value: hash,
        created_at: now,
      };

      await this.db.from('content_fingerprints').upsert(
        {
          content_id: input.content_id,
          creator_id: creatorId,
          hash_type: 'simhash',
          hash_value: hash,
          content_type: 'text',
        },
        { onConflict: 'content_id,hash_type' }
      );

      fingerprints.push(fp);
    } else if (input.content_type === 'image') {
      // pHash placeholder — in production would use sharp + DCT
      const hash = this.computeSimpleImageHash(input.content_data);
      const fp: Fingerprint = {
        content_id: input.content_id,
        hash_type: 'phash',
        hash_value: hash,
        created_at: now,
      };

      await this.db.from('content_fingerprints').upsert(
        {
          content_id: input.content_id,
          creator_id: creatorId,
          hash_type: 'phash',
          hash_value: hash,
          content_type: 'image',
        },
        { onConflict: 'content_id,hash_type' }
      );

      fingerprints.push(fp);
    }

    this.logger.info('Fingerprint created', {
      contentId: input.content_id,
      type: input.content_type,
    });
    return { content_id: input.content_id, fingerprints, created_at: now };
  }

  async getRegistry(
    creatorId: string,
    page: number,
    limit: number
  ): Promise<{ data: FingerprintRegistry; pagination: Pagination }> {
    // Get total counts
    const { count: totalFingerprinted } = await this.db
      .from('content_fingerprints')
      .select('content_id', { count: 'exact', head: true })
      .eq('creator_id', creatorId);

    // Get paginated fingerprints
    const offset = (page - 1) * limit;
    const { data: fpData, error } = await this.db
      .from('content_fingerprints')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to get fingerprint registry', { creatorId, error });
      throw error;
    }

    const total = totalFingerprinted || 0;
    const totalContent = total; // Approximation — would count distinct content in production
    const totalPages = Math.ceil(total / limit);

    const fingerprints: Fingerprint[] = (fpData || []).map((row: any) => ({
      content_id: row.content_id,
      content_title: row.content_title || undefined,
      hash_type: row.hash_type,
      hash_value: row.hash_value,
      created_at: row.created_at,
    }));

    return {
      data: {
        total_fingerprinted: total,
        total_content: totalContent,
        coverage_percentage: totalContent > 0 ? Math.round((total / totalContent) * 1000) / 10 : 0,
        fingerprints,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async compare(creatorId: string, input: CompareInput): Promise<CompareResult> {
    // Time-window filter: default 90 days, configurable via input or env
    const windowDays =
      (input as any).windowDays ||
      parseInt(process.env.FINGERPRINT_COMPARE_WINDOW_DAYS || '90', 10);
    const fullScan = (input as any).fullScan === true;

    let query = this.db
      .from('content_fingerprints')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('hash_type', input.hash_type);

    // Apply time-window filter unless full scan is requested (admin/DMCA investigation)
    if (!fullScan) {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - windowDays);
      query = query.gte('created_at', windowStart.toISOString());
    }

    // Bound the result set to prevent unbounded memory usage
    query = query.limit(1000);

    const { data: fpData, error } = await query;

    if (error) {
      this.logger.error('Failed to compare fingerprints', { creatorId, error });
      throw error;
    }

    const rows = fpData || [];
    const matches = rows
      .map((row: any) => {
        const similarity = this.computeSimilarity(input.hash_value, row.hash_value);
        return {
          content_id: row.content_id,
          content_title: row.content_title || 'Untitled',
          similarity: Math.round(similarity * 1000) / 1000,
          match_level: this.getMatchLevel(similarity),
          hash_type: row.hash_type,
        };
      })
      .filter((m: any) => m.similarity >= input.threshold)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, 20); // Return top 20 matches

    return {
      matches,
      total_compared: rows.length,
    };
  }

  /**
   * Compute SimHash for text content.
   * Algorithm per ADR-020:
   * 1. Tokenize into word-level bigrams
   * 2. Hash each bigram with FNV-1a
   * 3. Sum +1/-1 per bit position
   * 4. Final hash: bit = 1 if sum > 0
   */
  computeSimHash(text: string): string {
    // Preprocess: lowercase, normalize whitespace, strip HTML
    const cleaned = text
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\s]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    // Tokenize into words
    const words = cleaned.split(' ').filter((w) => w.length > 0);

    if (words.length === 0) {
      return '0000000000000000';
    }

    // Generate bigrams
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
    if (bigrams.length === 0 && words.length > 0) {
      bigrams.push(words[0]);
    }

    // Initialize 64-bit sum array
    const sums = new Array(64).fill(0);

    // Hash each bigram and accumulate
    for (const bigram of bigrams) {
      const hash = this.fnv1a64(bigram);
      for (let i = 0; i < 64; i++) {
        if ((hash[Math.floor(i / 32)] >>> (i % 32)) & 1) {
          sums[i] += 1;
        } else {
          sums[i] -= 1;
        }
      }
    }

    // Construct final hash
    let high = 0;
    let low = 0;
    for (let i = 0; i < 32; i++) {
      if (sums[i] > 0) low |= 1 << i;
    }
    for (let i = 32; i < 64; i++) {
      if (sums[i] > 0) high |= 1 << (i - 32);
    }

    // Convert to 16-char hex string
    const highHex = (high >>> 0).toString(16).padStart(8, '0');
    const lowHex = (low >>> 0).toString(16).padStart(8, '0');
    return highHex + lowHex;
  }

  /**
   * Compute Hamming distance between two hex hash strings.
   */
  computeHammingDistance(hash1: string, hash2: string): number {
    let distance = 0;
    for (let i = 0; i < hash1.length; i += 8) {
      const a = parseInt(hash1.substring(i, i + 8), 16) >>> 0;
      const b = parseInt(hash2.substring(i, i + 8), 16) >>> 0;
      let xor = a ^ b;
      // Popcount
      while (xor) {
        distance += xor & 1;
        xor >>>= 1;
      }
    }
    return distance;
  }

  /**
   * Compute similarity from Hamming distance.
   * similarity = 1 - (hamming_distance / 64)
   */
  computeSimilarity(hash1: string, hash2: string): number {
    const distance = this.computeHammingDistance(hash1, hash2);
    return 1 - distance / 64;
  }

  private getMatchLevel(similarity: number): MatchLevel {
    if (similarity > 0.95) return 'exact_copy';
    if (similarity >= 0.7) return 'derivative';
    return 'coincidental';
  }

  /**
   * FNV-1a 64-bit hash (using two 32-bit integers).
   */
  private fnv1a64(str: string): [number, number] {
    // FNV offset basis for 64-bit (split into two 32-bit parts)
    let high = 0xcbf29ce4;
    let low = 0x84222325;

    for (let i = 0; i < str.length; i++) {
      const byte = str.charCodeAt(i);
      // XOR with byte
      low ^= byte;
      // FNV prime multiplication (simplified for 32-bit pairs)
      // FNV-1a prime = 0x00000100000001B3
      const oldLow = low;
      low = Math.imul(low, 0x01000193);
      high = Math.imul(high, 0x01000193) + Math.imul(oldLow, 0x01);
    }

    return [high >>> 0, low >>> 0];
  }

  /**
   * Simple image hash placeholder.
   * In production, this would use sharp for resize + DCT for pHash.
   */
  private computeSimpleImageHash(base64Data: string): string {
    // Use a simple hash of the base64 data as placeholder
    // Real implementation: sharp resize to 32x32 grayscale → DCT → median threshold
    return this.computeSimHash(base64Data);
  }
}
