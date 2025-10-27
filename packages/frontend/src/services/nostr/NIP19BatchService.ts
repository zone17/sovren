/**
 * 🔐 NIP-19 Batch Operations Service
 * US-310: NIP-19 Encoding Utilities - Subtasks 3-4
 *
 * High-performance batch encoding/decoding for NIP-19 identifiers
 *
 * Features:
 * - Batch encoding for all entity types
 * - Batch decoding with validation
 * - Parallel processing for large datasets
 * - Error recovery per item
 * - Progress tracking
 * - Memory-efficient chunking
 */

import { NIP19Service } from './NIP19Service';
import type {
  DecodedNIP19,
  ProfilePointer,
  EventPointer,
  AddressPointer,
} from '@shared/types/nostr';

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  success: T[];
  failed: BatchError[];
  total: number;
  successCount: number;
  failedCount: number;
  duration: number;
}

/**
 * Batch error details
 */
export interface BatchError {
  input: any;
  index: number;
  error: Error;
  reason: string;
}

/**
 * Batch operation options
 */
export interface BatchOptions {
  /** Maximum items to process in parallel */
  concurrency?: number;
  /** Chunk size for processing */
  chunkSize?: number;
  /** Stop on first error */
  stopOnError?: boolean;
  /** Progress callback */
  onProgress?: (progress: BatchProgress) => void;
  /** Validate inputs before processing */
  validate?: boolean;
}

/**
 * Batch progress info
 */
export interface BatchProgress {
  processed: number;
  total: number;
  percentage: number;
  currentChunk: number;
  totalChunks: number;
}

/**
 * Encoding input types
 */
export type EncodingInput =
  | { type: 'npub'; pubkey: string }
  | { type: 'nsec'; privkey: string }
  | { type: 'note'; eventId: string }
  | { type: 'nprofile'; profile: ProfilePointer }
  | { type: 'nevent'; event: EventPointer }
  | { type: 'naddr'; address: AddressPointer }
  | { type: 'nrelay'; url: string };

/**
 * NIP-19 Batch Operations Service
 */
export class NIP19BatchService {
  private static instance: NIP19BatchService | null = null;
  private nip19Service: NIP19Service;

  private constructor() {
    this.nip19Service = NIP19Service.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): NIP19BatchService {
    if (!this.instance) {
      this.instance = new NIP19BatchService();
    }
    return this.instance;
  }

  /**
   * Batch encode multiple items
   */
  public async batchEncode(
    inputs: EncodingInput[],
    options: BatchOptions = {}
  ): Promise<BatchResult<{ input: EncodingInput; encoded: string }>> {
    const {
      concurrency = 10,
      chunkSize = 100,
      stopOnError = false,
      onProgress,
      validate = true,
    } = options;

    const startTime = Date.now();
    const results: { input: EncodingInput; encoded: string }[] = [];
    const errors: BatchError[] = [];

    // Process in chunks
    const chunks = this.chunkArray(inputs, chunkSize);
    const totalChunks = chunks.length;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      // Process chunk items in parallel with concurrency limit
      const chunkPromises = chunk.map(async (input, index) => {
        const globalIndex = chunkIndex * chunkSize + index;

        try {
          // Validate input if requested
          if (validate && !this.validateEncodingInput(input)) {
            throw new Error(`Invalid input type or data: ${input.type}`);
          }

          // Encode based on type
          const encoded = await this.encodeItem(input);

          return {
            success: true,
            result: { input, encoded },
            index: globalIndex,
          };
        } catch (error) {
          return {
            success: false,
            error: error as Error,
            input,
            index: globalIndex,
          };
        }
      });

      // Wait for chunk to complete
      const chunkResults = await this.processWithConcurrency(
        chunkPromises,
        concurrency
      );

      // Process results
      for (const result of chunkResults) {
        if (result.success) {
          results.push(result.result!);
        } else {
          const batchError: BatchError = {
            input: result.input,
            index: result.index,
            error: result.error!,
            reason: result.error!.message,
          };
          errors.push(batchError);

          if (stopOnError) {
            break;
          }
        }
      }

      // Report progress
      if (onProgress) {
        const processed = (chunkIndex + 1) * chunkSize;
        onProgress({
          processed: Math.min(processed, inputs.length),
          total: inputs.length,
          percentage: Math.min(100, (processed / inputs.length) * 100),
          currentChunk: chunkIndex + 1,
          totalChunks,
        });
      }

      if (stopOnError && errors.length > 0) {
        break;
      }
    }

