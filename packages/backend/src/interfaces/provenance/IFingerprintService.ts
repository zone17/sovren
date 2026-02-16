/**
 * IFingerprintService Interface
 * SimHash text + pHash image hashing per ADR-020
 * EPIC-008: Content Shield
 */

import type {
  Fingerprint,
  FingerprintRegistry,
  CompareResult,
  HashType,
  ContentType,
  Pagination,
} from '@sovren/shared/types/provenance';

export interface CreateFingerprintInput {
  content_id: string;
  content_type: ContentType;
  content_data: string;
}

export interface CompareInput {
  hash_type: HashType;
  hash_value: string;
  threshold: number;
}

export interface IFingerprintService {
  createFingerprint(creatorId: string, input: CreateFingerprintInput): Promise<{ content_id: string; fingerprints: Fingerprint[]; created_at: string }>;
  getRegistry(creatorId: string, page: number, limit: number): Promise<{ data: FingerprintRegistry; pagination: Pagination }>;
  compare(creatorId: string, input: CompareInput): Promise<CompareResult>;
  computeSimHash(text: string): string;
  computeHammingDistance(hash1: string, hash2: string): number;
  computeSimilarity(hash1: string, hash2: string): number;
}
