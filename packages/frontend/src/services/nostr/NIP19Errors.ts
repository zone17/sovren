/**
 * 🚨 NIP-19 Error Handling
 * US-310: NIP-19 Encoding Utilities - Subtask 5
 *
 * Comprehensive error handling for NIP-19 operations
 */

/**
 * NIP-19 Error Types
 */
export enum NIP19ErrorType {
  /** Invalid bech32 format */
  INVALID_FORMAT = 'INVALID_FORMAT',
  /** Unknown prefix */
  UNKNOWN_PREFIX = 'UNKNOWN_PREFIX',
  /** Invalid checksum */
  CHECKSUM_FAILED = 'CHECKSUM_FAILED',
  /** Invalid data length */
  INVALID_LENGTH = 'INVALID_LENGTH',
  /** Missing required field */
  MISSING_FIELD = 'MISSING_FIELD',
  /** Invalid hex encoding */
  INVALID_HEX = 'INVALID_HEX',
  /** Invalid URL format */
  INVALID_URL = 'INVALID_URL',
  /** Unsupported entity type */
  UNSUPPORTED_TYPE = 'UNSUPPORTED_TYPE',
  /** Decoding failed */
  DECODE_FAILED = 'DECODE_FAILED',
  /** Encoding failed */
  ENCODE_FAILED = 'ENCODE_FAILED',
}

/**
 * NIP-19 Error Details
 */
export interface NIP19ErrorDetails {
  type: NIP19ErrorType;
  message: string;
  input?: string;
  expectedFormat?: string;
  actualFormat?: string;
  field?: string;
  suggestion?: string;
}

/**
 * Custom NIP-19 Error Class
 */
export class NIP19Error extends Error {
  public readonly type: NIP19ErrorType;
  public readonly details: NIP19ErrorDetails;
  public readonly timestamp: number;