    return {
      success: results,
      failed: errors,
      total: inputs.length,
      successCount: results.length,
      failedCount: errors.length,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Batch decode multiple identifiers
   */
  public async batchDecode(
    identifiers: string[],
    options: BatchOptions = {}
  ): Promise<BatchResult<{ identifier: string; decoded: DecodedNIP19 }>> {
    const {
      concurrency = 10,
      chunkSize = 100,
      stopOnError = false,
      onProgress,
    } = options;

    const startTime = Date.now();
    const results: { identifier: string; decoded: DecodedNIP19 }[] = [];
    const errors: BatchError[] = [];

    // Process in chunks
    const chunks = this.chunkArray(identifiers, chunkSize);
    const totalChunks = chunks.length;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      // Process chunk items
      const chunkPromises = chunk.map(async (identifier, index) => {
        const globalIndex = chunkIndex * chunkSize + index;

        try {
          const decoded = this.nip19Service.decode(identifier);

          if (!decoded) {
            throw new Error('Failed to decode identifier');
          }

          return {
            success: true,
            result: { identifier, decoded },
            index: globalIndex,
          };
        } catch (error) {
          return {
            success: false,
            error: error as Error,
            input: identifier,
            index: globalIndex,
          };
        }
      });

      // Wait for chunk to complete
      const chunkResults = await this.processWithConcurrency(
        chunkPromises,
        concurrency
      );

      // Process results
      for (const result of chunkResults) {
        if (result.success) {
          results.push(result.result!);
        } else {
          const batchError: BatchError = {
            input: result.input,
            index: result.index,
            error: result.error!,
            reason: result.error!.message,
          };
          errors.push(batchError);

          if (stopOnError) {
            break;
          }
        }
      }

      // Report progress
      if (onProgress) {
        const processed = (chunkIndex + 1) * chunkSize;
        onProgress({
          processed: Math.min(processed, identifiers.length),
          total: identifiers.length,
          percentage: Math.min(100, (processed / identifiers.length) * 100),
          currentChunk: chunkIndex + 1,
          totalChunks,
        });
      }

      if (stopOnError && errors.length > 0) {
        break;
      }
    }

    return {
      success: results,
      failed: errors,
      total: identifiers.length,
      successCount: results.length,
      failedCount: errors.length,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Batch convert between formats
   */
  public async batchConvert(
    inputs: string[],
    targetType: 'hex' | 'npub' | 'note',
    options: BatchOptions = {}
  ): Promise<BatchResult<{ input: string; converted: string }>> {
    const encodingInputs: EncodingInput[] = [];

    // Prepare inputs for batch encoding
    for (const input of inputs) {
      try {
        const decoded = this.nip19Service.decode(input);
        if (!decoded) continue;

        switch (targetType) {
          case 'hex':
            // Return hex values directly
            if ('data' in decoded) {
              encodingInputs.push({
                type: 'note',
                eventId: decoded.data as string,
              });
            }
            break;

          case 'npub':
            if (decoded.type === 'npub' || decoded.type === 'nsec') {
              encodingInputs.push({
                type: 'npub',
                pubkey: decoded.data,
              });
            }
            break;

          case 'note':
            if (decoded.type === 'note') {
              encodingInputs.push({
                type: 'note',
                eventId: decoded.data,
              });
            }
            break;
        }
      } catch (error) {
        // Skip invalid inputs
        continue;
      }
    }

    // Use batch encode for conversion
    const encodeResult = await this.batchEncode(encodingInputs, options);

    // Transform results
    const converted = encodeResult.success.map((item, index) => ({
      input: inputs[index],
      converted: item.encoded,
    }));

    return {
      ...encodeResult,
      success: converted,
    };
  }

  /**
   * Validate batch of identifiers
   */
  public async batchValidate(
    identifiers: string[],
    options: BatchOptions = {}
  ): Promise<BatchResult<{ identifier: string; valid: boolean; type?: string }>> {
    const results: { identifier: string; valid: boolean; type?: string }[] = [];
    const errors: BatchError[] = [];
    const startTime = Date.now();

    for (let i = 0; i < identifiers.length; i++) {
      try {
        const decoded = this.nip19Service.decode(identifiers[i]);
        results.push({
          identifier: identifiers[i],
          valid: decoded !== null,
          type: decoded?.type,
        });
      } catch (error) {
        results.push({
          identifier: identifiers[i],
          valid: false,
        });
      }
    }

    return {
      success: results,
      failed: errors,
      total: identifiers.length,
      successCount: results.filter(r => r.valid).length,
      failedCount: results.filter(r => !r.valid).length,
      duration: Date.now() - startTime,
    };
  }

  // ========================================
  // PRIVATE METHODS
  // ========================================

  /**
   * Encode single item
   */
  private async encodeItem(input: EncodingInput): Promise<string> {
    switch (input.type) {
      case 'npub':
        return this.nip19Service.encodePubkey(input.pubkey);

      case 'nsec':
        return this.nip19Service.encodePrivkey(input.privkey);

      case 'note':
        return this.nip19Service.encodeEventId(input.eventId);

      case 'nprofile':
        return this.nip19Service.encodeProfile(input.profile);

      case 'nevent':
        return this.nip19Service.encodeEvent(input.event);

      case 'naddr':
        return this.nip19Service.encodeAddress(input.address);

      case 'nrelay':
        return this.nip19Service.encodeRelay(input.url);

      default:
        throw new Error(`Unknown encoding type`);
    }
  }

  /**
   * Validate encoding input
   */
  private validateEncodingInput(input: EncodingInput): boolean {
    switch (input.type) {
      case 'npub':
      case 'nsec':
      case 'note':
        return typeof input[Object.keys(input)[1] as keyof typeof input] === 'string';

      case 'nprofile':
      case 'nevent':
      case 'naddr':
        return typeof input[Object.keys(input)[1] as keyof typeof input] === 'object';

      case 'nrelay':
        return typeof input.url === 'string' && input.url.startsWith('ws');

      default:
        return false;
    }
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Process promises with concurrency limit
   */
  private async processWithConcurrency<T>(
    promises: Promise<T>[],
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const promise of promises) {
      const exec = promise.then(result => {
        results.push(result);
      });

      executing.push(exec);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(p => p === exec),
          1
        );
      }
    }

    await Promise.all(executing);
    return results;
  }
}

/**
 * Export singleton instance
 */
export const nip19Batch = NIP19BatchService.getInstance();