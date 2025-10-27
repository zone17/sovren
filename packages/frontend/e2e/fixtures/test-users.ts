/**
 * 👥 Test User Fixtures for E2E Tests
 * Pre-configured test users with deterministic keys
 */
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

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

/**
 * Generate deterministic test user from seed
 */
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
  const privateKey = generateSecretKey();
  const publicKey = getPublicKey(privateKey);
  const privateKeyHex = Buffer.from(privateKey).toString('hex');
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

/**
 * Pre-configured test users
 */
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

/**
 * Get test user by ID
 */
export function getTestUser(id: keyof typeof TEST_USERS): TestUserProfile {
  return TEST_USERS[id];
}

/**
 * Get all test users
 */
export function getAllTestUsers(): TestUserProfile[] {
  return Object.values(TEST_USERS);
}

/**
 * Get test user public keys
 */
export function getTestUserPublicKeys(): string[] {
  return Object.values(TEST_USERS).map((user) => user.publicKey);
}

/**
 * Create follow relationship between users
 */
export function createFollowRelationships(): Map<string, string[]> {
  const follows = new Map<string, string[]>();

  // Alice follows Bob and Charlie
  follows.set(TEST_USERS.alice.publicKey, [
    TEST_USERS.bob.publicKey,
    TEST_USERS.charlie.publicKey,
  ]);

  // Bob follows Alice, Charlie, and Dave
  follows.set(TEST_USERS.bob.publicKey, [
    TEST_USERS.alice.publicKey,
    TEST_USERS.charlie.publicKey,
    TEST_USERS.dave.publicKey,
  ]);

  // Charlie follows everyone
  follows.set(TEST_USERS.charlie.publicKey, [
    TEST_USERS.alice.publicKey,
    TEST_USERS.bob.publicKey,
    TEST_USERS.dave.publicKey,
    TEST_USERS.eve.publicKey,
  ]);

  // Dave follows Alice and Bob
  follows.set(TEST_USERS.dave.publicKey, [TEST_USERS.alice.publicKey, TEST_USERS.bob.publicKey]);

  // Eve follows no one (bot account)
  follows.set(TEST_USERS.eve.publicKey, []);

  return follows;
}

/**
 * Export convenience constants
 */
export const ALICE = TEST_USERS.alice;
export const BOB = TEST_USERS.bob;
export const CHARLIE = TEST_USERS.charlie;
export const DAVE = TEST_USERS.dave;
export const EVE = TEST_USERS.eve;
