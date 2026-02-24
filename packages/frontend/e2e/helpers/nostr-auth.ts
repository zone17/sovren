/**
 * NOSTR Authentication Helper for E2E Tests
 * Performs real NOSTR challenge-response auth against the backend API.
 * Zero mocks — exercises the full auth flow.
 */
import { finalizeEvent } from 'nostr-tools/pure';
import { createHash } from 'crypto';
import type { APIRequestContext } from '@playwright/test';
import { createSignatureMessage } from '@shared/types/nostr/auth';

export async function authenticateWithNostr(
  request: APIRequestContext,
  privateKey: Uint8Array,
  publicKey: string,
  role: 'creator' | 'supporter' = 'creator',
  baseUrl = 'http://localhost:3001'
): Promise<string> {
  // 1. Get challenge from backend
  const challengeRes = await request.post(`${baseUrl}/api/auth/challenge`);
  if (!challengeRes.ok()) {
    throw new Error(
      `Challenge request failed: ${challengeRes.status()} ${await challengeRes.text()}`
    );
  }
  const challengeBody = await challengeRes.json();
  const { challenge, timestamp } = challengeBody.data;

  // 2. Create signature message — shared source of truth
  const message = createSignatureMessage(challenge, timestamp);
  const messageHash = createHash('sha256').update(message).digest('hex');

  // 3. Create and sign NOSTR event using nostr-tools finalizeEvent
  const event = finalizeEvent(
    {
      kind: 1,
      created_at: Math.floor(timestamp / 1000),
      tags: [],
      content: messageHash,
    },
    privateKey
  );

  // 4. Authenticate with the backend
  const authRes = await request.post(`${baseUrl}/api/auth/authenticate`, {
    data: {
      nostr_pubkey: publicKey,
      challenge,
      timestamp,
      signature: event.sig,
      role,
    },
  });

  if (!authRes.ok()) {
    throw new Error(`Auth request failed: ${authRes.status()} ${await authRes.text()}`);
  }

  const authBody = await authRes.json();
  if (!authBody.success || !authBody.data?.token) {
    throw new Error(`Auth failed: ${JSON.stringify(authBody)}`);
  }

  return authBody.data.token;
}
