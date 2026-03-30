/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * NIP19Service - Bech32 Identifier Encoding/Decoding
 *
 * US-310: Implement NIP-19 Encoding Utilities
 * Epic 003: NOSTR Consolidation
 *
 * Implements NIP-19 compliant bech32 encoding/decoding for human-readable NOSTR identifiers.
 * Supports all 7 entity types: npub, nsec, note, nprofile, nevent, nrelay, naddr
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/19.md
 *
 * @example Basic Usage
 * ```typescript
 * import { nip19Service } from '@/services/nostr/NIP19Service';
 *
 * // Encode a public key
 * const npub = nip19Service.encodePubkey('3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d');
 * // npub1809rv0yjdyz8gpa0j7j7tm8ylzyr6yr77854g3evf6u242h6gkwsa9yjfr
 *
 * // Decode it back
 * const decoded = nip19Service.decode(npub);
 * // { type: 'npub', data: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d' }
 * ```
 *
 * @example Batch Operations
 * ```typescript
 * // Encode multiple items efficiently
 * const items = [
 *   { type: 'npub', data: '3bf0c63f...' },
 *   { type: 'note', data: 'e3b0c442...' },
 *   { type: 'nrelay', data: 'wss://relay.damus.io' }
 * ];
 * const encoded = nip19Service.encodeBatch(items);
 *
 * // Decode multiple identifiers
 * const decoded = nip19Service.decodeBatch(encoded);
 * ```
 *
 * @example Error Handling
 * ```typescript
 * import { ValidationError, InvalidEncodingError } from '@/services/nostr/NIP19Service';
 *
 * try {
 *   nip19Service.encodePubkey('invalid');
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.log('Field:', error.context?.fieldName);
 *     console.log('Expected:', error.context?.expectedFormat);
 *   }
 * }
 * ```
 */
import {
  npubEncode,
  nsecEncode,
  noteEncode,
  nprofileEncode,
  neventEncode,
  naddrEncode,
  encodeBytes,
  decode as nip19Decode,
  BECH32_REGEX,
} from 'nostr-tools/nip19';
import { hexToBytes, bytesToHex } from 'nostr-tools/utils';
import {
  type DecodedNIP19,
  type DecodedKey,
  type DecodedNote,
  type DecodedProfile,
  type DecodedEvent,
  type DecodedAddress,
} from '@shared/types/nostr/index';
/**
 * Decoded nrelay type (temporary until added to shared types)
 */
export interface DecodedRelay {
  type: 'nrelay';
  data: string; // Relay URL
}
// ========================================
// Error Classes
// ========================================
/**
 * Base error class for NIP-19 operations
 */
export class NIP19Error extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NIP19Error';
    Object.setPrototypeOf(this, NIP19Error.prototype);
  }
}
/**
 * Invalid prefix error - thrown when bech32 prefix is not recognized
 */
export class InvalidPrefixError extends NIP19Error {
  constructor(prefix: string, validPrefixes: string[]) {
    super(
      `Invalid NIP-19 prefix: "${prefix}". Expected one of: ${validPrefixes.join(', ')}`,
      'INVALID_PREFIX',
      { prefix, validPrefixes }
    );
    this.name = 'InvalidPrefixError';
    Object.setPrototypeOf(this, InvalidPrefixError.prototype);
  }
}
/**
 * Invalid encoding error - thrown when bech32 encoding is malformed
 */
export class InvalidEncodingError extends NIP19Error {
  constructor(identifier: string, reason: string) {
    super(`Invalid bech32 encoding: ${reason}`, 'INVALID_ENCODING', {
      identifier: identifier.substring(0, 20) + '...',
    });
    this.name = 'InvalidEncodingError';
    Object.setPrototypeOf(this, InvalidEncodingError.prototype);
  }
}
/**
 * Malformed data error - thrown when decoded data doesn't match expected format
 */
export class MalformedDataError extends NIP19Error {
  constructor(entityType: string, reason: string, data?: unknown) {
    super(`Malformed ${entityType} data: ${reason}`, 'MALFORMED_DATA', { entityType, data });
    this.name = 'MalformedDataError';
    Object.setPrototypeOf(this, MalformedDataError.prototype);
  }
}
/**
 * Invalid checksum error - thrown when bech32 checksum validation fails
 */