  constructor(details: NIP19ErrorDetails) {
    super(details.message);
    this.name = 'NIP19Error';
    this.type = details.type;
    this.details = details;
    this.timestamp = Date.now();

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NIP19Error);
    }
  }

  /**
   * Get user-friendly error message
   */
  public getUserMessage(): string {
    switch (this.type) {
      case NIP19ErrorType.INVALID_FORMAT:
        return `Invalid identifier format. Expected format: ${this.details.expectedFormat || 'bech32'}`;

      case NIP19ErrorType.UNKNOWN_PREFIX:
        return `Unknown identifier prefix. Valid prefixes: npub, nsec, note, nprofile, nevent, naddr, nrelay`;

      case NIP19ErrorType.CHECKSUM_FAILED:
        return 'Invalid identifier checksum. The identifier may be corrupted.';

      case NIP19ErrorType.INVALID_LENGTH:
        return `Invalid data length for ${this.details.field || 'identifier'}`;

      case NIP19ErrorType.MISSING_FIELD:
        return `Missing required field: ${this.details.field}`;

      case NIP19ErrorType.INVALID_HEX:
        return 'Invalid hexadecimal encoding';

      case NIP19ErrorType.INVALID_URL:
        return 'Invalid relay URL format. Expected: wss://... or ws://...';

      case NIP19ErrorType.UNSUPPORTED_TYPE:
        return `Unsupported entity type: ${this.details.field}`;

      case NIP19ErrorType.DECODE_FAILED:
        return 'Failed to decode identifier';

      case NIP19ErrorType.ENCODE_FAILED:
        return 'Failed to encode identifier';

      default:
        return this.message;
    }
  }

  /**
   * Get error context for logging
   */
  public getContext(): Record<string, any> {
    return {
      type: this.type,
      message: this.message,
      userMessage: this.getUserMessage(),
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Create error for invalid format
   */
  public static invalidFormat(input: string, expectedFormat?: string): NIP19Error {
    return new NIP19Error({
      type: NIP19ErrorType.INVALID_FORMAT,
      message: `Invalid bech32 format: ${input}`,
      input,
      expectedFormat,
      suggestion: 'Check that the identifier is properly formatted',
    });
  }

  /**
   * Create error for unknown prefix
   */
  public static unknownPrefix(prefix: string): NIP19Error {
    return new NIP19Error({
      type: NIP19ErrorType.UNKNOWN_PREFIX,
      message: `Unknown NIP-19 prefix: ${prefix}`,
      field: prefix,
      suggestion: 'Use one of: npub, nsec, note, nprofile, nevent, naddr, nrelay',
    });
  }

  /**
   * Create error for checksum failure
   */
  public static checksumFailed(input: string): NIP19Error {
    return new NIP19Error({
      type: NIP19ErrorType.CHECKSUM_FAILED,
      message: 'Bech32 checksum validation failed',
      input,
      suggestion: 'The identifier may be corrupted or mistyped',
    });
  }

  /**
   * Create error for invalid length
   */
  public static invalidLength(field: string, expected: number, actual: number): NIP19Error {
    return new NIP19Error({
      type: NIP19ErrorType.INVALID_LENGTH,
      message: `Invalid length for ${field}: expected ${expected}, got ${actual}`,
      field,
      expectedFormat: `${expected} bytes`,
      actualFormat: `${actual} bytes`,
    });
  }

  /**
   * Create error for missing field
   */
  public static missingField(field: string): NIP19Error {
    return new NIP19Error({
      type: NIP19ErrorType.MISSING_FIELD,
      message: `Missing required field: ${field}`,
      field,
    });
  }

  /**
   * Create error for invalid hex
   */
  public static invalidHex(input: string): NIP19Error {
    return new NIP19Error({
      type: NIP19ErrorType.INVALID_HEX,
      message: 'Invalid hexadecimal encoding',
      input,
      suggestion: 'Ensure the value contains only valid hex characters (0-9, a-f)',
    });
  }

  /**
   * Create error for invalid URL
   */
  public static invalidUrl(url: string): NIP19Error {
    return new NIP19Error({
      type: NIP19ErrorType.INVALID_URL,
      message: `Invalid relay URL: ${url}`,
      input: url,
      expectedFormat: 'wss://... or ws://...',
      suggestion: 'Relay URLs must use WebSocket protocol',
    });
  }

  /**
   * Create error for decode failure
   */
  public static decodeFailed(input: string, reason?: string): NIP19Error {
    return new NIP19Error({
      type: NIP19ErrorType.DECODE_FAILED,
      message: `Failed to decode: ${reason || 'Unknown error'}`,
      input,
    });
  }

  /**
   * Create error for encode failure
   */
  public static encodeFailed(reason?: string): NIP19Error {
    return new NIP19Error({
      type: NIP19ErrorType.ENCODE_FAILED,
      message: `Failed to encode: ${reason || 'Unknown error'}`,
    });
  }
}

/**
 * Error handler for NIP-19 operations
 */
export class NIP19ErrorHandler {
  private static errors: NIP19Error[] = [];
  private static maxErrors = 100;

  /**
   * Handle and log error
   */
  public static handle(error: Error | NIP19Error): void {
    const nip19Error =
      error instanceof NIP19Error
        ? error
        : new NIP19Error({
            type: NIP19ErrorType.DECODE_FAILED,
            message: error.message,
          });

    this.errors.push(nip19Error);

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[NIP19Error]', nip19Error.getContext());
    }
  }

  /**
   * Get recent errors
   */
  public static getRecentErrors(count: number = 10): NIP19Error[] {
    return this.errors.slice(-count);
  }

  /**
   * Get error statistics
   */
  public static getStatistics(): Record<NIP19ErrorType, number> {
    const stats: Partial<Record<NIP19ErrorType, number>> = {};

    for (const error of this.errors) {
      stats[error.type] = (stats[error.type] || 0) + 1;
    }

    // Ensure all error types are represented
    for (const type of Object.values(NIP19ErrorType)) {
      if (!(type in stats)) {
        stats[type] = 0;
      }
    }

    return stats as Record<NIP19ErrorType, number>;
  }

  /**
   * Clear error history
   */
  public static clear(): void {
    this.errors = [];
  }

  /**
   * Try to recover from error
   */
  public static tryRecover(error: NIP19Error): string | null {
    switch (error.type) {
      case NIP19ErrorType.INVALID_FORMAT:
        // Try to clean up the input
        if (error.details.input) {
          const cleaned = error.details.input
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          return cleaned;
        }
        break;

      case NIP19ErrorType.INVALID_URL:
        // Try to fix URL protocol
        if (error.details.input) {
          const url = error.details.input;
          if (url.startsWith('http://')) {
            return url.replace('http://', 'ws://');
          }
          if (url.startsWith('https://')) {
            return url.replace('https://', 'wss://');
          }
        }
        break;

      default:
        return null;
    }

    return null;
  }
}

/**
 * Validation helpers
 */
export class NIP19Validator {
  /**
   * Validate hex string
   */
  public static isValidHex(hex: string): boolean {
    return /^[0-9a-fA-F]+$/.test(hex);
  }

  /**
   * Validate public key
   */
  public static isValidPubkey(pubkey: string): boolean {
    return this.isValidHex(pubkey) && pubkey.length === 64;
  }

  /**
   * Validate private key
   */
  public static isValidPrivkey(privkey: string): boolean {
    return this.isValidHex(privkey) && privkey.length === 64;
  }

  /**
   * Validate event ID
   */
  public static isValidEventId(eventId: string): boolean {
    return this.isValidHex(eventId) && eventId.length === 64;
  }

  /**
   * Validate relay URL
   */
  public static isValidRelayUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
    } catch {
      return false;
    }
  }

  /**
   * Validate bech32 string
   */
  public static isValidBech32(str: string): boolean {
    const regex = /^[a-z0-9]+$/;
    return regex.test(str.toLowerCase());
  }

  /**
   * Get identifier type from string
   */
  public static getIdentifierType(str: string): string | null {
    const prefixes = ['npub', 'nsec', 'note', 'nprofile', 'nevent', 'naddr', 'nrelay'];

    for (const prefix of prefixes) {
      if (str.startsWith(prefix + '1')) {
        return prefix;
      }
    }

    return null;
  }
}

/**
 * Export error types and handlers
 */
export const nip19ErrorHandler = NIP19ErrorHandler;
export const nip19Validator = NIP19Validator;
