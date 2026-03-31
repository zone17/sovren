// @ts-nocheck
import dns from 'dns';
import { promisify } from 'util';
import { z } from 'zod';
import { SupabaseDatabase } from '../config/database';

// 🔍 DNS Lookup Utilities
// dns.lookup available but not currently used — kept for future IP validation
const dnsResolveTxt = promisify(dns.resolveTxt);

// 🔐 NIP-05 Verification Types and Schemas
export interface NIP05Identifier {
  localPart: string;
  domain: string;
  full: string; // localPart@domain
}

export interface NIP05VerificationRequest {
  user_id: string;
  nostr_pubkey: string;
  nip05_identifier: string;
  domain: string;
  local_part: string;
  verification_method: 'http' | 'dns' | 'manual';
  metadata?: Record<string, any>;
}

export interface NIP05VerificationRecord {
  id: string;
  user_id: string;
  nostr_pubkey: string;
  nip05_identifier: string;
  domain: string;
  local_part: string;
  verification_status: 'pending' | 'verified' | 'failed' | 'expired' | 'revoked';
  verification_method: 'http' | 'dns' | 'manual';
  verification_data: Record<string, any>;
  verified_at?: string;
  expires_at?: string;
  last_checked_at: string;
  check_count: number;
  failure_reason?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DomainVerificationConfig {
  domain: string;
  verification_methods: ('http' | 'dns' | 'manual')[];
  auto_verify: boolean;
  verification_interval: number; // hours
  max_verifications_per_domain: number;
  trusted_domain: boolean;
  custom_validation_rules?: Record<string, any>;
}

export interface VerificationResult {
  success: boolean;
  verified: boolean;
  method: 'http' | 'dns' | 'manual';
  verification_data?: Record<string, any>;
  error?: string;
  expires_at?: string;
}

// 📝 Validation Schemas
const NIP05IdentifierSchema = z.object({
  localPart: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/),
  domain: z
    .string()
    .min(1)
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  full: z.string().min(3).max(320),
});

const NIP05VerificationRequestSchema = z.object({
  user_id: z.string().uuid(),
  nostr_pubkey: z
    .string()
    .length(64)
    .regex(/^[a-f0-9]{64}$/),
  nip05_identifier: z.string().min(3).max(320),
  domain: z.string().min(1).max(253),
  local_part: z.string().min(1).max(64),
  verification_method: z.enum(['http', 'dns', 'manual']),
  metadata: z.record(z.any()).optional(),
});

/**
 * 🔍 Elite NIP-05 Verification Service
 * WHY: Comprehensive NOSTR identity verification with domain validation
 */
export class NIP05VerificationService {
  private database: SupabaseDatabase;
  private readonly VERIFICATION_TIMEOUT = 30000; // 30 seconds
  // MAX_RETRIES: 3 — reserved for future retry loop implementation
  private readonly CACHE_TTL = 3600; // 1 hour
  private verificationCache = new Map<string, { result: VerificationResult; timestamp: number }>();

  constructor(database?: SupabaseDatabase) {
    this.database = database || new SupabaseDatabase();
  }

