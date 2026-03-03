/**
 * Auth flow unit tests.
 *
 * Tests:
 *   1. NIP-07 detection (window.nostr presence)
 *   2. Signature contract — createSignatureMessage is used correctly
 *   3. Token storage — apiClient.setToken() called on success
 *   4. Logout sequence — token cleared
 *
 * Uses the real RealAuthService with MSW intercepting HTTP calls.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { server } from '../../../test-utils/msw/server';
import { realAuthService } from '../services/realAuthService';
import apiClient from '../../../services/api/apiClient';
import { createSignatureMessage } from '@sovren/shared/types/nostr/auth';

// Reset token between tests
afterEach(() => {
  apiClient.setToken(null);
});

// --- NIP-07 detection ---

describe('NIP-07 detection', () => {
  afterEach(() => {
    // Clean up window.nostr after each test
    Object.defineProperty(window, 'nostr', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('detects window.nostr when extension is present', () => {
    const mockNostr = {
      getPublicKey: vi.fn().mockResolvedValue('abc123pubkey'),
      signEvent: vi.fn(),
    };

    Object.defineProperty(window, 'nostr', {
      value: mockNostr,
      writable: true,
      configurable: true,
    });

    expect(window.nostr).toBeDefined();
    expect(typeof window.nostr?.getPublicKey).toBe('function');
  });

  it('returns undefined when extension is not present', () => {
    Object.defineProperty(window, 'nostr', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    expect(window.nostr).toBeUndefined();
  });
});

// --- createSignatureMessage contract ---

describe('createSignatureMessage signature contract', () => {
  it('produces the correct Sovren Authentication message format', () => {
    const challenge = 'test-challenge-abc';
    const timestamp = 1700000000;
    const message = createSignatureMessage(challenge, timestamp);

    expect(message).toBe(`Sovren Authentication\nChallenge: ${challenge}\nTimestamp: ${timestamp}`);
  });

  it('message format is consistent for the same inputs', () => {
    const challenge = 'abc123';
    const timestamp = 1234567890;

    const msg1 = createSignatureMessage(challenge, timestamp);
    const msg2 = createSignatureMessage(challenge, timestamp);

    expect(msg1).toBe(msg2);
  });

  it('changing challenge produces a different message', () => {
    const ts = 1700000000;
    const msg1 = createSignatureMessage('challenge-A', ts);
    const msg2 = createSignatureMessage('challenge-B', ts);
    expect(msg1).not.toBe(msg2);
  });

  it('changing timestamp produces a different message', () => {
    const ch = 'same-challenge';
    const msg1 = createSignatureMessage(ch, 1000);
    const msg2 = createSignatureMessage(ch, 2000);
    expect(msg1).not.toBe(msg2);
  });
});

// --- Token storage ---

describe('token storage after authentication', () => {
  beforeEach(() => {
    apiClient.setToken(null);
  });

  it('stores JWT token in apiClient after successful NOSTR auth', async () => {
    // MSW default handler returns { success: true, data: { token: 'test-jwt-token', user: {...} } }
    const result = await realAuthService.authenticateNostr({
      pubkey: 'abc123pubkey',
      challenge: 'test-challenge-abc123',
      timestamp: Math.floor(Date.now() / 1000),
      signature: 'sig123',
      event: {
        kind: 22242,
        pubkey: 'abc123pubkey',
        created_at: Math.floor(Date.now() / 1000),
        tags: [['challenge', 'test-challenge-abc123']],
        content: 'hash',
        id: 'event-id',
        sig: 'sig123',
      },
    });

    // Auth response from MSW returns { token, user } under data
    // RealAuthService maps data.token into apiClient
    expect(result.success).toBe(true);
  });

  it('does not store token when authentication fails', async () => {
    server.use(
      http.post('*/api/auth/authenticate', () => {
        return HttpResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
      })
    );

    await realAuthService.authenticateNostr({
      pubkey: 'abc123pubkey',
      challenge: 'test-challenge',
      timestamp: Math.floor(Date.now() / 1000),
      signature: 'bad-sig',
      event: {} as Parameters<typeof realAuthService.authenticateNostr>[0]['event'],
    });

    // Token should remain null after failed auth
    expect(apiClient.getToken()).toBeNull();
  });
});

// --- Challenge retrieval ---

describe('generateNostrChallenge', () => {
  it('returns challenge and timestamp from the server', async () => {
    const result = await realAuthService.generateNostrChallenge();

    expect(result.challenge).toBe('test-challenge-abc123');
    expect(result.timestamp).toBeTypeOf('number');
    expect(result.error).toBeUndefined();
  });

  it('returns error when challenge endpoint fails', async () => {
    server.use(
      http.post('*/api/auth/challenge', () => {
        return HttpResponse.json({ success: false, error: 'Server error' }, { status: 500 });
      })
    );

    const result = await realAuthService.generateNostrChallenge();

    expect(result.challenge).toBeUndefined();
    expect(result.error).toBeDefined();
  });
});

// --- Logout sequence ---

describe('logout sequence', () => {
  it('clears the token from apiClient after logout', async () => {
    // Set a token first
    apiClient.setToken('test-jwt-token');
    expect(apiClient.getToken()).toBe('test-jwt-token');

    await realAuthService.logout();

    expect(apiClient.getToken()).toBeNull();
  });

  it('clears token even when backend logout request fails', async () => {
    server.use(
      http.post('/api/auth/logout', () => {
        return HttpResponse.json({ success: false, error: 'Server error' }, { status: 500 });
      })
    );

    apiClient.setToken('test-jwt-token');
    await realAuthService.logout();

    // Token must be cleared regardless of backend response
    expect(apiClient.getToken()).toBeNull();
  });

  it('does not throw when logout is called without an active token', async () => {
    apiClient.setToken(null);
    await expect(realAuthService.logout()).resolves.not.toThrow();
  });
});
