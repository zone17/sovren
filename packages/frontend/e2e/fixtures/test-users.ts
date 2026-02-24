/**
 * Test User Fixtures for E2E Tests
 * Deterministic keys — same pubkeys every run for seed.sql matching.
 */
import { getPublicKey, nip19 } from 'nostr-tools';

export interface TestUserProfile {
  id: string;
  privateKey: Uint8Array;
  publicKey: string;
  privateKeyHex: string;
  nsec: string;
  npub: string;
  profile: {
    name: string;
    about: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
  };
}

/** Hardcoded hex keys — deterministic across runs */
const TEST_PRIVATE_KEYS: Record<string, string> = {
  alice: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  bob: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
  charlie: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
  dave: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
  eve: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
};

function createTestUser(
  id: string,
  profile: {
    name: string;
    about: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
  }
): TestUserProfile {
  const privateKeyHex = TEST_PRIVATE_KEYS[id];
  const privateKey = Uint8Array.from(
    privateKeyHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const publicKey = getPublicKey(privateKey);
  const nsec = nip19.nsecEncode(privateKey);
  const npub = nip19.npubEncode(publicKey);

  return {
    id,
    privateKey,
    publicKey,
    privateKeyHex,
    nsec,
    npub,
    profile,
  };
}

export const TEST_USERS = {
  alice: createTestUser('alice', {
    name: 'Alice Test',
    about: 'E2E test user Alice - Content creator',
    picture: 'https://i.pravatar.cc/150?u=alice',
    nip05: 'alice@test.sovren.app',
    lud16: 'alice@getalby.com',
  }),

  bob: createTestUser('bob', {
    name: 'Bob Test',
    about: 'E2E test user Bob - Regular user',
    picture: 'https://i.pravatar.cc/150?u=bob',
    nip05: 'bob@test.sovren.app',
  }),

  charlie: createTestUser('charlie', {
    name: 'Charlie Test',
    about: 'E2E test user Charlie - Power user',
    picture: 'https://i.pravatar.cc/150?u=charlie',
    nip05: 'charlie@test.sovren.app',
    lud16: 'charlie@getalby.com',
  }),

  dave: createTestUser('dave', {
    name: 'Dave Test',
    about: 'E2E test user Dave - New user',
  }),

  eve: createTestUser('eve', {
    name: 'Eve Test',
    about: 'E2E test user Eve - Bot account',
    picture: 'https://i.pravatar.cc/150?u=eve',
  }),
};
