# 180 - P2 - Frontend nostr-tools/nip19 Mock Structure Mismatch

## Priority: P2 (Important)

## Source
PR #83 — Review Agent: pattern-recognition-specialist

## Description

In `packages/frontend/src/test-utils/mocks.ts:512-516`, the mock for `nostr-tools/nip19` has a nested structure that doesn't match the actual module:

```typescript
jest.mock('nostr-tools/nip19', () => ({
  nip19: {
    encode: jest.fn().mockImplementation((prefix: string) => `${prefix}1test123456789`),
    decode: jest.fn().mockImplementation(() => ({ type: 'npub', data: 'decoded-data' })),
  },
}));
```

The actual `nostr-tools/nip19` module exports functions at the top level (`npubEncode`, `npubDecode`, `nsecEncode`, `nprofileEncode`, etc.), NOT nested under a `nip19` key.

Code importing `import * as nip19 from 'nostr-tools/nip19'` would see `nip19.nip19.encode` instead of `nip19.npubEncode`. This mock will cause tests to pass with incorrect behavior if they ever actually use the nip19 functions.

## Files

- `packages/frontend/src/test-utils/mocks.ts:512-516` (incorrect mock)
- Real module: `nostr-tools/nip19` exports top-level functions

## Fix

```typescript
jest.mock('nostr-tools/nip19', () => ({
  npubEncode: jest.fn().mockImplementation((hex: string) => `npub1${hex.slice(0, 20)}`),
  npubDecode: jest.fn().mockReturnValue({ type: 'npub', data: 'decoded-data' }),
  nsecEncode: jest.fn().mockImplementation((hex: string) => `nsec1${hex.slice(0, 20)}`),
  nprofileEncode: jest.fn(),
  decode: jest.fn().mockImplementation(() => ({ type: 'npub', data: 'decoded-data' })),
}));
```

## Impact
Testing — mock structure doesn't match real module; tests may pass incorrectly.
