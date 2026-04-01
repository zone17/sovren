/**
 * Account Linking Types
 *
 * Type scaffolds for email-to-NOSTR account linking flow.
 * No business logic -- types only for the merge/link pipeline.
 */

/** Supported authentication methods for account linking */
export type AuthMethod = 'email' | 'nostr' | 'extension';

/** A linked account record associating an email identity with a NOSTR pubkey */
export interface LinkedAccount {
  userId: string;
  email: string | null;
  nostrPubkey: string | null;
  linkedAt: string; // ISO 8601
  linkMethod: AuthMethod;
  verified: boolean;
}

/** Request to initiate an account link between two auth methods */
export interface AccountLinkRequest {
  sourceAuthMethod: AuthMethod;
  targetAuthMethod: AuthMethod;
  verificationToken: string;
  sourceIdentifier: string; // email or pubkey of the source
  targetIdentifier: string; // email or pubkey of the target
}

/** Result of an account linking operation */
export type AccountLinkResult =
  | {
      success: true;
      mergedAccount: LinkedAccount;
      previousAccountIds: string[];
    }
  | {
      success: false;
      error: string;
      code: 'ALREADY_LINKED' | 'INVALID_TOKEN' | 'ACCOUNT_CONFLICT' | 'VERIFICATION_FAILED';
    };
