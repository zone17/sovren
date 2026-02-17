/**
 * 🔐 ELITE SERVICE: NIP-26 Delegated Event Signing
 * US-318: NIP-26 Delegated Signing Implementation
 *
 * Implements NIP-26 which allows users to delegate event signing to third-party
 * applications without exposing their private key.
 *
 * Features:
 * - Create delegation tokens with conditions
 * - Validate delegation signatures
 * - Sign events with delegation
 * - Support time-based and kind-based conditions
 * - Cryptographic verification of delegations
 *
 * NIP-26 Spec: https://github.com/nostr-protocol/nips/blob/master/26.md
 *
 * @example
 * ```typescript
 * const service = NIP26Service.getInstance();
 *
 * // Create delegation
 * const delegation = await service.createDelegation(
 *   delegateePublicKey,
 *   { kind: 1, created_at_after: Date.now() / 1000 },
 *   delegatorPrivateKey
 * );
 *
 * // Sign event with delegation
 * const event = await service.signDelegatedEvent(
 *   { kind: 1, content: 'Hello', tags: [] },
 *   delegateePrivateKey,
 *   delegation
 * );
 *
 * // Validate delegation
 * const isValid = service.validateDelegation(event);
 * ```
 */

import { getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import * as secp256k1 from '@noble/secp256k1';
import type {
  NostrEvent,
  UnsignedNostrEvent,
  DelegationToken,
  DelegationConditions,
  DelegatedEvent,
} from '@shared/types/nostr';

/**
 * Delegation creation result
 */
export interface DelegationResult {
  /** Delegation token */
  token: DelegationToken;
  /** Serialized delegation tag for event */
  tag: ['delegation', string, string, string];
  /** Conditions string */
  conditionsString: string;
}

/**
 * Delegation validation result
 */
export interface DelegationValidationResult {
  /** Is delegation valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Delegator public key */
  delegator?: string;
  /** Delegatee public key */
  delegatee?: string;
  /** Parsed conditions */
  conditions?: DelegationConditions;
}

/**
 * NIP-26 Delegated Event Signing Service
 */
export class NIP26Service {
  private static instance: NIP26Service;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): NIP26Service {
    if (!NIP26Service.instance) {
      NIP26Service.instance = new NIP26Service();
    }
    return NIP26Service.instance;
  }

  /**
   * Create a delegation token
   *
   * @param delegateePublicKey - Public key of the delegatee (who will sign)
   * @param conditions - Delegation conditions (kind, time range)
   * @param delegatorPrivateKey - Private key of the delegator (who authorizes)
   * @returns Delegation result with token and tag
   *
   * @example
   * ```typescript
   * const delegation = await service.createDelegation(
   *   'delegatee-pubkey',
   *   { kind: 1, created_at_after: 1234567890 },
   *   'delegator-privkey'
   * );
   * ```
   */
  public async createDelegation(
    delegateePublicKey: string,
    conditions: DelegationConditions,
    delegatorPrivateKey: string
  ): Promise<DelegationResult> {
    // Validate inputs
    this.validatePublicKey(delegateePublicKey);
    this.validatePrivateKey(delegatorPrivateKey);
    this.validateConditions(conditions);

    // Get delegator public key
    const delegatorKeyBytes = this.hexToBytes(delegatorPrivateKey);
    const delegatorPublicKey = getPublicKey(delegatorKeyBytes);

    // Build conditions string
    const conditionsString = this.buildConditionsString(conditions);

    // Create delegation token string for signing
    const delegationToken = `nostr:delegation:${delegateePublicKey}:${conditionsString}`;

    // Sign the delegation token
    const signature = await this.signDelegationToken(
      delegationToken,
      delegatorPrivateKey
    );

    // Create delegation token object
    const token: DelegationToken = {
      delegator: delegatorPublicKey,
      delegatee: delegateePublicKey,
      conditions: conditionsString,
      signature,
    };

    // Create delegation tag for events
    const tag: ['delegation', string, string, string] = [
      'delegation',
      delegatorPublicKey,
      conditionsString,
      signature,
    ];

    return {
      token,
      tag,
      conditionsString,
    };
  }

  /**
   * Validate a delegation in an event
   *
   * @param event - Event with potential delegation tag
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const result = await service.validateDelegation(event);
   * if (!result.valid) {
   *   console.error('Invalid delegation:', result.error);
   * }
   * ```
   */
  public async validateDelegation(event: NostrEvent): Promise<DelegationValidationResult> {
    // Find delegation tag
    const delegationTag = event.tags.find(
      (tag) => tag[0] === 'delegation' && tag.length === 4
    );

    if (!delegationTag) {
      return {
        valid: false,
        error: 'No delegation tag found',
      };
    }

    const [, delegator, conditionsString, signature] = delegationTag;

    // Validate format
    if (!delegator || !conditionsString || !signature) {
      return {
        valid: false,
        error: 'Invalid delegation tag format',
      };
    }

    // Parse conditions
    const conditions = this.parseConditionsString(conditionsString);

    // Validate signature
    const delegationToken = `nostr:delegation:${event.pubkey}:${conditionsString}`;
    const signatureValid = await this.verifyDelegationSignature(
      delegationToken,
      signature,
      delegator
    );

    if (!signatureValid) {
      return {
        valid: false,
        error: 'Invalid delegation signature',
        delegator,
        delegatee: event.pubkey,
        conditions,
      };
    }

    // Validate conditions against event
    const conditionsValid = this.validateEventAgainstConditions(
      event,
      conditions
    );

    if (!conditionsValid.valid) {
      return {
        valid: false,
        error: conditionsValid.error,
        delegator,
        delegatee: event.pubkey,
        conditions,
      };
    }

    return {
      valid: true,
      delegator,
      delegatee: event.pubkey,
      conditions,
    };
  }

  /**
   * Sign an event with delegation
   *
   * @param eventTemplate - Event template to sign
   * @param delegateePrivateKey - Private key of delegatee
   * @param delegation - Delegation token from createDelegation
   * @returns Signed delegated event
   *
   * @example
   * ```typescript
   * const event = await service.signDelegatedEvent(
   *   { kind: 1, content: 'Hello', tags: [] },
   *   delegateePrivateKey,
   *   delegation
   * );
   * ```
   */
  public async signDelegatedEvent(
    eventTemplate: Omit<UnsignedNostrEvent, 'pubkey' | 'created_at'>,
    delegateePrivateKey: string,
    delegation: DelegationResult
  ): Promise<DelegatedEvent> {
    this.validatePrivateKey(delegateePrivateKey);

    // Get delegatee public key
    const delegateeKeyBytes = this.hexToBytes(delegateePrivateKey);
    const delegateePubkey = getPublicKey(delegateeKeyBytes);

    // Verify delegatee matches delegation
    if (delegateePubkey !== delegation.token.delegatee) {
      throw new Error(
        'Delegatee private key does not match delegation token'
      );
    }

    // Create unsigned event
    const unsignedEvent: UnsignedNostrEvent = {
      ...eventTemplate,
      pubkey: delegateePubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [...eventTemplate.tags, delegation.tag],
    };

    // Validate against delegation conditions
    const conditions = this.parseConditionsString(delegation.conditionsString);
    const conditionsValid = this.validateEventAgainstConditions(
      unsignedEvent as NostrEvent,
      conditions
    );

    if (!conditionsValid.valid) {
      throw new Error(
        `Event violates delegation conditions: ${conditionsValid.error}`
      );
    }

    // Sign the event
    const signedEvent = finalizeEvent(unsignedEvent, delegateeKeyBytes) as DelegatedEvent;

    return signedEvent;
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Build conditions string from conditions object
   */
  private buildConditionsString(conditions: DelegationConditions): string {
    const parts: string[] = [];

    if (conditions.kind !== undefined) {
      parts.push(`kind=${conditions.kind}`);
    }

    if (conditions.created_at_after !== undefined) {
      parts.push(`created_at>${conditions.created_at_after}`);
    }

    if (conditions.created_at_before !== undefined) {
      parts.push(`created_at<${conditions.created_at_before}`);
    }

    if (parts.length === 0) {
      throw new Error('At least one condition must be specified');
    }

    return parts.join('&');
  }

  /**
   * Parse conditions string to object
   */
  private parseConditionsString(conditionsString: string): DelegationConditions {
    const conditions: DelegationConditions = {};
    const parts = conditionsString.split('&');

    for (const part of parts) {
      if (part.startsWith('kind=')) {
        conditions.kind = parseInt(part.substring(5), 10);
      } else if (part.startsWith('created_at>')) {
        conditions.created_at_after = parseInt(part.substring(11), 10);
      } else if (part.startsWith('created_at<')) {
        conditions.created_at_before = parseInt(part.substring(11), 10);
      }
    }

    return conditions;
  }

  /**
   * Sign delegation token
   */
  private async signDelegationToken(
    delegationToken: string,
    privateKey: string
  ): Promise<string> {
    const hash = await this.sha256(delegationToken);
    const signature = await secp256k1.schnorr.sign(hash, privateKey);
    return Buffer.from(signature).toString('hex');
  }

  /**
   * Verify delegation signature
   */
  private async verifyDelegationSignature(
    delegationToken: string,
    signature: string,
    publicKey: string
  ): Promise<boolean> {
    try {
      const hash = await this.sha256(delegationToken);
      const signatureBytes = new Uint8Array(Buffer.from(signature, 'hex'));
      const publicKeyBytes = new Uint8Array(Buffer.from(publicKey, 'hex'));

      return await secp256k1.schnorr.verify(signatureBytes, hash, publicKeyBytes);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate event against delegation conditions
   */
  private validateEventAgainstConditions(
    event: Partial<NostrEvent>,
    conditions: DelegationConditions
  ): { valid: boolean; error?: string } {
    // Check kind
    if (conditions.kind !== undefined && event.kind !== conditions.kind) {
      return {
        valid: false,
        error: `Event kind ${event.kind} does not match required kind ${conditions.kind}`,
      };
    }

    // Check created_at range
    if (event.created_at !== undefined) {
      if (
        conditions.created_at_after !== undefined &&
        event.created_at <= conditions.created_at_after
      ) {
        return {
          valid: false,
          error: `Event timestamp ${event.created_at} is not after ${conditions.created_at_after}`,
        };
      }

      if (
        conditions.created_at_before !== undefined &&
        event.created_at >= conditions.created_at_before
      ) {
        return {
          valid: false,
          error: `Event timestamp ${event.created_at} is not before ${conditions.created_at_before}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * SHA-256 hash (async)
   */
  private async sha256(message: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  }


  /**
   * Convert hex string to Uint8Array
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  /**
   * Validate public key format
   */
  private validatePublicKey(pubkey: string): void {
    if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
      throw new Error('Invalid public key format');
    }
  }

  /**
   * Validate private key format
   */
  private validatePrivateKey(privkey: string): void {
    if (!/^[0-9a-f]{64}$/i.test(privkey)) {
      throw new Error('Invalid private key format');
    }
  }

  /**
   * Validate delegation conditions
   */
  private validateConditions(conditions: DelegationConditions): void {
    if (
      conditions.kind === undefined &&
      conditions.created_at_after === undefined &&
      conditions.created_at_before === undefined
    ) {
      throw new Error('At least one delegation condition must be specified');
    }

    if (conditions.kind !== undefined && conditions.kind < 0) {
      throw new Error('Event kind must be non-negative');
    }

    if (
      conditions.created_at_after !== undefined &&
      conditions.created_at_before !== undefined &&
      conditions.created_at_after >= conditions.created_at_before
    ) {
      throw new Error(
        'created_at_after must be less than created_at_before'
      );
    }
  }

  /**
   * Extract delegation from event
   */
  public extractDelegation(event: NostrEvent): DelegationToken | null {
    const delegationTag = event.tags.find(
      (tag) => tag[0] === 'delegation' && tag.length === 4
    );

    if (!delegationTag) {
      return null;
    }

    const [, delegator, conditions, signature] = delegationTag;

    return {
      delegator,
      delegatee: event.pubkey,
      conditions,
      signature,
    };
  }

  /**
   * Check if event is delegated
   */
  public isDelegatedEvent(event: NostrEvent): boolean {
    return event.tags.some(
      (tag) => tag[0] === 'delegation' && tag.length === 4
    );
  }
}

/**
 * Export singleton instance
 */
export const nip26Service = NIP26Service.getInstance();
