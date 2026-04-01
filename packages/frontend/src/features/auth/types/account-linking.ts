/**
 * Account Linking Frontend Types
 *
 * React-specific types for the email-to-NOSTR account linking UI flow.
 */

// Re-export shared types
export type {
  LinkedAccount,
  AccountLinkRequest,
  AccountLinkResult,
  AuthMethod,
} from '@shared/types/account-linking';

/** Steps in the account linking wizard */
export enum AccountLinkingStep {
  VerifyEmail = 'verify-email',
  VerifyNostr = 'verify-nostr',
  ConfirmMerge = 'confirm-merge',
  Complete = 'complete',
}

/** React context state for the account linking flow */
export interface AccountLinkingState {
  currentStep: AccountLinkingStep;
  sourceMethod: 'email' | 'nostr' | null;
  targetMethod: 'email' | 'nostr' | null;
  verificationPending: boolean;
  error: string | null;
  loading: boolean;
}
