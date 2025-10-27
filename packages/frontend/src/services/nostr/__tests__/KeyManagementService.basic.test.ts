/**
 * KeyManagementService Basic Tests
 * US-315: Quick validation tests for key management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('KeyManagementService - Basic Validation', () => {
  it('should import without errors', async () => {
    const { KeyManagementService } = await import('../KeyManagementService');
    expect(KeyManagementService).toBeDefined();
  });

  it('should verify nostr-tools is available', async () => {
    const { generateSecretKey, getPublicKey } = await import('nostr-tools');

    expect(generateSecretKey).toBeDefined();
    expect(getPublicKey).toBeDefined();

    // Test basic key generation
    const sk = generateSecretKey();
    expect(sk).toHaveLength(32);

    const pk = getPublicKey(sk);
    expect(pk).toHaveLength(64);
  });

  it('should verify shared types are available', async () => {
    const types = await import('@sovren/shared/types/nostr-key-management');

    expect(types.NostrEnhancedKeyPairSchema).toBeDefined();
    expect(types.NostrKeyStorageType).toBeDefined();
    expect(types.NostrEntropySource).toBeDefined();
  });
});
