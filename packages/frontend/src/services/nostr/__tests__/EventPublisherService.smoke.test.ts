/**
 * Smoke test for EventPublisherService
 */

import { describe, it, expect, vi } from 'vitest';

// Mock dependencies that EventPublisherService needs at module load time
vi.mock('../KeyManagementService');
vi.mock('../RelayPoolManager');

describe('EventPublisherService Smoke Test', () => {
  it('should load the module', async () => {
    // Use dynamic import instead of require() — this is an ESM project
    await expect(import('../EventPublisherService')).resolves.toBeDefined();
  });
});
