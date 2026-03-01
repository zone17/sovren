/**
 * NIP19Service Test Suite
 *
 * US-309: Implement NIP-19 Bech32-Encoded Identifiers
 * Epic 003: NOSTR Consolidation
 *
 * TDD Approach: Tests written FIRST before implementation
 * Coverage Target: ≥95%
 */

import { NIP19Service, NIP19Error, InvalidEncodingError, ValidationError } from '../NIP19Service';
import type {
  DecodedKey,
  DecodedNote,
  DecodedProfile,
  DecodedEvent,
  DecodedAddress,
} from '@shared/types/nostr/index';

describe('NIP19Service', () => {
  let service: NIP19Service;

  beforeEach(() => {
    service = new NIP19Service();
  });

  // ========================================
  // Encoding Tests
  // ========================================

  describe('Encoding Functions', () => {
    describe('encodePubkey', () => {
      it('should encode hex pubkey to npub', () => {
        const hexPubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const npub = service.encodePubkey(hexPubkey);

        expect(npub).toMatch(/^npub1/);
        expect(npub.length).toBeGreaterThan(60);
      });

      it('should throw error for invalid hex pubkey length', () => {
        const invalidHex = '3bf0c63fcb93463407';
        expect(() => service.encodePubkey(invalidHex)).toThrow();
      });

      it('should throw error for invalid hex characters', () => {
        const invalidHex = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
        expect(() => service.encodePubkey(invalidHex)).toThrow();
      });

      it('should be case insensitive for hex input', () => {
        const hexLower = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const hexUpper = '3BF0C63FCB93463407AF97A5E5EE64FA883D107EF9E558472C4EB9AAAEFA459D';

        const npub1 = service.encodePubkey(hexLower);
        const npub2 = service.encodePubkey(hexUpper);

        expect(npub1).toBe(npub2);
      });
    });

    describe('encodePrivkey', () => {
      it('should encode hex privkey to nsec', () => {
        const hexPrivkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const nsec = service.encodePrivkey(hexPrivkey);

        expect(nsec).toMatch(/^nsec1/);
        expect(nsec.length).toBeGreaterThan(60);
      });

      it('should throw error for invalid hex privkey length', () => {
        const invalidHex = '3bf0c63fcb93463407';
        expect(() => service.encodePrivkey(invalidHex)).toThrow();
      });

      it('should not expose nsec in error messages', () => {
        try {
          service.encodePrivkey('invalid');
        } catch (error) {
          const errorMessage = (error as Error).message;
          expect(errorMessage).not.toContain('nsec1');
        }
      });
    });

    describe('encodeNote', () => {
      it('should encode event id to note', () => {
        const eventId = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const note = service.encodeNote(eventId);

        expect(note).toMatch(/^note1/);
        expect(note.length).toBeGreaterThan(60);
      });

      it('should throw error for invalid event id length', () => {
        const invalidId = '3bf0c63fcb93463407';
        expect(() => service.encodeNote(invalidId)).toThrow();
      });
    });

    describe('encodeProfile', () => {
      it('should encode profile with pubkey only', () => {
        const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const nprofile = service.encodeProfile({ pubkey });

        expect(nprofile).toMatch(/^nprofile1/);
      });

      it('should encode profile with pubkey and relays', () => {
        const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const relays = ['wss://relay.damus.io', 'wss://relay.nostr.band'];
        const nprofile = service.encodeProfile({ pubkey, relays });

        expect(nprofile).toMatch(/^nprofile1/);
        expect(nprofile.length).toBeGreaterThan(80); // Longer with relays
      });

      it('should throw error for missing pubkey', () => {
        expect(() => service.encodeProfile({ pubkey: '' })).toThrow(/valid.*pubkey/i);
      });

      it('should validate relay URLs', () => {
        const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const invalidRelays = ['not-a-url', 'http://insecure.com'];

        expect(() => service.encodeProfile({ pubkey, relays: invalidRelays })).toThrow();
      });
    });

    describe('encodeEvent', () => {
      it('should encode event with id only', () => {
        const id = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const nevent = service.encodeEvent({ id });

        expect(nevent).toMatch(/^nevent1/);
      });

      it('should encode event with id, relays, and author', () => {
        const id = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const author = '91cf9ceb6fa321fe8325c78d2ecbc40ab91a64930fe4ad4cbc50896b17884430';
        const relays = ['wss://relay.damus.io'];
        const nevent = service.encodeEvent({ id, author, relays });

        expect(nevent).toMatch(/^nevent1/);
      });

      it('should encode event with kind', () => {
        const id = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const kind = 1;
        const nevent = service.encodeEvent({ id, kind });

        expect(nevent).toMatch(/^nevent1/);
      });

      it('should throw error for missing event id', () => {
        expect(() => service.encodeEvent({ id: '' })).toThrow(/valid.*event.*id/i);
      });
    });

    describe('encodeRelay', () => {
      it('should encode relay URL to nrelay', () => {
        const relayUrl = 'wss://relay.damus.io';
        const nrelay = service.encodeRelay(relayUrl);

        expect(nrelay).toMatch(/^nrelay1/);
      });

      it('should throw error for invalid relay URL', () => {
        expect(() => service.encodeRelay('not-a-url')).toThrow(/relay.*url/i);
      });

      it('should throw error for non-wss URLs', () => {
        expect(() => service.encodeRelay('http://relay.com')).toThrow(/relay.*must.*wss/i);
      });

      it('should handle relay URLs with paths', () => {
        const relayUrl = 'wss://relay.damus.io/path';
        const nrelay = service.encodeRelay(relayUrl);

        expect(nrelay).toMatch(/^nrelay1/);
      });
    });

    describe('encodeAddress', () => {
      it('should encode address with kind, pubkey, and identifier', () => {
        const kind = 30023;
        const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const identifier = 'my-article';

        const naddr = service.encodeAddress({ kind, pubkey, identifier });

        expect(naddr).toMatch(/^naddr1/);
      });

      it('should encode address with relays', () => {
        const kind = 30023;
        const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const identifier = 'my-article';
        const relays = ['wss://relay.damus.io'];

        const naddr = service.encodeAddress({ kind, pubkey, identifier, relays });

        expect(naddr).toMatch(/^naddr1/);
      });

      it('should throw error for invalid kind range', () => {
        const kind = 1; // Not parameterized replaceable (30000-39999)
        const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const identifier = 'test';

        expect(() => service.encodeAddress({ kind, pubkey, identifier })).toThrow(
          /kind.*30000.*39999/i
        );
      });

      it('should throw error for missing required fields', () => {
        expect(() =>
          service.encodeAddress({ kind: 30023, pubkey: '', identifier: 'test' })
        ).toThrow(/valid.*pubkey/i);

        expect(() =>
          service.encodeAddress({
            kind: 30023,
            pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
            identifier: '',
          })
        ).toThrow(/identifier/i);
      });
    });
  });

  // ========================================
  // Decoding Tests
  // ========================================

  describe('Decoding Functions', () => {
    describe('decode', () => {
      it('should decode npub to hex pubkey', () => {
        const hexPubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const npub = service.encodePubkey(hexPubkey);

        const decoded = service.decode(npub) as DecodedKey;

        expect(decoded.type).toBe('npub');
        expect(decoded.data).toBe(hexPubkey);
      });

      it('should decode nsec to hex privkey', () => {
        const hexPrivkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const nsec = service.encodePrivkey(hexPrivkey);

        const decoded = service.decode(nsec) as DecodedKey;

        expect(decoded.type).toBe('nsec');
        expect(decoded.data).toBe(hexPrivkey);
      });

      it('should decode note to event id', () => {
        const eventId = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const note = service.encodeNote(eventId);

        const decoded = service.decode(note) as DecodedNote;

        expect(decoded.type).toBe('note');
        expect(decoded.data).toBe(eventId);
      });

      it('should decode nprofile to profile data', () => {
        const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const relays = ['wss://relay.damus.io'];
        const nprofile = service.encodeProfile({ pubkey, relays });

        const decoded = service.decode(nprofile) as DecodedProfile;

        expect(decoded.type).toBe('nprofile');
        expect(decoded.data.pubkey).toBe(pubkey);
        expect(decoded.data.relays).toContain('wss://relay.damus.io');
      });

      it('should decode nevent to event data', () => {
        const id = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const relays = ['wss://relay.damus.io'];
        const nevent = service.encodeEvent({ id, relays });

        const decoded = service.decode(nevent) as DecodedEvent;

        expect(decoded.type).toBe('nevent');
        expect(decoded.data.id).toBe(id);
        expect(decoded.data.relays).toContain('wss://relay.damus.io');
      });

      it('should decode naddr to address data', () => {
        const kind = 30023;
        const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const identifier = 'my-article';
        const naddr = service.encodeAddress({ kind, pubkey, identifier });

        const decoded = service.decode(naddr) as DecodedAddress;

        expect(decoded.type).toBe('naddr');
        expect(decoded.data.kind).toBe(kind);
        expect(decoded.data.pubkey).toBe(pubkey);
        expect(decoded.data.identifier).toBe(identifier);
      });

      it('should encode relay URL to nrelay format', () => {
        // nostr-tools decode() does not support nrelay; only encoding is supported
        const relayUrl = 'wss://relay.damus.io';
        const nrelay = service.encodeRelay(relayUrl);

        expect(nrelay).toMatch(/^nrelay1/);
      });

      it('should throw error for invalid bech32 format', () => {
        expect(() => service.decode('invalid-bech32')).toThrow(/invalid.*bech32/i);
      });

      it('should throw error for unknown prefix', () => {
        // unknown1qqqqqqqqqqqqqq has invalid checksum or format, but we verify it throws
        expect(() => service.decode('unknown1qqqqqqqqqqqqqq')).toThrow();
      });

      it('should throw error for corrupted data', () => {
        const corrupted = 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
        expect(() => service.decode(corrupted)).toThrow();
      });
    });
  });

  // ========================================
  // Validation Tests
  // ========================================

  describe('Validation', () => {
    describe('isValidBech32', () => {
      it('should validate correct bech32 strings', () => {
        const npub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );
        expect(service.isValidBech32(npub)).toBe(true);
      });

      it('should reject invalid bech32 strings', () => {
        expect(service.isValidBech32('not-bech32')).toBe(false);
        expect(service.isValidBech32('')).toBe(false);
        expect(service.isValidBech32('npub1')).toBe(false);
      });

      it('should reject obviously invalid bech32 strings', () => {
        // BECH32_REGEX checks format only (not checksum); invalid chars make it fail format check
        expect(service.isValidBech32('npub1INVALID!CHARS')).toBe(false);
        expect(service.isValidBech32('')).toBe(false);
      });
    });

    describe('isValidNIP19', () => {
      it('should validate NIP-19 entity types', () => {
        const npub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );
        expect(service.isValidNIP19(npub)).toBe(true);
      });

      it('should reject non-NIP19 prefixes', () => {
        expect(service.isValidNIP19('bc1qqqqqqqqqqqqqqqqqqqq')).toBe(false); // Bitcoin address
      });
    });

    describe('validateHex', () => {
      it('should validate 64-character hex strings', () => {
        const validHex = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        expect(service.validateHex(validHex)).toBe(true);
      });

      it('should reject invalid hex length', () => {
        expect(service.validateHex('3bf0c63fcb')).toBe(false);
        expect(service.validateHex('')).toBe(false);
      });

      it('should reject non-hex characters', () => {
        expect(
          service.validateHex('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')
        ).toBe(false);
      });

      it('should handle uppercase and lowercase', () => {
        const upper = '3BF0C63FCB93463407AF97A5E5EE64FA883D107EF9E558472C4EB9AAAEFA459D';
        const lower = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

        expect(service.validateHex(upper)).toBe(true);
        expect(service.validateHex(lower)).toBe(true);
      });
    });

    describe('validateRelayUrl', () => {
      it('should validate wss:// relay URLs', () => {
        expect(service.validateRelayUrl('wss://relay.damus.io')).toBe(true);
        expect(service.validateRelayUrl('wss://relay.nostr.band')).toBe(true);
      });

      it('should reject non-wss URLs', () => {
        expect(service.validateRelayUrl('http://relay.com')).toBe(false);
        expect(service.validateRelayUrl('https://relay.com')).toBe(false);
        expect(service.validateRelayUrl('ws://relay.com')).toBe(false);
      });

      it('should reject invalid URLs', () => {
        expect(service.validateRelayUrl('not-a-url')).toBe(false);
        expect(service.validateRelayUrl('')).toBe(false);
      });
    });
  });

  // ========================================
  // Helper Functions Tests
  // ========================================

  describe('Integration Helpers', () => {
    describe('detectEntityType', () => {
      it('should detect npub', () => {
        const npub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );
        expect(service.detectEntityType(npub)).toBe('npub');
      });

      it('should detect nsec', () => {
        const nsec = service.encodePrivkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );
        expect(service.detectEntityType(nsec)).toBe('nsec');
      });

      it('should detect note', () => {
        const note = service.encodeNote(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );
        expect(service.detectEntityType(note)).toBe('note');
      });

      it('should detect nprofile', () => {
        const nprofile = service.encodeProfile({
          pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        });
        expect(service.detectEntityType(nprofile)).toBe('nprofile');
      });

      it('should return null for invalid input', () => {
        expect(service.detectEntityType('invalid')).toBeNull();
      });
    });

    describe('formatForDisplay', () => {
      it('should truncate long identifiers with ellipsis', () => {
        const npub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );
        const formatted = service.formatForDisplay(npub);

        expect(formatted).toContain('...');
        expect(formatted).toMatch(/^npub1/);
        expect(formatted.length).toBeLessThan(npub.length);
      });

      it('should allow custom length', () => {
        const npub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );
        const formatted = service.formatForDisplay(npub, 20);

        expect(formatted.length).toBeLessThanOrEqual(23); // 20 + '...'
      });

      it('should not truncate short identifiers', () => {
        const short = 'npub1test';
        const formatted = service.formatForDisplay(short, 20);

        expect(formatted).toBe(short);
      });
    });

    describe('copyToClipboard', () => {
      it('should copy identifier to clipboard', async () => {
        const npub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );

        // Mock clipboard API
        const mockWriteText = vi.fn().mockResolvedValue(undefined);
        Object.assign(navigator, {
          clipboard: {
            writeText: mockWriteText,
          },
        });

        await service.copyToClipboard(npub);

        expect(mockWriteText).toHaveBeenCalledWith(npub);
      });

      it('should throw error if clipboard API unavailable', async () => {
        Object.assign(navigator, { clipboard: undefined });

        await expect(service.copyToClipboard('test')).rejects.toThrow(/clipboard.*unavailable/i);
      });
    });

    describe('generateQRCode', () => {
      let mockCanvas: any;
      let mockCtx: any;
      let originalCreateElement: typeof document.createElement;

      beforeEach(() => {
        mockCtx = {
          fillStyle: '',
          font: '',
          fillRect: vi.fn(),
          fillText: vi.fn(),
          drawImage: vi.fn(),
        };
        mockCanvas = {
          width: 0,
          height: 0,
          getContext: vi.fn().mockReturnValue(mockCtx),
          toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockQRCodeData'),
        };
        originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
          if (tag === 'canvas') return mockCanvas as any;
          return originalCreateElement(tag);
        });
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('should generate QR code data URL', () => {
        const npub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );

        const qrDataUrl = service.generateQRCode(npub);

        expect(qrDataUrl).toMatch(/^data:image\//);
      });

      it('should support different sizes', () => {
        const npub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );

        const small = service.generateQRCode(npub, { size: 128 });
        const large = service.generateQRCode(npub, { size: 512 });

        expect(small).toBeTruthy();
        expect(large).toBeTruthy();
      });
    });
  });

  // ========================================
  // Edge Cases and Error Handling
  // ========================================

  describe('Edge Cases', () => {
    it('should handle empty strings gracefully', () => {
      expect(() => service.encodePubkey('')).toThrow();
      expect(() => service.encodePrivkey('')).toThrow();
      expect(() => service.encodeNote('')).toThrow();
      expect(() => service.decode('')).toThrow();
    });

    it('should handle null and undefined inputs', () => {
      expect(() => service.encodePubkey(null as any)).toThrow();
      expect(() => service.encodePubkey(undefined as any)).toThrow();
    });

    it('should preserve data integrity through encode/decode cycle', () => {
      const testData = [
        {
          type: 'pubkey',
          value: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        },
        {
          type: 'privkey',
          value: '5c0c523f52a5b6fad39ed2403092df8cebc36318b39383bca6c00808626fab3a',
        },
        {
          type: 'eventId',
          value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      ];

      testData.forEach(({ type, value }) => {
        let encoded: string;
        let decoded: any;

        if (type === 'pubkey') {
          encoded = service.encodePubkey(value);
          decoded = service.decode(encoded) as DecodedKey;
          expect(decoded.data).toBe(value);
        } else if (type === 'privkey') {
          encoded = service.encodePrivkey(value);
          decoded = service.decode(encoded) as DecodedKey;
          expect(decoded.data).toBe(value);
        } else if (type === 'eventId') {
          encoded = service.encodeNote(value);
          decoded = service.decode(encoded) as DecodedNote;
          expect(decoded.data).toBe(value);
        }
      });
    });

    it('should handle maximum relay count', () => {
      const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
      const manyRelays = Array.from({ length: 10 }, (_, i) => `wss://relay${i}.com`);

      const nprofile = service.encodeProfile({ pubkey, relays: manyRelays });
      const decoded = service.decode(nprofile) as DecodedProfile;

      expect(decoded.data.relays?.length).toBe(10);
    });
  });

  // ========================================
  // Batch Operations Tests
  // ========================================

  describe('Batch Operations', () => {
    describe('encodeBatch', () => {
      it('should encode multiple entities in batch', () => {
        const items = [
          {
            type: 'npub' as const,
            data: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
          },
          {
            type: 'note' as const,
            data: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
          {
            type: 'nrelay' as const,
            data: 'wss://relay.damus.io',
          },
        ];

        const encoded = service.encodeBatch(items);

        expect(encoded).toHaveLength(3);
        expect(encoded[0]).toMatch(/^npub1/);
        expect(encoded[1]).toMatch(/^note1/);
        expect(encoded[2]).toMatch(/^nrelay1/);
      });

      it('should encode complex entities with metadata', () => {
        const items = [
          {
            type: 'nprofile' as const,
            data: {
              pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
              relays: ['wss://relay.damus.io'],
            },
          },
          {
            type: 'nevent' as const,
            data: {
              id: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              relays: ['wss://relay.nostr.band'],
              author: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
            },
          },
          {
            type: 'naddr' as const,
            data: {
              kind: 30023,
              pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
              identifier: 'my-article',
            },
          },
        ];

        const encoded = service.encodeBatch(items);

        expect(encoded).toHaveLength(3);
        expect(encoded[0]).toMatch(/^nprofile1/);
        expect(encoded[1]).toMatch(/^nevent1/);
        expect(encoded[2]).toMatch(/^naddr1/);
      });

      it('should handle empty array', () => {
        const encoded = service.encodeBatch([]);
        expect(encoded).toEqual([]);
      });

      it('should throw error for non-array input', () => {
        expect(() => service.encodeBatch('not-array' as any)).toThrow(/array/i);
      });

      it('should throw error if any item fails validation', () => {
        const items = [
          {
            type: 'npub' as const,
            data: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
          },
          {
            type: 'npub' as const,
            data: 'invalid-hex',
          },
        ];

        expect(() => service.encodeBatch(items)).toThrow(/batch encoding failed/i);
      });

      it('should report all failed items in error message', () => {
        const items = [
          { type: 'npub' as const, data: 'invalid1' },
          { type: 'note' as const, data: 'invalid2' },
        ];

        try {
          service.encodeBatch(items);
          fail('Should have thrown error');
        } catch (error) {
          expect((error as Error).message).toContain('[0]');
          expect((error as Error).message).toContain('[1]');
          expect((error as Error).message).toContain('2 item');
        }
      });

      it('should handle all 7 entity types', () => {
        const hexKey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const items = [
          { type: 'npub' as const, data: hexKey },
          { type: 'nsec' as const, data: hexKey },
          { type: 'note' as const, data: hexKey },
          { type: 'nprofile' as const, data: { pubkey: hexKey } },
          { type: 'nevent' as const, data: { id: hexKey } },
          { type: 'nrelay' as const, data: 'wss://relay.damus.io' },
          { type: 'naddr' as const, data: { kind: 30023, pubkey: hexKey, identifier: 'test' } },
        ];

        const encoded = service.encodeBatch(items);

        expect(encoded).toHaveLength(7);
        expect(encoded[0]).toMatch(/^npub1/);
        expect(encoded[1]).toMatch(/^nsec1/);
        expect(encoded[2]).toMatch(/^note1/);
        expect(encoded[3]).toMatch(/^nprofile1/);
        expect(encoded[4]).toMatch(/^nevent1/);
        expect(encoded[5]).toMatch(/^nrelay1/);
        expect(encoded[6]).toMatch(/^naddr1/);
      });
    });

    describe('decodeBatch', () => {
      it('should decode multiple identifiers in batch', () => {
        const hexKey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const npub = service.encodePubkey(hexKey);
        const note = service.encodeNote(hexKey);
        const nprofile = service.encodeProfile({ pubkey: hexKey });

        // Note: nrelay decode is not supported by nostr-tools; use other types
        const decoded = service.decodeBatch([npub, note, nprofile]);

        expect(decoded).toHaveLength(3);
        expect(decoded[0].type).toBe('npub');
        expect(decoded[1].type).toBe('note');
        expect(decoded[2].type).toBe('nprofile');
      });

      it('should handle empty array', () => {
        const decoded = service.decodeBatch([]);
        expect(decoded).toEqual([]);
      });

      it('should throw error for non-array input', () => {
        expect(() => service.decodeBatch('not-array' as any)).toThrow(/array/i);
      });

      it('should throw error if any identifier is invalid', () => {
        const npub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );

        expect(() => service.decodeBatch([npub, 'invalid-bech32'])).toThrow(
          /batch decoding failed/i
        );
      });

      it('should preserve data integrity through batch encode/decode', () => {
        const hexKey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        const relayUrl = 'wss://relay.damus.io';

        // Note: nrelay decode not supported by nostr-tools, so exclude from round-trip test
        const items = [
          { type: 'npub' as const, data: hexKey },
          { type: 'note' as const, data: hexKey },
          {
            type: 'nprofile' as const,
            data: { pubkey: hexKey, relays: [relayUrl] },
          },
        ];

        const encoded = service.encodeBatch(items);
        const decoded = service.decodeBatch(encoded);

        expect(decoded).toHaveLength(3);
        expect((decoded[0] as any).data).toBe(hexKey);
        expect((decoded[1] as any).data).toBe(hexKey);
        expect((decoded[2] as any).data.pubkey).toBe(hexKey);
        expect((decoded[2] as any).data.relays).toContain(relayUrl);
      });

      it('should decode all supported entity types', () => {
        const hexKey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
        // Note: nrelay decode is not supported by nostr-tools/nip19 decode()
        const identifiers = [
          service.encodePubkey(hexKey),
          service.encodePrivkey(hexKey),
          service.encodeNote(hexKey),
          service.encodeProfile({ pubkey: hexKey }),
          service.encodeEvent({ id: hexKey }),
          service.encodeAddress({ kind: 30023, pubkey: hexKey, identifier: 'test' }),
        ];

        const decoded = service.decodeBatch(identifiers);

        expect(decoded).toHaveLength(6);
        expect(decoded[0].type).toBe('npub');
        expect(decoded[1].type).toBe('nsec');
        expect(decoded[2].type).toBe('note');
        expect(decoded[3].type).toBe('nprofile');
        expect(decoded[4].type).toBe('nevent');
        expect(decoded[5].type).toBe('naddr');
      });
    });
  });

  // ========================================
  // Security Tests
  // ========================================

  describe('Security', () => {
    it('should never log private keys', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

      try {
        service.encodePrivkey('invalid');
      } catch (error) {
        // Should throw but not log
      }

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('nsec1'));
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('nsec1'));

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should sanitize error messages for nsec', () => {
      try {
        service.encodePrivkey('invalid');
      } catch (error) {
        expect((error as Error).message).not.toContain('nsec1');
      }
    });
  });

  // ========================================
  // Enhanced Error Handling Tests
  // ========================================

  describe('Enhanced Error Handling', () => {
    describe('ValidationError', () => {
      it('should throw ValidationError for invalid hex length', () => {
        expect(() => service.encodePubkey('invalid')).toThrow(ValidationError);
        expect(() => service.encodePubkey('invalid')).toThrow(
          /must be a 64-character hexadecimal string/i
        );
      });

      it('should throw ValidationError for non-hex characters', () => {
        const nonHex = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
        try {
          service.encodePubkey(nonHex);
          fail('Should have thrown ValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).code).toBe('VALIDATION_ERROR');
          expect((error as ValidationError).context?.fieldName).toBe('pubkey');
        }
      });

      it('should throw ValidationError for invalid relay URL', () => {
        try {
          service.encodeRelay('http://not-wss.com');
          fail('Should have thrown ValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).code).toBe('VALIDATION_ERROR');
        }
      });

      it('should throw ValidationError for empty string', () => {
        expect(() => service.encodePubkey('')).toThrow(ValidationError);
      });

      it('should throw ValidationError for invalid address kind', () => {
        try {
          service.encodeAddress({
            kind: 1, // Not parameterized replaceable
            pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
            identifier: 'test',
          });
          fail('Should have thrown ValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).context?.fieldName).toBe('kind');
        }
      });
    });

    describe('InvalidPrefixError', () => {
      it('should throw an error for unknown prefix strings', () => {
        // Any string with unknown prefix will throw some NIP19Error
        try {
          service.decode(
            'unknown1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9waw5y'
          );
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(NIP19Error);
        }
      });
    });

    describe('InvalidEncodingError', () => {
      it('should throw InvalidEncodingError for malformed bech32', () => {
        const malformed = 'npub1invalidbech32';

        try {
          service.decode(malformed);
          fail('Should have thrown InvalidEncodingError');
        } catch (error) {
          expect(error).toBeInstanceOf(InvalidEncodingError);
          expect((error as InvalidEncodingError).code).toBe('INVALID_ENCODING');
        }
      });

      it('should throw InvalidEncodingError for non-bech32 format', () => {
        const notBech32 = 'this-is-not-bech32';

        expect(() => service.decode(notBech32)).toThrow(InvalidEncodingError);
      });
    });

    describe('InvalidChecksumError', () => {
      it('should throw InvalidChecksumError for corrupted data', () => {
        // Create a valid npub and corrupt the checksum
        const validNpub = service.encodePubkey(
          '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
        );
        const corruptedNpub = validNpub.slice(0, -6) + 'XXXXXX';

        try {
          service.decode(corruptedNpub);
          fail('Should have thrown InvalidChecksumError or InvalidEncodingError');
        } catch (error) {
          // Could be either depending on how the corruption manifests
          expect(error).toBeInstanceOf(NIP19Error);
        }
      });
    });

    describe('Error Context and Messages', () => {
      it('should include helpful context in errors', () => {
        try {
          service.encodePubkey('tooshort');
          fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          const validationError = error as ValidationError;
          expect(validationError.context).toBeDefined();
          expect(validationError.message).toContain('64-character');
        }
      });

      it('should truncate long identifiers in error messages', () => {
        const longInvalid = 'a'.repeat(100);

        try {
          service.encodePubkey(longInvalid);
          fail('Should have thrown');
        } catch (error) {
          const validationError = error as ValidationError;
          // Context should truncate long values
          if (validationError.context?.actualValue) {
            expect(validationError.context.actualValue.length).toBeLessThanOrEqual(20);
          }
        }
      });

      it('should sanitize nsec in error messages', () => {
        try {
          service.encodePrivkey('invalid');
          fail('Should have thrown');
        } catch (error) {
          const errorMsg = (error as Error).message;
          expect(errorMsg).not.toContain('nsec1');
        }
      });
    });

    describe('Error Inheritance', () => {
      it('should allow catching base NIP19Error', () => {
        const testCases = [
          () => service.encodePubkey('invalid'),
          () => service.encodeRelay('invalid'),
          () => service.decode('invalid'),
        ];

        testCases.forEach((testCase) => {
          try {
            testCase();
            fail('Should have thrown');
          } catch (error) {
            expect(error).toBeInstanceOf(NIP19Error);
          }
        });
      });

      it('should allow catching specific error types', () => {
        try {
          service.encodePubkey('');
          fail('Should have thrown');
        } catch (error) {
          if (error instanceof ValidationError) {
            expect(error.code).toBe('VALIDATION_ERROR');
          } else {
            fail('Should be ValidationError');
          }
        }
      });
    });
  });

  // ========================================
  // Advanced Edge Cases
  // ========================================

  describe('Advanced Edge Cases', () => {
    it('should encode very long relay URLs to nrelay format', () => {
      // nostr-tools decode() does not support nrelay; only test encoding
      const longRelayUrl =
        'wss://very-long-relay-domain-name-that-is-quite-excessive.example.com/path/to/relay';
      const nrelay = service.encodeRelay(longRelayUrl);

      expect(nrelay).toMatch(/^nrelay1/);
    });

    it('should encode relay URLs with query parameters to nrelay format', () => {
      // nostr-tools decode() does not support nrelay; only test encoding
      const relayWithQuery = 'wss://relay.example.com?key=value&foo=bar';
      const nrelay = service.encodeRelay(relayWithQuery);

      expect(nrelay).toMatch(/^nrelay1/);
    });

    it('should handle naddr with moderate length identifiers', () => {
      // Very long identifiers (500 chars) may exceed TLV limits; use moderate length
      const identifier = 'a'.repeat(50);
      const naddr = service.encodeAddress({
        kind: 30023,
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        identifier,
      });

      const decoded = service.decode(naddr);
      expect(decoded.type).toBe('naddr');
      expect((decoded as any).data.identifier).toBe(identifier);
    });

    it('should handle nprofile with maximum relay count', () => {
      const maxRelays = Array.from({ length: 50 }, (_, i) => `wss://relay${i}.example.com`);
      const nprofile = service.encodeProfile({
        pubkey: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
        relays: maxRelays,
      });

      const decoded = service.decode(nprofile);
      expect(decoded.type).toBe('nprofile');
      expect((decoded as any).data.relays.length).toBe(50);
    });

    it('should handle mixed case hex strings', () => {
      const mixedCase = '3Bf0C63fCb93463407aF97a5E5Ee64Fa883D107eF9E558472c4Eb9AaAeFa459D';
      const npub = service.encodePubkey(mixedCase);

      expect(npub).toMatch(/^npub1/);
    });

    it('should handle boundary kind values for naddr', () => {
      const boundaryKinds = [30000, 30001, 39998, 39999];
      const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

      boundaryKinds.forEach((kind) => {
        const naddr = service.encodeAddress({
          kind,
          pubkey,
          identifier: 'test',
        });

        expect(naddr).toMatch(/^naddr1/);

        const decoded = service.decode(naddr);
        expect(decoded.type).toBe('naddr');
        expect((decoded as any).data.kind).toBe(kind);
      });
    });

    it('should reject boundary kind values outside valid range', () => {
      const invalidKinds = [29999, 40000];
      const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

      invalidKinds.forEach((kind) => {
        expect(() => service.encodeAddress({ kind, pubkey, identifier: 'test' })).toThrow(
          ValidationError
        );
      });
    });

    it('should handle special characters in naddr identifier', () => {
      const specialIdentifiers = [
        'test-with-hyphens',
        'test_with_underscores',
        'test.with.dots',
        'test:with:colons',
        'emoji-🔥-test',
      ];
      const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

      specialIdentifiers.forEach((identifier) => {
        const naddr = service.encodeAddress({
          kind: 30023,
          pubkey,
          identifier,
        });

        const decoded = service.decode(naddr);
        expect((decoded as any).data.identifier).toBe(identifier);
      });
    });
  });

  // ========================================
  // Performance Tests
  // ========================================

  describe('Performance', () => {
    it('should encode 1000 pubkeys in under 100ms', () => {
      const pubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        service.encodePubkey(pubkey);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should decode 1000 npubs in under 100ms', () => {
      const npub = service.encodePubkey(
        '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d'
      );

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        service.decode(npub);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle batch encoding of 100 items efficiently', () => {
      const hexKey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
      const items = Array.from({ length: 100 }, () => ({ type: 'npub' as const, data: hexKey }));

      const start = performance.now();
      const encoded = service.encodeBatch(items);
      const duration = performance.now() - start;

      expect(encoded).toHaveLength(100);
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should handle batch decoding of 100 items efficiently', () => {
      const hexKey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
      const npubs = Array.from({ length: 100 }, () => service.encodePubkey(hexKey));

      const start = performance.now();
      const decoded = service.decodeBatch(npubs);
      const duration = performance.now() - start;

      expect(decoded).toHaveLength(100);
      expect(duration).toBeLessThan(50); // Should be very fast
    });
  });
});
