/**
 * PKCE store behavior tests for TwitterAdapter and BlueskyAdapter.
 * Verifies TTL expiry and size-bound behaviour (todos 231 and 235).
 */

import { TwitterAdapter } from '../TwitterAdapter';
import { BlueskyAdapter } from '../BlueskyAdapter';
import type { PlatformAdapterConfig } from '../IPlatformAdapter';

const config: PlatformAdapterConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  callbackUrl: 'https://example.com/callback',
};

describe('PKCE store — TwitterAdapter', () => {
  let adapter: TwitterAdapter;

  beforeEach(() => {
    jest.useFakeTimers();
    adapter = new TwitterAdapter(config);
  });

  afterEach(() => {
    adapter.destroy();
    jest.useRealTimers();
  });

  it('stores a code_verifier and returns it during token exchange', async () => {
    // Arrange: trigger auth URL generation to populate pkceStore
    const state = 'test-state-twitter';
    adapter.getAuthorizationUrl(state);

    // Act: retrieve via exchangeCodeForTokens (spy on fetch to prevent real call)
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 7200,
        scope: 'tweet.read tweet.write',
      }),
    } as Response);

    await adapter.exchangeCodeForTokens('code-123', { state });

    // The fetch body should contain code_verifier (not empty)
    const body = fetchSpy.mock.calls[0][1]?.body as string;
    expect(body).toMatch(/code_verifier=/);
    fetchSpy.mockRestore();
  });

  it('returns undefined for verifier after 10-minute TTL expires', () => {
    const state = 'expired-state';
    adapter.getAuthorizationUrl(state);

    // Advance past 10 minutes
    jest.advanceTimersByTime(10 * 60 * 1000 + 1);

    // pkceStore is protected; access via cast for testing
    const store = (adapter as unknown as { pkceStore: { get: (k: string) => string | undefined } })
      .pkceStore;
    expect(store.get(state)).toBeUndefined();
  });

  it('is bounded at 1000 entries (LRU eviction)', () => {
    // Fill 1000 entries
    for (let i = 0; i < 1000; i++) {
      adapter.getAuthorizationUrl(`state-${i}`);
    }

    const store = (adapter as unknown as { pkceStore: { size: number } }).pkceStore;
    expect(store.size).toBe(1000);

    // Adding one more should evict the LRU entry, keeping size at 1000
    adapter.getAuthorizationUrl('state-overflow');
    expect(store.size).toBe(1000);
  });

  it('removes verifier after successful exchange (no double-use)', async () => {
    const state = 'single-use-state';
    adapter.getAuthorizationUrl(state);

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200, scope: '' }),
    } as Response);

    await adapter.exchangeCodeForTokens('code', { state });

    const store = (adapter as unknown as { pkceStore: { get: (k: string) => string | undefined } })
      .pkceStore;
    expect(store.get(state)).toBeUndefined();
  });
});

describe('PKCE store — BlueskyAdapter', () => {
  let adapter: BlueskyAdapter;

  beforeEach(() => {
    jest.useFakeTimers();
    adapter = new BlueskyAdapter(config);
  });

  afterEach(() => {
    adapter.destroy();
    jest.useRealTimers();
  });

  it('stores a code_verifier and sends it during token exchange', async () => {
    const state = 'test-state-bluesky';
    adapter.getAuthorizationUrl(state);

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 7200 }),
    } as Response);

    await adapter.exchangeCodeForTokens('code-456', { state });

    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.code_verifier).toBeDefined();
    expect(typeof body.code_verifier).toBe('string');
    fetchSpy.mockRestore();
  });

  it('expires verifier after 10-minute TTL', () => {
    const state = 'bsky-expired';
    adapter.getAuthorizationUrl(state);

    jest.advanceTimersByTime(10 * 60 * 1000 + 1);

    const store = (adapter as unknown as { pkceStore: { get: (k: string) => string | undefined } })
      .pkceStore;
    expect(store.get(state)).toBeUndefined();
  });

  it('destroy() clears pkceStore and cancels cleanup interval', () => {
    adapter.getAuthorizationUrl('state-1');
    adapter.destroy();

    const store = (adapter as unknown as { pkceStore: { size: number } }).pkceStore;
    expect(store.size).toBe(0);
  });
});
