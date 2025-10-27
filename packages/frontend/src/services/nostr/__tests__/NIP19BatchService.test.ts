/**
 * 🧪 NIP-19 Batch Service Tests
 * US-310: NIP-19 Encoding Utilities - Subtask 7
 *
 * Comprehensive test coverage for batch operations
 */

import { NIP19BatchService } from '../NIP19BatchService';
import type { EncodingInput, BatchOptions } from '../NIP19BatchService';

describe('NIP19BatchService', () => {
  let service: NIP19BatchService;

  beforeEach(() => {
    service = NIP19BatchService.getInstance();
  });

  describe('Batch Encoding', () => {
    it('should batch encode multiple pubkeys', async () => {
      const inputs: EncodingInput[] = [
        {
          type: 'npub',
          pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
        },
        {
          type: 'npub',
          pubkey: '8e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
        },
      ];

      const result = await service.batchEncode(inputs);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.success).toHaveLength(2);
      expect(result.success[0].encoded).toMatch(/^npub1/);
    });

    it('should batch encode mixed entity types', async () => {
      const inputs: EncodingInput[] = [
        {
          type: 'npub',
          pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
        },
        {
          type: 'note',
          eventId: 'b9b0cc4e5d3c7e4a6e2a8e5d4c3b2a1e0d9c8b7a6e5d4c3b2a1e0d9c8b7a6e5d',
        },
        {
          type: 'nprofile',
          profile: {
            pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
            relays: ['wss://relay.damus.io', 'wss://nos.lol'],
          },
        },
      ];

      const result = await service.batchEncode(inputs);

      expect(result.successCount).toBe(3);
      expect(result.success[0].encoded).toMatch(/^npub1/);
      expect(result.success[1].encoded).toMatch(/^note1/);
      expect(result.success[2].encoded).toMatch(/^nprofile1/);
    });

    it('should handle encoding errors gracefully', async () => {
      const inputs: EncodingInput[] = [
        {
          type: 'npub',
          pubkey: 'valid_pubkey',
        },
        {
          type: 'npub',
          pubkey: 'invalid', // Too short
        },
        {
          type: 'npub',
          pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
        },
      ];

      const result = await service.batchEncode(inputs);

      expect(result.total).toBe(3);
      expect(result.successCount).toBe(1); // Only the last one is valid
      expect(result.failedCount).toBe(2);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0].reason).toBeDefined();
    });

    it('should respect concurrency limits', async () => {
      const inputs: EncodingInput[] = Array(100).fill(null).map((_, i) => ({
        type: 'npub' as const,
        pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
      }));

      const options: BatchOptions = {
        concurrency: 5,
        chunkSize: 20,
      };

      const result = await service.batchEncode(inputs, options);

      expect(result.successCount).toBe(100);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should stop on first error when configured', async () => {
      const inputs: EncodingInput[] = [
        {
          type: 'npub',
          pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
        },
        {
          type: 'npub',
          pubkey: 'invalid',
        },
        {
          type: 'npub',
          pubkey: '8e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
        },
      ];

      const options: BatchOptions = {
        stopOnError: true,
      };

      const result = await service.batchEncode(inputs, options);

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.total).toBe(3); // Total is still 3, but processing stopped
    });

    it('should report progress correctly', async () => {
      const progressReports: any[] = [];
      const inputs: EncodingInput[] = Array(50).fill(null).map(() => ({
        type: 'npub' as const,
        pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
      }));

      const options: BatchOptions = {
        chunkSize: 10,
        onProgress: (progress) => {
          progressReports.push(progress);
        },
      };

      await service.batchEncode(inputs, options);

      expect(progressReports.length).toBeGreaterThan(0);
      expect(progressReports[progressReports.length - 1].percentage).toBe(100);
      expect(progressReports[progressReports.length - 1].processed).toBe(50);
    });
  });

  describe('Batch Decoding', () => {
    it('should batch decode multiple identifiers', async () => {
      const identifiers = [
        'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg',
        'note1h66x3w8vvmwskanfa7evmhq0nzuj9w8zqmwa2xhcwpq8hy4gdmqspq0kus',
      ];

      const result = await service.batchDecode(identifiers);

      expect(result.successCount).toBe(2);
      expect(result.success[0].decoded.type).toBe('npub');
      expect(result.success[1].decoded.type).toBe('note');
    });

    it('should handle invalid identifiers', async () => {
      const identifiers = [
        'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg',
        'invalid_identifier',
        'note1h66x3w8vvmwskanfa7evmhq0nzuj9w8zqmwa2xhcwpq8hy4gdmqspq0kus',
      ];

      const result = await service.batchDecode(identifiers);

      expect(result.total).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.failed[0].input).toBe('invalid_identifier');
    });

    it('should decode with chunking', async () => {
      const identifiers = Array(100).fill(
        'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg'
      );

      const options: BatchOptions = {
        chunkSize: 25,
      };

      const result = await service.batchDecode(identifiers, options);

      expect(result.successCount).toBe(100);
      expect(result.success).toHaveLength(100);
    });
  });

  describe('Batch Conversion', () => {
    it('should convert between formats', async () => {
      const inputs = [
        'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg',
        'npub1yfg0d955c2jrj2080ew7pa4xrtj7x7s7umt28wh0zurwmxgpyj9shwvsls',
      ];

      const result = await service.batchConvert(inputs, 'hex');

      expect(result.successCount).toBeGreaterThan(0);
      expect(result.success[0].converted).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple identifiers', async () => {
      const identifiers = [
        'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg',
        'invalid',
        'note1h66x3w8vvmwskanfa7evmhq0nzuj9w8zqmwa2xhcwpq8hy4gdmqspq0kus',
        'nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p',
      ];

      const result = await service.batchValidate(identifiers);

      expect(result.total).toBe(4);
      expect(result.success).toHaveLength(4);
      expect(result.success[0].valid).toBe(true);
      expect(result.success[0].type).toBe('npub');
      expect(result.success[1].valid).toBe(false);
      expect(result.success[2].valid).toBe(true);
      expect(result.success[2].type).toBe('note');
      expect(result.success[3].valid).toBe(true);
      expect(result.success[3].type).toBe('nprofile');
    });

    it('should handle empty input', async () => {
      const result = await service.batchValidate([]);

      expect(result.total).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should handle large batches efficiently', async () => {
      const inputs: EncodingInput[] = Array(1000).fill(null).map(() => ({
        type: 'npub' as const,
        pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
      }));

      const startTime = Date.now();
      const result = await service.batchEncode(inputs, {
        concurrency: 20,
        chunkSize: 100,
      });
      const duration = Date.now() - startTime;

      expect(result.successCount).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.duration).toBeLessThan(5000);
    });

    it('should process chunks in parallel', async () => {
      const inputs: EncodingInput[] = Array(100).fill(null).map(() => ({
        type: 'npub' as const,
        pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
      }));

      const serialResult = await service.batchEncode(inputs, {
        concurrency: 1,
        chunkSize: 100,
      });

      const parallelResult = await service.batchEncode(inputs, {
        concurrency: 10,
        chunkSize: 100,
      });

      // Parallel should be faster or equal
      expect(parallelResult.duration).toBeLessThanOrEqual(serialResult.duration + 100);
    });
  });

  describe('Error Recovery', () => {
    it('should continue processing after errors', async () => {
      const inputs: EncodingInput[] = [
        { type: 'npub', pubkey: '7e7e9c42' }, // Invalid
        {
          type: 'npub',
          pubkey: '7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
        },
        { type: 'npub', pubkey: 'xyz' }, // Invalid
        {
          type: 'npub',
          pubkey: '8e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e',
        },
      ];

      const result = await service.batchEncode(inputs, {
        stopOnError: false,
      });

      expect(result.total).toBe(4);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(2);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0].index).toBe(0);
      expect(result.failed[1].index).toBe(2);
    });

    it('should provide detailed error information', async () => {
      const inputs: EncodingInput[] = [
        {
          type: 'npub',
          pubkey: 'short',
        },
      ];

      const result = await service.batchEncode(inputs);

      expect(result.failedCount).toBe(1);
      expect(result.failed[0].error).toBeDefined();
      expect(result.failed[0].reason).toBeDefined();
      expect(result.failed[0].input).toEqual(inputs[0]);
      expect(result.failed[0].index).toBe(0);
    });
  });
});