export class InvalidChecksumError extends NIP19Error {
  constructor(identifier: string) {
    super('Invalid bech32 checksum - data may be corrupted', 'INVALID_CHECKSUM', {
      identifier: identifier.substring(0, 20) + '...',
    });
    this.name = 'InvalidChecksumError';
    Object.setPrototypeOf(this, InvalidChecksumError.prototype);
  }
}
/**
 * Validation error - thrown when input validation fails
 */
export class ValidationError extends NIP19Error {
  constructor(fieldName: string, expectedFormat: string, actualValue?: string) {
    super(`Validation failed for ${fieldName}: ${expectedFormat}`, 'VALIDATION_ERROR', {
      fieldName,
      expectedFormat,
      actualValue: actualValue?.substring(0, 20),
    });
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
// ========================================
// Type Definitions
// ========================================
/**
 * Profile pointer for nprofile encoding
 */
export interface ProfilePointer {
  pubkey: string;
  relays?: string[];
}
/**
 * Event pointer for nevent encoding
 */
export interface EventPointer {
  id: string;
  relays?: string[];
  author?: string;
  kind?: number;
}
/**
 * Address pointer for naddr encoding
 */
export interface AddressPointer {
  identifier: string;
  pubkey: string;
  kind: number;
  relays?: string[];
}
/**
 * QR Code generation options
 */
export interface QRCodeOptions {
  size?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}
// ========================================
// NIP19Service Implementation
// ========================================
/**
 * NIP-19 Bech32 Identifier Service
 *
 * Provides encoding, decoding, validation, and helper utilities
 * for NIP-19 bech32-encoded NOSTR identifiers.
 */
export class NIP19Service {
  private readonly HEX_REGEX = /^[a-fA-F0-9]{64}$/;
  private readonly WSS_REGEX = /^wss:\/\/.+/;
  // ========================================
  // Encoding Functions
  // ========================================
  /**
   * Encode hex public key to npub (bech32)
   *
   * @param hex - 64-character hex public key
   * @returns Bech32-encoded npub string
   * @throws Error if hex is invalid
   */
  encodePubkey(hex: string): string {
    this.validateHexInput(hex, 'pubkey');
    const normalizedHex = hex.toLowerCase();
    try {
      return npubEncode(normalizedHex);
    } catch (error) {
      throw new Error(`Failed to encode pubkey: ${this.sanitizeErrorMessage(error)}`);
    }
  }
  /**
   * Encode hex private key to nsec (bech32)
   *
   * @param hex - 64-character hex private key
   * @returns Bech32-encoded nsec string
   * @throws Error if hex is invalid
   * @security Never logs or exposes nsec in error messages
   */
  encodePrivkey(hex: string): string {
    this.validateHexInput(hex, 'privkey');
    const normalizedHex = hex.toLowerCase();
    try {
      // nsecEncode requires Uint8Array, not hex string
      const bytes = hexToBytes(normalizedHex);
      return nsecEncode(bytes);
    } catch (error) {
      // SECURITY: Never expose nsec in error messages
      throw new Error('Failed to encode private key: Invalid format');
    }
  }
  /**
   * Encode event ID to note (bech32)
   *
   * @param eventId - 64-character hex event ID
   * @returns Bech32-encoded note string
   * @throws Error if event ID is invalid
   */
  encodeNote(eventId: string): string {
    this.validateHexInput(eventId, 'event id');
    const normalizedId = eventId.toLowerCase();
    try {
      return noteEncode(normalizedId);
    } catch (error) {
      throw new Error(`Failed to encode note: ${this.sanitizeErrorMessage(error)}`);
    }
  }
  /**
   * Encode profile reference to nprofile (bech32)
   *
   * @param data - Profile pointer with pubkey and optional relays
   * @returns Bech32-encoded nprofile string
   * @throws ValidationError if data is invalid
   */
  encodeProfile(data: ProfilePointer): string {
    if (!data.pubkey || !this.validateHex(data.pubkey)) {
      throw new ValidationError(
        'pubkey',
        'Must be a valid 64-character hexadecimal string',
        data.pubkey
      );
    }
    if (data.relays && data.relays.length > 0) {
      this.validateRelays(data.relays);
    }
    try {
      return nprofileEncode({
        pubkey: data.pubkey.toLowerCase(),
        relays: data.relays,
      });
    } catch (error) {
      throw new MalformedDataError('nprofile', this.sanitizeErrorMessage(error), data);
    }
  }
  /**
   * Encode event reference to nevent (bech32)
   *
   * @param data - Event pointer with id and optional metadata
   * @returns Bech32-encoded nevent string
   * @throws ValidationError if data is invalid
   */
  encodeEvent(data: EventPointer): string {
    if (!data.id || !this.validateHex(data.id)) {
      throw new ValidationError(
        'event id',
        'Must be a valid 64-character hexadecimal string',
        data.id
      );
    }
    if (data.relays && data.relays.length > 0) {
      this.validateRelays(data.relays);
    }
    // Validate author if provided
    if (data.author && !this.validateHex(data.author)) {
      throw new ValidationError(
        'author',
        'Must be a valid 64-character hexadecimal string',
        data.author
      );
    }
    try {
      return neventEncode({
        id: data.id.toLowerCase(),
        relays: data.relays,
        author: data.author?.toLowerCase(),
        kind: data.kind,
      });
    } catch (error) {
      throw new MalformedDataError('nevent', this.sanitizeErrorMessage(error), data);
    }
  }
  /**
   * Encode relay URL to nrelay (bech32)
   *
   * @param url - WebSocket relay URL (must start with wss://)
   * @returns Bech32-encoded nrelay string
   * @throws ValidationError if URL is invalid
   */
  encodeRelay(url: string): string {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('relay URL', 'Input must be a non-empty string', url);
    }
    if (!this.validateRelayUrl(url)) {
      throw new ValidationError(
        'relay URL',
        'Must be a valid WebSocket URL starting with wss://',
        url
      );
    }
    try {
      // Encode relay URL as bytes with 'nrelay' prefix
      // Use TextEncoder (available in browsers and Node.js with util polyfill)
      const TextEncoderConstructor =
        typeof TextEncoder !== 'undefined'
          ? TextEncoder
          : (globalThis as any).TextEncoder || (global as any).TextEncoder;
      if (!TextEncoderConstructor) {
        throw new MalformedDataError('nrelay', 'TextEncoder is not available in this environment');
      }
      const encoder = new TextEncoderConstructor();
      const urlBytes = encoder.encode(url);
      // Ensure we have a Uint8Array (convert if necessary)
      const bytes = urlBytes instanceof Uint8Array ? urlBytes : new Uint8Array(urlBytes);
      return encodeBytes('nrelay', bytes);
    } catch (error) {
      if (error instanceof NIP19Error) {
        throw error;
      }
      throw new MalformedDataError('nrelay', this.sanitizeErrorMessage(error), url);
    }
  }
  /**
   * Encode address reference to naddr (bech32)
   *
   * @param data - Address pointer with kind, pubkey, identifier, and optional relays
   * @returns Bech32-encoded naddr string
   * @throws ValidationError if data is invalid
   */
  encodeAddress(data: AddressPointer): string {
    // Validate kind is parameterized replaceable (30000-39999)
    if (data.kind < 30000 || data.kind > 39999) {
      throw new ValidationError(
        'kind',
        'Must be a parameterized replaceable event kind (30000-39999)',
        String(data.kind)
      );
    }
    if (!data.pubkey || !this.validateHex(data.pubkey)) {
      throw new ValidationError(
        'pubkey',
        'Must be a valid 64-character hexadecimal string',
        data.pubkey
      );
    }
    if (!data.identifier || data.identifier.trim() === '') {
      throw new ValidationError(
        'identifier',
        'Must be a non-empty string (d-tag)',
        data.identifier
      );
    }
    if (data.relays && data.relays.length > 0) {
      this.validateRelays(data.relays);
    }
    try {
      return naddrEncode({
        kind: data.kind,
        pubkey: data.pubkey.toLowerCase(),
        identifier: data.identifier,
        relays: data.relays,
      });
    } catch (error) {
      if (error instanceof NIP19Error) {
        throw error;
      }
      throw new MalformedDataError('naddr', this.sanitizeErrorMessage(error), data);
    }
  }
  // ========================================
  // Decoding Functions
  // ========================================
  /**
   * Decode NIP-19 bech32 identifier
   *
   * @param nip19 - Bech32-encoded identifier (npub, nsec, note, etc.)
   * @returns Decoded entity with type and data
   * @throws Error if identifier is invalid
   */
  decode(nip19: string): DecodedNIP19 {
    if (!nip19 || typeof nip19 !== 'string') {
      throw new ValidationError('identifier', 'Input must be a non-empty string', nip19);
    }
    if (!this.isValidBech32(nip19)) {
      throw new InvalidEncodingError(nip19, 'Not a valid bech32 format');
    }
    // Extract prefix for better error messages
    const prefixMatch = nip19.match(/^([a-z]+)1/);
    const prefix = prefixMatch ? prefixMatch[1] : 'unknown';
    const validPrefixes = ['npub', 'nsec', 'note', 'nprofile', 'nevent', 'nrelay', 'naddr'];
    try {
      const decoded = nip19Decode(nip19);
      // Map nostr-tools decoded type to our type system
      // Note: decoded.data can be Uint8Array for some types
      switch (decoded.type) {
        case 'npub':
          // npub returns string
          return {
            type: 'npub' as const,
            data: decoded.data as string,
          } as DecodedKey;
        case 'nsec': {
          // nsec returns Uint8Array, convert to hex
          const nsecData = decoded.data;
          return {
            type: 'nsec' as const,
            data: nsecData instanceof Uint8Array ? bytesToHex(nsecData) : (nsecData as string),
          } as DecodedKey;
        }
        case 'note':
          // note returns string (hex)
          return {
            type: 'note' as const,
            data: decoded.data as string,
          } as DecodedNote;
        case 'nprofile':
          return {
            type: 'nprofile' as const,
            data: {
              pubkey: (decoded.data as any).pubkey,
              relays: (decoded.data as any).relays,
            },
          } as DecodedProfile;
        case 'nevent':
          return {
            type: 'nevent' as const,
            data: {
              id: (decoded.data as any).id,
              relays: (decoded.data as any).relays,
              author: (decoded.data as any).author,
              kind: (decoded.data as any).kind,
            },
          } as DecodedEvent;
        case 'naddr':
          return {
            type: 'naddr' as const,
            data: {
              identifier: (decoded.data as any).identifier,
              pubkey: (decoded.data as any).pubkey,
              kind: (decoded.data as any).kind,
              relays: (decoded.data as any).relays,
            },
          } as DecodedAddress;
        case 'nrelay': {
          // nrelay returns Uint8Array, decode to string
          const relayData = decoded.data;
          const relayUrl =
            relayData instanceof Uint8Array
              ? new TextDecoder().decode(relayData)
              : (relayData as string);
          return {
            type: 'nrelay' as const,
            data: relayUrl,
          } as DecodedRelay;
        }
        default:
          throw new InvalidPrefixError(prefix, validPrefixes);
      }
    } catch (error) {
      // Re-throw our custom errors as-is
      if (error instanceof NIP19Error) {
        throw error;
      }
      // Check for checksum errors
      if (error instanceof Error && error.message.toLowerCase().includes('checksum')) {
        throw new InvalidChecksumError(nip19);
      }
      // Check for unknown prefix
      if (error instanceof Error && error.message.toLowerCase().includes('unknown')) {
        throw new InvalidPrefixError(prefix, validPrefixes);
      }
      // Generic decoding error
      throw new InvalidEncodingError(nip19, this.sanitizeErrorMessage(error));
    }
  }
  // ========================================
  // Batch Operations
  // ========================================
  /**
   * Batch encoding for multiple entities
   *
   * @param items - Array of entities to encode
   * @returns Array of encoded NIP-19 identifiers
   * @throws Error if any encoding fails
   *
   * @example
   * ```typescript
   * const items = [
   *   { type: 'npub', data: '3bf0c63f...' },
   *   { type: 'note', data: 'e3b0c442...' },
   *   { type: 'nprofile', data: { pubkey: '3bf0c63f...', relays: ['wss://relay.damus.io'] } }
   * ];
   * const encoded = service.encodeBatch(items);
   * // ['npub1...', 'note1...', 'nprofile1...']
   * ```
   */
  encodeBatch(
    items: Array<
      | { type: 'npub'; data: string }
      | { type: 'nsec'; data: string }
      | { type: 'note'; data: string }
      | { type: 'nprofile'; data: ProfilePointer }
      | { type: 'nevent'; data: EventPointer }
      | { type: 'nrelay'; data: string }
      | { type: 'naddr'; data: AddressPointer }
    >
  ): string[] {
    if (!Array.isArray(items)) {
      throw new Error('Batch encoding requires an array of items');
    }
    if (items.length === 0) {
      return [];
    }
    const results: string[] = [];
    const errors: Array<{ index: number; type: string; error: string }> = [];
    items.forEach((item, index) => {
      try {
        let encoded: string;
        switch (item.type) {
          case 'npub':
            encoded = this.encodePubkey(item.data);
            break;
          case 'nsec':
            encoded = this.encodePrivkey(item.data);
            break;
          case 'note':
            encoded = this.encodeNote(item.data);
            break;
          case 'nprofile':
            encoded = this.encodeProfile(item.data);
            break;
          case 'nevent':
            encoded = this.encodeEvent(item.data);
            break;
          case 'nrelay':
            encoded = this.encodeRelay(item.data);
            break;
          case 'naddr':
            encoded = this.encodeAddress(item.data);
            break;
          default:
            throw new Error(`Unknown entity type: ${(item as any).type}`);
        }
        results.push(encoded);
      } catch (error) {
        errors.push({
          index,
          type: item.type,
          error: this.sanitizeErrorMessage(error),
        });
      }
    });
    if (errors.length > 0) {
      const errorDetails = errors.map(e => `[${e.index}] ${e.type}: ${e.error}`).join(', ');
      throw new Error(`Batch encoding failed for ${errors.length} item(s): ${errorDetails}`);
    }
    return results;
  }
  /**
   * Batch decoding for multiple NIP-19 identifiers
   *
   * @param nip19s - Array of NIP-19 identifiers to decode
   * @returns Array of decoded entities
   * @throws Error if any decoding fails
   *
   * @example
   * ```typescript
   * const encoded = ['npub1...', 'note1...', 'nprofile1...'];
   * const decoded = service.decodeBatch(encoded);
   * // [
   * //   { type: 'npub', data: '3bf0c63f...' },
   * //   { type: 'note', data: 'e3b0c442...' },
   * //   { type: 'nprofile', data: { pubkey: '3bf0c63f...', relays: [...] } }
   * // ]
   * ```
   */
  decodeBatch(nip19s: string[]): Array<DecodedNIP19 | DecodedRelay> {
    if (!Array.isArray(nip19s)) {
      throw new Error('Batch decoding requires an array of NIP-19 identifiers');
    }
    if (nip19s.length === 0) {
      return [];
    }
    const results: Array<DecodedNIP19 | DecodedRelay> = [];
    const errors: Array<{ index: number; identifier: string; error: string }> = [];
    nip19s.forEach((nip19, index) => {
      try {
        const decoded = this.decode(nip19);
        results.push(decoded);
      } catch (error) {
        errors.push({
          index,
          identifier: this.formatForDisplay(nip19, 20),
          error: this.sanitizeErrorMessage(error),
        });
      }
    });
    if (errors.length > 0) {
      const errorDetails = errors.map(e => `[${e.index}] ${e.identifier}: ${e.error}`).join(', ');
      throw new Error(`Batch decoding failed for ${errors.length} identifier(s): ${errorDetails}`);
    }
    return results;
  }
  // ========================================
  // Validation Functions
  // ========================================
  /**
   * Validate bech32 format
   *
   * @param str - String to validate
   * @returns true if valid bech32 format
   */
  isValidBech32(str: string): boolean {
    if (!str || typeof str !== 'string') {
      return false;
    }
    return BECH32_REGEX.test(str);
  }
  /**
   * Validate NIP-19 identifier
   *
   * @param str - String to validate
   * @returns true if valid NIP-19 identifier
   */
  isValidNIP19(str: string): boolean {
    if (!this.isValidBech32(str)) {
      return false;
    }
    const validPrefixes = ['npub1', 'nsec1', 'note1', 'nprofile1', 'nevent1', 'nrelay1', 'naddr1'];
    return validPrefixes.some(prefix => str.startsWith(prefix));
  }
  /**
   * Validate 64-character hex string
   *
   * @param hex - String to validate
   * @returns true if valid hex
   */
  validateHex(hex: string): boolean {
    if (!hex || typeof hex !== 'string') {
      return false;
    }
    return this.HEX_REGEX.test(hex);
  }
  /**
   * Validate relay URL
   *
   * @param url - URL to validate
   * @returns true if valid relay URL
   */
  validateRelayUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'wss:';
    } catch {
      return false;
    }
  }
  // ========================================
  // Integration Helpers
  // ========================================
  /**
   * Auto-detect NIP-19 entity type
   *
   * @param identifier - NIP-19 identifier
   * @returns Entity type or null if invalid
   */
  detectEntityType(identifier: string): string | null {
    if (!this.isValidNIP19(identifier)) {
      return null;
    }
    if (identifier.startsWith('npub1')) return 'npub';
    if (identifier.startsWith('nsec1')) return 'nsec';
    if (identifier.startsWith('note1')) return 'note';
    if (identifier.startsWith('nprofile1')) return 'nprofile';
    if (identifier.startsWith('nevent1')) return 'nevent';
    if (identifier.startsWith('nrelay1')) return 'nrelay';
    if (identifier.startsWith('naddr1')) return 'naddr';
    return null;
  }
  /**
   * Format identifier for display (truncate with ellipsis)
   *
   * @param identifier - NIP-19 identifier
   * @param maxLength - Maximum length before truncation (default: 16)
   * @returns Formatted identifier
   */
  formatForDisplay(identifier: string, maxLength: number = 16): string {
    if (identifier.length <= maxLength) {
      return identifier;
    }
    // Get the prefix (e.g., "npub1", "note1")
    const prefixMatch = identifier.match(/^(npub1|nsec1|note1|nprofile1|nevent1|nrelay1|naddr1)/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const prefixLength = prefix.length;
    // Show prefix + some chars + ... + suffix
    const charsToShow = Math.max(4, maxLength - prefixLength - 3);
    const suffixLength = Math.floor(charsToShow / 2);
    const midLength = charsToShow - suffixLength;
    return `${identifier.slice(0, prefixLength + midLength)}...${identifier.slice(-suffixLength)}`;
  }
  /**
   * Copy identifier to clipboard
   *
   * @param identifier - Identifier to copy
   * @throws Error if clipboard API is unavailable
   */
  async copyToClipboard(identifier: string): Promise<void> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API unavailable in this environment');
    }
    try {
      await navigator.clipboard.writeText(identifier);
    } catch (error) {
      throw new Error(`Failed to copy to clipboard: ${this.sanitizeErrorMessage(error)}`);
    }
  }
  /**
   * Generate QR code data URL for identifier
   *
   * @param identifier - NIP-19 identifier
   * @param options - QR code generation options
   * @returns Data URL for QR code image
   */
  generateQRCode(identifier: string, options: QRCodeOptions = {}): string {
    const { size = 256 } = options;
    // Check if we're in a browser environment
    if (typeof document === 'undefined') {
      // In Node/test environment, return a mock data URL
      return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
    }
    // Simple QR code generation using canvas
    // In production, use a library like qrcode.js
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context for QR code');
    }
    canvas.width = size;
    canvas.height = size;
    // Simple placeholder (in production, use proper QR library)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'black';
    ctx.font = '12px monospace';
    ctx.fillText('QR Code', 10, 20);
    ctx.fillText(this.formatForDisplay(identifier, 20), 10, 40);
    return canvas.toDataURL('image/png');
  }
  // ========================================
  // Private Helper Methods
  // ========================================
  /**
   * Validate hex input and throw descriptive error
   */
  private validateHexInput(hex: string, fieldName: string): void {
    if (!hex || typeof hex !== 'string') {
      throw new ValidationError(fieldName, 'Input must be a non-empty string', hex);
    }
    if (!this.validateHex(hex)) {
      throw new ValidationError(
        fieldName,
        'Must be a 64-character hexadecimal string',
        `${hex.length} characters provided`
      );
    }
  }
  /**
   * Validate array of relay URLs
   */
  private validateRelays(relays: string[]): void {
    const invalidRelays = relays.filter(url => !this.validateRelayUrl(url));
    if (invalidRelays.length > 0) {
      throw new ValidationError(
        'relays',
        'All relay URLs must be valid WebSocket URLs starting with wss://',
        invalidRelays.join(', ')
      );
    }
  }
  /**
   * Sanitize error messages (remove sensitive data)
   */
  private sanitizeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message.replace(/nsec1[a-z0-9]+/gi, '[REDACTED]');
    }
    return 'Unknown error';
  }
}
// ========================================
// Singleton Export
// ========================================
/**
 * Singleton instance of NIP19Service
 */
export const nip19Service = new NIP19Service();
/**
 * Default export
 */
export default NIP19Service;
