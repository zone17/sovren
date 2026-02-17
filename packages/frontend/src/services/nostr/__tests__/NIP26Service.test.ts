/**
 * 🧪 ELITE TESTS: NIP-26 Delegated Event Signing Service
 * US-318: NIP-26 Implementation Tests
 *
 * Comprehensive test suite for NIP-26 delegation functionality
 * Target: 95%+ code coverage
 */

import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { getPublicKey, generateSecretKey, finalizeEvent } from 'nostr-tools/pure';
import { NIP26Service } from '../NIP26Service';
import type { NostrEvent, DelegationConditions } from '@shared/types/nostr';

describe('NIP26Service', () => {
  let service: NIP26Service;
  let delegatorPrivateKeyBytes: Uint8Array;
  let delegatorPrivateKey: string;
  let delegatorPublicKey: string;
  let delegateePrivateKeyBytes: Uint8Array;
  let delegateePrivateKey: string;
  let delegateePublicKey: string;

  function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  beforeEach(() => {
    service = NIP26Service.getInstance();

    // Generate test keys
    delegatorPrivateKeyBytes = generateSecretKey();
    delegatorPrivateKey = bytesToHex(delegatorPrivateKeyBytes);
    delegatorPublicKey = getPublicKey(delegatorPrivateKeyBytes);
    delegateePrivateKeyBytes = generateSecretKey();
    delegateePrivateKey = bytesToHex(delegateePrivateKeyBytes);
    delegateePublicKey = getPublicKey(delegateePrivateKeyBytes);
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NIP26Service.getInstance();
      const instance2 = NIP26Service.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('createDelegation', () => {
    it('should create delegation with kind condition', async () => {
      const conditions: DelegationConditions = { kind: 1 };

      const result = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      expect(result.token).toBeDefined();
      expect(result.token.delegator).toBe(delegatorPublicKey);
      expect(result.token.delegatee).toBe(delegateePublicKey);
      expect(result.token.conditions).toBe('kind=1');
      expect(result.token.signature).toBeDefined();
      expect(result.tag).toEqual([
        'delegation',
        delegatorPublicKey,
        'kind=1',
        result.token.signature,
      ]);
    });

    it('should create delegation with time conditions', async () => {
      const now = Math.floor(Date.now() / 1000);
      const conditions: DelegationConditions = {
        created_at_after: now,
        created_at_before: now + 3600,
      };

      const result = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      expect(result.token.conditions).toBe(
        `created_at>${now}&created_at<${now + 3600}`
      );
    });

    it('should create delegation with all conditions', async () => {
      const now = Math.floor(Date.now() / 1000);
      const conditions: DelegationConditions = {
        kind: 1,
        created_at_after: now,
        created_at_before: now + 3600,
      };

      const result = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      expect(result.token.conditions).toBe(
        `kind=1&created_at>${now}&created_at<${now + 3600}`
      );
    });

    it('should throw error for invalid delegatee public key', async () => {
      const conditions: DelegationConditions = { kind: 1 };

      await expect(
        service.createDelegation('invalid-key', conditions, delegatorPrivateKey)
      ).rejects.toThrow('Invalid public key format');
    });

    it('should throw error for invalid delegator private key', async () => {
      const conditions: DelegationConditions = { kind: 1 };

      await expect(
        service.createDelegation(
          delegateePublicKey,
          conditions,
          'invalid-key'
        )
      ).rejects.toThrow('Invalid private key format');
    });

    it('should throw error for empty conditions', async () => {
      const conditions: DelegationConditions = {};

      await expect(
        service.createDelegation(
          delegateePublicKey,
          conditions,
          delegatorPrivateKey
        )
      ).rejects.toThrow('At least one delegation condition must be specified');
    });

    it('should throw error for negative kind', async () => {
      const conditions: DelegationConditions = { kind: -1 };

      await expect(
        service.createDelegation(
          delegateePublicKey,
          conditions,
          delegatorPrivateKey
        )
      ).rejects.toThrow('Event kind must be non-negative');
    });

    it('should throw error for invalid time range', async () => {
      const now = Math.floor(Date.now() / 1000);
      const conditions: DelegationConditions = {
        created_at_after: now + 3600,
        created_at_before: now,
      };

      await expect(
        service.createDelegation(
          delegateePublicKey,
          conditions,
          delegatorPrivateKey
        )
      ).rejects.toThrow('created_at_after must be less than created_at_before');
    });
  });

  describe('validateDelegation', () => {
    it('should validate valid delegation', async () => {
      const conditions: DelegationConditions = { kind: 1 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      const event = finalizeEvent(
        {
          kind: 1,
          content: 'Test',
          tags: [delegation.tag],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      const result = await service.validateDelegation(event);

      expect(result.valid).toBe(true);
      expect(result.delegator).toBe(delegatorPublicKey);
      expect(result.delegatee).toBe(delegateePublicKey);
      expect(result.conditions).toEqual(conditions);
    });

    it('should reject event without delegation tag', async () => {
      const event = finalizeEvent(
        {
          kind: 1,
          content: 'Test',
          tags: [],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      const result = await service.validateDelegation(event);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('No delegation tag found');
    });

    it('should reject malformed delegation tag', async () => {
      const event = finalizeEvent(
        {
          kind: 1,
          content: 'Test',
          tags: [['delegation', 'incomplete']],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      const result = await service.validateDelegation(event);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid delegation tag format');
    });

    it('should reject event with wrong kind', async () => {
      const conditions: DelegationConditions = { kind: 1 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      const event = finalizeEvent(
        {
          kind: 3, // Wrong kind
          content: 'Test',
          tags: [delegation.tag],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      const result = await service.validateDelegation(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match required kind');
    });

    it('should reject event outside time range', async () => {
      const now = Math.floor(Date.now() / 1000);
      const conditions: DelegationConditions = {
        kind: 1,
        created_at_after: now + 100,
        created_at_before: now + 200,
      };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      const event = finalizeEvent(
        {
          kind: 1,
          content: 'Test',
          tags: [delegation.tag],
          created_at: now, // Before valid range
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      const result = await service.validateDelegation(event);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('is not after');
    });
  });

  describe('signDelegatedEvent', () => {
    it('should sign event with delegation', async () => {
      const conditions: DelegationConditions = { kind: 1 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      const event = await service.signDelegatedEvent(
        { kind: 1, content: 'Hello', tags: [] },
        delegateePrivateKey,
        delegation
      );

      expect(event.pubkey).toBe(delegateePublicKey);
      expect(event.kind).toBe(1);
      expect(event.content).toBe('Hello');
      expect(event.tags).toContainEqual(delegation.tag);
      expect(event.sig).toBeDefined();
    });

    it('should throw error for mismatched delegatee key', async () => {
      const conditions: DelegationConditions = { kind: 1 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      const wrongPrivateKey = bytesToHex(generateSecretKey());

      await expect(
        service.signDelegatedEvent(
          { kind: 1, content: 'Test', tags: [] },
          wrongPrivateKey,
          delegation
        )
      ).rejects.toThrow('does not match delegation token');
    });

    it('should throw error for invalid private key', async () => {
      const conditions: DelegationConditions = { kind: 1 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      await expect(
        service.signDelegatedEvent(
          { kind: 1, content: 'Test', tags: [] },
          'invalid-key',
          delegation
        )
      ).rejects.toThrow('Invalid private key format');
    });

    it('should throw error if event violates conditions', async () => {
      const conditions: DelegationConditions = { kind: 1 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      await expect(
        service.signDelegatedEvent(
          { kind: 3, content: 'Test', tags: [] }, // Wrong kind
          delegateePrivateKey,
          delegation
        )
      ).rejects.toThrow('Event violates delegation conditions');
    });
  });

  describe('extractDelegation', () => {
    it('should extract delegation from event', async () => {
      const conditions: DelegationConditions = { kind: 1 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      const event = finalizeEvent(
        {
          kind: 1,
          content: 'Test',
          tags: [delegation.tag],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      const extracted = service.extractDelegation(event);

      expect(extracted).not.toBeNull();
      expect(extracted?.delegator).toBe(delegatorPublicKey);
      expect(extracted?.delegatee).toBe(delegateePublicKey);
      expect(extracted?.conditions).toBe('kind=1');
    });

    it('should return null for event without delegation', () => {
      const event = finalizeEvent(
        {
          kind: 1,
          content: 'Test',
          tags: [],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      const extracted = service.extractDelegation(event);

      expect(extracted).toBeNull();
    });
  });

  describe('isDelegatedEvent', () => {
    it('should return true for delegated event', async () => {
      const conditions: DelegationConditions = { kind: 1 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      const event = finalizeEvent(
        {
          kind: 1,
          content: 'Test',
          tags: [delegation.tag],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      expect(service.isDelegatedEvent(event)).toBe(true);
    });

    it('should return false for non-delegated event', () => {
      const event = finalizeEvent(
        {
          kind: 1,
          content: 'Test',
          tags: [],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      expect(service.isDelegatedEvent(event)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle kind 0 (metadata)', async () => {
      const conditions: DelegationConditions = { kind: 0 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      expect(delegation.token.conditions).toBe('kind=0');
    });

    it('should handle very long time ranges', async () => {
      const conditions: DelegationConditions = {
        created_at_after: 1,
        created_at_before: 2147483647, // Max 32-bit int
      };

      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      expect(delegation.token.conditions).toBe(
        'created_at>1&created_at<2147483647'
      );
    });

    it('should handle multiple tags in event', async () => {
      const conditions: DelegationConditions = { kind: 1 };
      const delegation = await service.createDelegation(
        delegateePublicKey,
        conditions,
        delegatorPrivateKey
      );

      const event = finalizeEvent(
        {
          kind: 1,
          content: 'Test',
          tags: [
            ['t', 'nostr'],
            ['t', 'test'],
            delegation.tag,
            ['p', delegatorPublicKey],
          ],
          created_at: Math.floor(Date.now() / 1000),
          pubkey: delegateePublicKey,
        },
        delegateePrivateKeyBytes
      ) as NostrEvent;

      const result = await service.validateDelegation(event);
      expect(result.valid).toBe(true);
    });
  });
});
