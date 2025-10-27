# US-315: Key Management Service - Quick Reference

**Status**: ✅ COMPLETE
**Story**: Centralized NOSTR Key Management
**File**: `/packages/frontend/src/services/nostr/KeyManagementService.ts`

---

## Quick Start

```typescript
import { keyManagementService } from '@/services/nostr';

// Initialize service
await keyManagementService.initialize();

// Generate new key
const keyPair = await keyManagementService.generateKeyPair({
  name: 'My Key',
  description: 'Primary identity',
});

// Sign event
const event = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: 'Hello NOSTR!',
  pubkey: keyPair.publicKey,
};

const signed = await keyManagementService.signEvent(keyPair.keyId, event);
```

---

## Core Methods

### Initialization
```typescript
await keyManagementService.initialize(config?: Partial<NostrKeyManagementConfig>);
```

### Key Generation
```typescript
const keyPair = await keyManagementService.generateKeyPair(metadata?: {
  name?: string;
  description?: string;
  tags?: string[];
});
```

### Key Import
```typescript
// Import from nsec
const imported = await keyManagementService.importKey(
  'nsec1...',
  'nsec',
  { name: 'Imported Key' }
);

// Import from hex
const imported = await keyManagementService.importKey(
  '67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa',
  'hex'
);
```

### Key Export
```typescript
// Export as nsec (private key - WARNING logged)
const nsec = await keyManagementService.exportKey(keyId, 'nsec');

// Export as hex (private key - WARNING logged)
const hex = await keyManagementService.exportKey(keyId, 'hex');

// Export as npub (public key only - SAFE)
const npub = await keyManagementService.exportKey(keyId, 'npub');
```

### Event Signing
```typescript
// Sign with local key
const signed = await keyManagementService.signEvent(keyId, event);

// Sign with browser extension
const signed = await keyManagementService.signEvent('extension', event);

// Verify signature
const isValid = await keyManagementService.verifyEventSignature(signed);
```

### Browser Extension
```typescript
// Detect extension
const detected = await keyManagementService.detectBrowserExtension();

// Connect to extension
const extension = await keyManagementService.connectBrowserExtension();

if (extension.enabled) {
  // Use extension for signing
  const signed = await keyManagementService.signEvent('extension', event);
}
```

### Key Management
```typescript
// List all keys
const keys = await keyManagementService.listKeys();

// Get specific key
const key = await keyManagementService.getKey(keyId);

// Get active key
const activeKey = keyManagementService.getActiveKey();

// Set active key
await keyManagementService.setActiveKey(keyId);

// Delete key
await keyManagementService.deleteKey(keyId);

// Clear session cache
await keyManagementService.clearSession();
```

### Key Validation
```typescript
// Validate key integrity
const validation = await keyManagementService.validateKey(keyId);

console.log('Valid:', validation.valid);
console.log('Security Score:', validation.securityScore);
console.log('Issues:', validation.issues);
console.log('Recommendations:', validation.recommendations);

// Validate key format
const isValidNsec = keyManagementService.validateKeyFormat('nsec1...', 'nsec');
const isValidHex = keyManagementService.validateKeyFormat('67dea2...', 'hex');
```

### Security Features
```typescript
// Set encryption password
await keyManagementService.setEncryptionPassword('secure-password');

// Mark key as compromised
await keyManagementService.markKeyAsCompromised(keyId, 'Reason for compromise');

// Update security level
await keyManagementService.updateSecurityLevel(keyId, 'maximum');
```

---

## Configuration Options

```typescript
const config: NostrKeyManagementConfig = {
  // Storage
  defaultStorageType: 'indexed_db',
  encryptionEnabled: true,
  compressionEnabled: false,

  // Security
  defaultSecurityLevel: 'enhanced', // 'basic' | 'enhanced' | 'maximum'
  enforceHardwareWallets: false,
  requireMultiFactor: false,

  // Backup
  autoBackupEnabled: true,
  defaultBackupMethod: 'mnemonic_phrase',
  backupVerificationRequired: true,

  // Rotation
  autoRotationEnabled: false,
  defaultRotationInterval: 7776000000, // 90 days in ms
  compromiseRotationEnabled: true,

  // Monitoring
  usageAnalyticsEnabled: true,
  securityMonitoringEnabled: true,
  anomalyDetectionEnabled: true,

  // Performance
  cacheSize: 100,
  cacheTtl: 3600000, // 1 hour
  maxConcurrentOperations: 10,
};
```

