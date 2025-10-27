# US-310: NIP-19 Encoding Utilities - Quick Reference

**Status**: ✅ COMPLETE (9/9) | **Version**: 1.0.0 | **Date**: 2025-10-26

---

## 🚀 Quick Start

```typescript
import { nip19Service } from '@/services/nostr/NIP19Service';

// Encode
const npub = nip19Service.encodePubkey('3bf0c63fcb93...');

// Decode
const decoded = nip19Service.decode(npub);
```

---

## 📖 Entity Types (All 7 Supported)

| Entity | Prefix | Input | Use Case |
|--------|--------|-------|----------|
| npub | `npub1` | Hex pubkey (64 chars) | User profiles, follows |
| nsec | `nsec1` | Hex privkey (64 chars) | Private key backup |
| note | `note1` | Hex event ID (64 chars) | Event references |
| nprofile | `nprofile1` | Pubkey + relays | Profile with hints |
| nevent | `nevent1` | Event ID + metadata | Event with context |
| nrelay | `nrelay1` | wss:// URL | Relay references |
| naddr | `naddr1` | Kind + pubkey + identifier | Replaceable events |

---

## 🔧 Common Operations

### Simple Encoding

```typescript
// Public key
const npub = nip19Service.encodePubkey(hexPubkey);

// Private key (secure)
const nsec = nip19Service.encodePrivkey(hexPrivkey);

// Event ID
const note = nip19Service.encodeNote(eventId);

// Relay URL
const nrelay = nip19Service.encodeRelay('wss://relay.damus.io');
```

### Complex Encoding

```typescript
// Profile with relays
const nprofile = nip19Service.encodeProfile({
  pubkey: hexPubkey,
  relays: ['wss://relay.damus.io']
});

// Event with context
const nevent = nip19Service.encodeEvent({
  id: eventId,
  relays: ['wss://relay.damus.io'],
  author: hexPubkey,
  kind: 1
});

// Replaceable event address
const naddr = nip19Service.encodeAddress({
  kind: 30023,  // Must be 30000-39999
  pubkey: hexPubkey,
  identifier: 'article-slug',
  relays: ['wss://relay.nostr.band']
});
```

### Decoding

```typescript
// Single decode (auto-detects type)
const decoded = nip19Service.decode(nip19String);

// Check type
if (decoded.type === 'npub') {
  console.log('Pubkey:', decoded.data);
} else if (decoded.type === 'nprofile') {
  console.log('Pubkey:', decoded.data.pubkey);
  console.log('Relays:', decoded.data.relays);
}
```

### Batch Operations

```typescript
// Encode many at once
const encoded = nip19Service.encodeBatch([
  { type: 'npub', data: pubkey1 },
  { type: 'npub', data: pubkey2 },
  { type: 'note', data: eventId }
]);

// Decode many at once
const decoded = nip19Service.decodeBatch([npub1, npub2, note1]);
```

---

## ⚠️ Error Handling

```typescript
import { ValidationError, InvalidEncodingError } from '@/services/nostr/NIP19Service';

try {
  const npub = nip19Service.encodePubkey(input);
} catch (error) {
  if (error instanceof ValidationError) {
    // Invalid input format
    console.error('Field:', error.context?.fieldName);
    console.error('Expected:', error.context?.expectedFormat);
  } else if (error instanceof InvalidEncodingError) {
    // Malformed bech32
    console.error('Bad encoding:', error.message);
  }
}
```

### Error Types

| Error | Code | When Thrown |
|-------|------|-------------|
| `ValidationError` | `VALIDATION_ERROR` | Invalid input format |
| `InvalidPrefixError` | `INVALID_PREFIX` | Unknown NIP-19 prefix |
| `InvalidEncodingError` | `INVALID_ENCODING` | Malformed bech32 |
| `InvalidChecksumError` | `INVALID_CHECKSUM` | Corrupted data |
| `MalformedDataError` | `MALFORMED_DATA` | Entity-specific failure |

---

## 🔍 Validation

```typescript
// Check hex format (64 chars, hex)
nip19Service.validateHex(pubkey); // true/false

// Check relay URL (must be wss://)
nip19Service.validateRelayUrl(url); // true/false

// Check bech32 format
nip19Service.isValidBech32(string); // true/false

// Check NIP-19 identifier
nip19Service.isValidNIP19(string); // true/false

// Detect entity type
const type = nip19Service.detectEntityType('npub1...'); // 'npub'
```

---

## 🛠️ Helper Utilities

```typescript
// Format for UI display
const short = nip19Service.formatForDisplay(npub, 16);
// npub1809rv0yj...wsa9yjfr

// Copy to clipboard
await nip19Service.copyToClipboard(npub);

// Generate QR code
const qrDataUrl = nip19Service.generateQRCode(npub, { size: 256 });
// Use in <img src={qrDataUrl} />
```

---

## ⚡ Performance Tips

1. **Use batch operations** for multiple items
2. **Cache decoded results** if reused
3. **Validate before encoding** to avoid errors
4. **Use formatForDisplay** for UI (don't decode full string)

---

## 🔐 Security

- ✅ nsec automatically sanitized from errors
- ✅ No private keys in logs/stack traces
- ✅ Validation at every layer
- ✅ Safe error messages

**Never log nsec values!**

```typescript
// Good
console.log('Key:', nip19Service.formatForDisplay(nsec));

// Bad
console.log('Key:', nsec); // NEVER
```

---

## 📊 Validation Rules

### Hex Strings
- Exactly 64 characters
- Characters: `0-9`, `a-f`, `A-F`
- Case-insensitive

### Relay URLs
- Must start with `wss://`
- Valid URL format
- Can include path and query params

### Address Kinds
- Range: 30000-39999 (parameterized replaceable)
- Must be integer

### Identifiers
- Non-empty string
- Any characters allowed

---

## 🧪 Test Coverage

- ✅ 100+ comprehensive tests
- ✅ All 7 entity types
- ✅ All 5 error types
- ✅ Batch operations
- ✅ Edge cases
- ✅ Security tests
- ✅ Performance benchmarks

---

## 📦 Files

**Service**: `/packages/frontend/src/services/nostr/NIP19Service.ts`
**Tests**: `/packages/frontend/src/services/nostr/__tests__/NIP19Service.test.ts`
**Docs**: `/US-310-NIP19-IMPLEMENTATION-COMPLETE.md`

---

## 📚 Additional Resources

- [NIP-19 Specification](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [Bech32 Encoding](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki)
- [NOSTR Protocol](https://nostr.com)

---

**Last Updated**: 2025-10-26 | **Version**: 1.0.0 | **Status**: Production Ready