  /**
   * 🔍 Parse NIP-05 Identifier
   * WHY: Validate and normalize NIP-05 identifier format
   */
  parseNIP05Identifier(identifier: string): {
    success: boolean;
    parsed?: NIP05Identifier;
    error?: string;
  } {
    try {
      // Normalize identifier
      const normalized = identifier.toLowerCase().trim();

      // Validate basic format
      if (!normalized.includes('@')) {
        return { success: false, error: 'Invalid NIP-05 format: missing @ symbol' };
      }

      const parts = normalized.split('@');
      if (parts.length !== 2) {
        return { success: false, error: 'Invalid NIP-05 format: multiple @ symbols' };
      }

      const [localPart, domain] = parts;

      // Create identifier object
      const parsedIdentifier: NIP05Identifier = {
        localPart,
        domain,
        full: normalized,
      };

      // Validate using schema
      const validationResult = NIP05IdentifierSchema.safeParse(parsedIdentifier);
      if (!validationResult.success) {
        return {
          success: false,
          error: `Invalid NIP-05 format: ${validationResult.error.errors[0].message}`,
        };
      }

      return { success: true, parsed: parsedIdentifier };
    } catch (error) {
      return {
        success: false,
        error: `NIP-05 parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🆕 Create Verification Request
   * WHY: Initiate NIP-05 verification process for a user
   */
  async createVerificationRequest(request: NIP05VerificationRequest): Promise<{
    success: boolean;
    verification?: NIP05VerificationRecord;
    error?: string;
  }> {
    try {
      // Validate request
      const validatedRequest = NIP05VerificationRequestSchema.parse(request);

      // Parse and validate NIP-05 identifier
      const parseResult = this.parseNIP05Identifier(validatedRequest.nip05_identifier);
      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      // Check for existing verification
      const existingResult = await this.getVerificationByIdentifier(
        validatedRequest.nip05_identifier
      );
      if (
        existingResult.success &&
        existingResult.verification?.verification_status === 'verified'
      ) {
        return {
          success: false,
          error: 'NIP-05 identifier already verified by another user',
        };
      }

      // Check domain verification limits
      const domainLimitCheck = await this.checkDomainLimits(validatedRequest.domain);
      if (!domainLimitCheck.success) {
        return { success: false, error: domainLimitCheck.error };
      }

      // Create verification record
      const verificationData = {
        user_id: validatedRequest.user_id,
        nostr_pubkey: validatedRequest.nostr_pubkey,
        nip05_identifier: validatedRequest.nip05_identifier,
        domain: validatedRequest.domain,
        local_part: validatedRequest.local_part,
        verification_status: 'pending' as const,
        verification_method: validatedRequest.verification_method,
        verification_data: {},
        last_checked_at: new Date().toISOString(),
        check_count: 0,
        metadata: validatedRequest.metadata || {},
      };

      const { data, error } = await this.database.client
        .from('nip05_verifications')
        .insert(verificationData)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Verification request creation failed: ${error.message}`);
      }

      // Start verification process (result intentionally unused — side effect updates DB)
      await this.performVerification(data.id, validatedRequest.verification_method);

      return { success: true, verification: data };
    } catch (error) {
      return {
        success: false,
        error: `Verification request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔍 Perform HTTP Verification
   * WHY: Verify NIP-05 identifier via HTTP /.well-known/nostr.json
   */
  async performHTTPVerification(
    domain: string,
    localPart: string,
    expectedPubkey: string
  ): Promise<VerificationResult> {
    try {
      const wellKnownUrl = `https://${domain}/.well-known/nostr.json`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.VERIFICATION_TIMEOUT);

      try {
        const response = await fetch(wellKnownUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Sovren-NIP05-Verifier/1.0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return {
            success: false,
            verified: false,
            method: 'http',
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          return {
            success: false,
            verified: false,
            method: 'http',
            error: 'Invalid content type: expected application/json',
          };
        }

        const data = await response.json();

        // Validate response structure
        if (!data.names || typeof data.names !== 'object') {
          return {
            success: false,
            verified: false,
            method: 'http',
            error: 'Invalid response: missing names object',
          };
        }

        // Check if local part exists and matches pubkey
        const pubkey = data.names[localPart];
        if (!pubkey) {
          return {
            success: false,
            verified: false,
            method: 'http',
            error: `Local part '${localPart}' not found in names`,
          };
        }

        if (pubkey !== expectedPubkey) {
          return {
            success: false,
            verified: false,
            method: 'http',
            error: 'Public key mismatch',
          };
        }

        // Check for relays (optional)
        const relays = data.relays?.[expectedPubkey] || [];

        return {
          success: true,
          verified: true,
          method: 'http',
          verification_data: {
            url: wellKnownUrl,
            response_data: data,
            relays,
            verified_at: new Date().toISOString(),
          },
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      return {
        success: false,
        verified: false,
        method: 'http',
        error: `HTTP verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔍 Perform DNS Verification
   * WHY: Verify NIP-05 identifier via DNS TXT records
   */
  async performDNSVerification(
    domain: string,
    localPart: string,
    expectedPubkey: string
  ): Promise<VerificationResult> {
    try {
      // Check for NIP-05 DNS TXT record
      const dnsName = `_nostr.${domain}`;

      try {
        const txtRecords = await dnsResolveTxt(dnsName);

        for (const record of txtRecords) {
          const txtValue = Array.isArray(record) ? record.join('') : record;

          // Parse TXT record for NIP-05 data
          if (txtValue.startsWith('nostr=')) {
            const nostrData = txtValue.substring(6);

            try {
              const parsed = JSON.parse(nostrData);

              if (parsed.names && parsed.names[localPart] === expectedPubkey) {
                return {
                  success: true,
                  verified: true,
                  method: 'dns',
                  verification_data: {
                    dns_name: dnsName,
                    txt_record: txtValue,
                    parsed_data: parsed,
                    verified_at: new Date().toISOString(),
                  },
                  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                };
              }
            } catch (parseError) {
              continue; // Try next record
            }
          }
        }

        return {
          success: false,
          verified: false,
          method: 'dns',
          error: 'No valid NIP-05 DNS record found',
        };
      } catch (dnsError) {
        return {
          success: false,
          verified: false,
          method: 'dns',
          error: `DNS lookup failed: ${dnsError instanceof Error ? dnsError.message : 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        verified: false,
        method: 'dns',
        error: `DNS verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔍 Perform Verification
   * WHY: Execute verification based on method
   */
  async performVerification(
    verificationId: string,
    method: 'http' | 'dns' | 'manual'
  ): Promise<VerificationResult> {
    try {
      // Get verification record
      const { data: verification, error } = await this.database.client
        .from('nip05_verifications')
        .select('*')
        .eq('id', verificationId)
        .single();

      if (error || !verification) {
        return {
          success: false,
          verified: false,
          method,
          error: 'Verification record not found',
        };
      }

      // Check cache first
      const cacheKey = `${verification.domain}:${verification.local_part}:${verification.nostr_pubkey}:${method}`;
      const cached = this.verificationCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL * 1000) {
        return cached.result;
      }

      let result: VerificationResult;

      // Perform verification based on method
      switch (method) {
        case 'http':
          result = await this.performHTTPVerification(
            verification.domain,
            verification.local_part,
            verification.nostr_pubkey
          );
          break;
        case 'dns':
          result = await this.performDNSVerification(
            verification.domain,
            verification.local_part,
            verification.nostr_pubkey
          );
          break;
        case 'manual':
          result = {
            success: true,
            verified: false,
            method: 'manual',
            error: 'Manual verification requires admin approval',
          };
          break;
        default:
          result = {
            success: false,
            verified: false,
            method,
            error: 'Unsupported verification method',
          };
      }

      // Cache result
      this.verificationCache.set(cacheKey, { result, timestamp: Date.now() });

      // Update verification record
      await this.updateVerificationRecord(verificationId, result);

      return result;
    } catch (error) {
      return {
        success: false,
        verified: false,
        method,
        error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔄 Update Verification Record
   * WHY: Update verification status and data
   */
  async updateVerificationRecord(
    verificationId: string,
    result: VerificationResult
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData = {
        verification_status: result.verified ? 'verified' : 'failed',
        verification_data: result.verification_data || {},
        last_checked_at: new Date().toISOString(),
        check_count: (this.database.client as unknown as { raw: (expr: string) => unknown }).raw(
          'check_count + 1'
        ),
        failure_reason: result.error || null,
        verified_at: result.verified ? new Date().toISOString() : null,
        expires_at: result.expires_at || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.database.client
        .from('nip05_verifications')
        .update(updateData)
        .eq('id', verificationId);

      if (error) {
        throw new Error(`Verification update failed: ${error.message}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 📋 List User Verifications
   * WHY: Get all verification records for a user
   */
  async listUserVerifications(userId: string): Promise<{
    success: boolean;
    verifications?: NIP05VerificationRecord[];
    error?: string;
  }> {
    try {
      const { data, error } = await this.database.client
        .from('nip05_verifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Verification listing failed: ${error.message}`);
      }

      return { success: true, verifications: data || [] };
    } catch (error) {
      return {
        success: false,
        error: `Verification listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔍 Get Verification by Identifier
   * WHY: Find verification record by NIP-05 identifier
   */
  async getVerificationByIdentifier(identifier: string): Promise<{
    success: boolean;
    verification?: NIP05VerificationRecord;
    error?: string;
  }> {
    try {
      const { data, error } = await this.database.client
        .from('nip05_verifications')
        .select('*')
        .eq('nip05_identifier', identifier.toLowerCase())
        .eq('verification_status', 'verified')
        .single();

      if (error && error.code !== 'PGRST116') {
        // Not found is OK
        throw new Error(`Verification lookup failed: ${error.message}`);
      }

      return { success: true, verification: data || undefined };
    } catch (error) {
      return {
        success: false,
        error: `Verification lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🚫 Revoke Verification
   * WHY: Revoke a verified NIP-05 identifier
   */
  async revokeVerification(
    verificationId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await this.database.client
        .from('nip05_verifications')
        .update({
          verification_status: 'revoked',
          failure_reason: reason || 'Manual revocation',
          updated_at: new Date().toISOString(),
        })
        .eq('id', verificationId);

      if (error) {
        throw new Error(`Verification revocation failed: ${error.message}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Verification revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 🔄 Refresh Verification
   * WHY: Re-verify an existing verification
   */
  async refreshVerification(verificationId: string): Promise<{
    success: boolean;
    result?: VerificationResult;
    error?: string;
  }> {
    try {
      // Get verification record
      const { data: verification, error } = await this.database.client
        .from('nip05_verifications')
        .select('*')
        .eq('id', verificationId)
        .single();

      if (error || !verification) {
        return { success: false, error: 'Verification record not found' };
      }

      // Clear cache
      const cacheKey = `${verification.domain}:${verification.local_part}:${verification.nostr_pubkey}:${verification.verification_method}`;
      this.verificationCache.delete(cacheKey);

      // Perform verification
      const result = await this.performVerification(
        verificationId,
        verification.verification_method
      );

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: `Verification refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // 🔧 Private Helper Methods

  private async checkDomainLimits(domain: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get domain configuration
      const domainConfig = await this.getDomainConfig(domain);

      // Check verification count for domain
      const { data, error } = await this.database.client
        .from('nip05_verifications')
        .select('id')
        .eq('domain', domain)
        .eq('verification_status', 'verified');

      if (error) {
        throw new Error(`Domain limit check failed: ${error.message}`);
      }

      const currentCount = data?.length || 0;
      const maxVerifications = domainConfig.max_verifications_per_domain;

      if (currentCount >= maxVerifications) {
        return {
          success: false,
          error: `Domain verification limit exceeded: ${currentCount}/${maxVerifications}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getDomainConfig(domain: string): Promise<DomainVerificationConfig> {
    // Default configuration - in production, this would be from database
    return {
      domain,
      verification_methods: ['http', 'dns'],
      auto_verify: true,
      verification_interval: 24,
      max_verifications_per_domain: 1000,
      trusted_domain: false,
    };
  }
}

// 🏭 Service Factory
export const createNIP05VerificationService = (
  database?: SupabaseDatabase
): NIP05VerificationService => {
  return new NIP05VerificationService(database);
};
