# US-305: NIP-04 Encrypted DMs - Quick Reference

## Service Import
```typescript
import { nip04Service, keyManagementService } from '@services/nostr';
```

## Initialization
```typescript
await keyManagementService.initialize();
await nip04Service.initialize(keyManagementService);
```

## Basic Usage

### Encrypt Message
```typescript
const encrypted = await nip04Service.encrypt(
  'Secret message',
  recipientPublicKey
);
// Result: "base64encrypted?iv=base64iv"
```

### Decrypt Message
```typescript
const decrypted = await nip04Service.decrypt(
  encryptedContent,
  senderPublicKey
);
```

### Create DM Event
```typescript
const dmEvent = await nip04Service.createDMEvent(
  'Hello!',
  recipientPublicKey,
  { sign: true }
);
// Result: kind 4 event ready to publish
```

## Thread Management

### Get Thread
```typescript
const messages = await nip04Service.getThread(myPubkey, friendPubkey);
```

### Add Message
```typescript
await nip04Service.addMessageToThread({
  id: event.id,
  from: event.pubkey,
  to: myPublicKey,
  content: event.content,
  timestamp: event.created_at * 1000,
  decrypted: decryptedContent
});
```

### Mark as Read
```typescript
await nip04Service.markAsRead(myPubkey, friendPubkey);
```

### Get Unread Count
```typescript
const count = await nip04Service.getUnreadCount(myPubkey, friendPubkey);
```

## Browser Extension Support

### Encrypt with Extension
```typescript
const encrypted = await nip04Service.encryptWithExtension(
  message,
  recipientPublicKey
);
```

### Decrypt with Extension
```typescript
const decrypted = await nip04Service.decryptWithExtension(
  encryptedContent,
  senderPublicKey
);
```

### Fallback Pattern
```typescript
const encrypted = await nip04Service.encrypt(message, recipientPubkey, {
  useExtension: true,
  fallbackToNative: true
});
```

## Thread ID
```typescript
// Deterministic thread ID (same regardless of order)
const threadId = nip04Service.getThreadId(pubkey1, pubkey2);
```

## Key Features
- ✅ NIP-04 compliant encryption
- ✅ Browser extension support (NIP-07)
- ✅ Thread management with read/unread tracking
- ✅ Unicode and emoji support
- ✅ Secure key handling (no logging)
- ✅ Integration with KeyManagementService

## Files Created
- `/packages/frontend/src/services/nostr/NIP04Service.ts` (346 lines)
- `/packages/frontend/src/services/nostr/__tests__/NIP04Service.test.ts` (711 lines)

## Performance
- Encryption: < 100ms
- Decryption: < 100ms
- Batch (10 messages): < 500ms