---

## Key Pair Structure

```typescript
interface NostrEnhancedKeyPair {
  // Core Keys
  privateKey: string;        // 64-char hex
  publicKey: string;         // 64-char hex
  npub: string;              // bech32 encoded public key
  nsec: string;              // bech32 encoded private key

  // Metadata
  keyId: string;             // UUID
  created: number;           // Timestamp
  lastUsed?: number;         // Timestamp
  name?: string;
  description?: string;
  tags: string[];

  // Security
  entropySource: NostrEntropySource;
  entropyBits: number;       // ≥128
  encrypted: boolean;
  securityLevel: 'basic' | 'enhanced' | 'maximum';
  compromised: boolean;
  compromiseReason?: string;

  // Storage
  storageType: NostrKeyStorageType;
  backedUp: boolean;
  backupVerified: boolean;

  // Usage
  signatureCount: number;
  lastRotated?: number;
}
```

---

## Security Best Practices

### ✅ DO:
- ✅ Initialize service once at app startup
- ✅ Use browser extensions when available
- ✅ Enable encryption for all keys
- ✅ Create backups of important keys
- ✅ Validate keys before use
- ✅ Export public keys (npub) freely
- ✅ Use session cache for performance
- ✅ Mark compromised keys immediately

### ❌ DON'T:
- ❌ Store private keys in localStorage
- ❌ Log private keys (nsec/hex)
- ❌ Share private keys over insecure channels
- ❌ Use compromised keys
- ❌ Export private keys unless necessary
- ❌ Store unencrypted keys
- ❌ Ignore validation errors

---

## Error Handling

```typescript
try {
  const keyPair = await keyManagementService.generateKeyPair();
} catch (error) {
  if (error.message.includes('Insufficient entropy')) {
    // Handle low entropy
  } else if (error.message.includes('Storage quota exceeded')) {
    // Handle storage issues
  } else {
    // Handle other errors
  }
}
```

---

## Performance Tips

1. **Use Session Cache**: Active keys are cached for instant retrieval
2. **Batch Operations**: Import multiple keys at once if needed
3. **Lazy Loading**: Only load keys when needed
4. **Extension Signing**: Use browser extensions for better UX
5. **Concurrent Limit**: Max 10 concurrent operations (configurable)

---

## Testing

```typescript
import { KeyManagementService } from '@/services/nostr';

describe('My Feature', () => {
  let service: KeyManagementService;

  beforeEach(async () => {
    service = KeyManagementService.getInstance();
    await service.initialize();
  });

  afterEach(async () => {
    await service.destroy();
  });

  it('should sign events', async () => {
    const keyPair = await service.generateKeyPair();
    const event = { /* ... */ };
    const signed = await service.signEvent(keyPair.keyId, event);

    expect(signed.sig).toHaveLength(128);
  });
});
```

---

## Troubleshooting

### "Key not found"
- Ensure key was generated/imported successfully
- Check keyId is correct
- Verify service is initialized

### "Insufficient entropy"
- Browser crypto API not available
- Try again (entropy collection is random)
- Check browser compatibility

### "Storage quota exceeded"
- Clear old keys with `deleteKey()`
- Reduce cache size in config
- Check browser storage settings

### "Key marked as compromised"
- Cannot use compromised keys
- Generate new key
- Migrate to new key

### Extension not detected
- Ensure browser extension is installed
- Check window.nostr is available
- Try connecting manually

---

## File Locations

- **Service**: `/packages/frontend/src/services/nostr/KeyManagementService.ts`
- **Tests**: `/packages/frontend/src/services/nostr/__tests__/KeyManagementService.test.ts`
- **Types**: `/packages/shared/src/types/nostr-key-management.ts` (US-308)
- **Exports**: `/packages/frontend/src/services/nostr/index.ts`
- **Docs**: `/docs/implementation-summaries/US-315-KEY-MANAGEMENT-SERVICE-COMPLETE.md`

---

## Related Stories

- **US-308**: NOSTR Type Consolidation (provides types)
- **US-316**: Event Publishing (consumes signing)
- **US-317**: Relay Management (uses keys)
- **US-318**: Profile Management (uses identity)

---

**Last Updated**: 2025-10-26
**Version**: 1.0.0
**Status**: Production Ready
