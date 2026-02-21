---
id: 428
severity: P2
status: deferred
title: "NostrKeyManagement: mnemonic backup cannot recover the private key"
file: packages/shared/src/services/NostrKeyManagementService.ts
found_in: PR #89
reviewer: review-security
---

# Mnemonic backup is independent of private key - recovery depends on storage

## Problem

The DESIGN NOTE (lines 737-742) correctly documents that the mnemonic is generated independently and is NOT derived from the private key. However, the implications are:

1. **Users cannot recover their NOSTR private key from the mnemonic alone.** This contradicts the UX expectation of "write down your 24 words to recover your key" that users are familiar with from Bitcoin wallets.

2. **The mnemonic serves as a "second factor" for recovery**, but recovery still requires the encrypted private key from storage. If the storage (IndexedDB, device) is lost, the mnemonic alone is useless.

3. **The `createBackup` method name is misleading.** It creates a mnemonic that cannot actually back up the key.

The design note was added in this PR, which is good documentation. But the fundamental design decision should be validated.

## Location

```
packages/shared/src/services/NostrKeyManagementService.ts  lines 737-775 (createMnemonicBackup)
```

## Options

**Option A (Recommended - Document clearly):** The current approach is intentional. Add user-facing documentation explaining that the mnemonic is a second authentication factor, NOT a full key backup. Update method name from `createBackup` to `createRecoveryFactor` or similar.

**Option B (BIP-340 derivation):** Derive the NOSTR private key from the mnemonic using BIP-340/BIP-32, so the mnemonic CAN reconstruct the key. This is the standard in Bitcoin/NOSTR ecosystems. Would require:
```typescript
import { mnemonicToSeedSync } from 'bip39';
import { HDKey } from '@scure/bip32';

const seed = mnemonicToSeedSync(mnemonic);
const hdkey = HDKey.fromMasterSeed(seed);
const child = hdkey.derive("m/44'/1237'/0'/0/0"); // NIP-06 derivation path
const privateKey = child.privateKey;
```

## Severity Justification

P2: Not a vulnerability but a UX/design issue. Users may lose their NOSTR identity if they assume the mnemonic can recover their key. The documentation added in this PR mitigates this from a code-review perspective, but the user-facing implications remain.

## Verification

Check if any UI component displays the mnemonic with "backup" or "recovery" language. If so, update the copy to reflect the actual capability.
