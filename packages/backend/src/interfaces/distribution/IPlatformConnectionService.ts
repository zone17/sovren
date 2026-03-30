/**
 * Platform Connection Service Interface
 * EPIC-009: Multi-Platform Hub
 */

import type { PlatformStatus, SupportedPlatform } from '@shared/types/distribution';
import type { IPlatformAdapter } from '../../services/distribution/adapters/IPlatformAdapter';

export interface IPlatformConnectionService {
  /** Get the platform adapter for a given platform */
  getAdapter(platform: SupportedPlatform): IPlatformAdapter;

  /** Initiate OAuth flow and return authorization URL */
  initiateConnection(
    creatorId: string,
    platform: SupportedPlatform,
    options?: { instance_url?: string; scopes?: string[] }
  ): Promise<{ authorization_url: string }>;

  /** Handle OAuth callback, exchange code for tokens, encrypt and store */
  handleCallback(
    platform: SupportedPlatform,
    code: string,
    state: string
  ): Promise<{ creator_id: string; platform: SupportedPlatform }>;

  /** Disconnect a platform: revoke tokens, delete connection */
  disconnect(creatorId: string, platform: SupportedPlatform): Promise<void>;

  /** Get status of all connected platforms for a creator */
  getStatus(creatorId: string): Promise<PlatformStatus[]>;

  /** Get decrypted access token for a platform connection */
  getDecryptedToken(creatorId: string, platform: SupportedPlatform): Promise<string>;

  /** Refresh tokens that are about to expire */
  refreshExpiringTokens(): Promise<number>;
}
