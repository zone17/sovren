/**
 * 🔐 **ELITE AUTHENTICATION SERVICE**
 *
 * **Purpose**: Secure, type-safe authentication for NOSTR and traditional auth
 * **Architecture**: TypeScript-first with runtime validation and proper error handling
 * **Security**: No unsafe type assertions, comprehensive input validation
 * **Standards**: Elite engineering with comprehensive type safety
 *
 * @author Elite Engineering Team
 * @version 2.0.0 - Enhanced TypeScript Safety
 * @lastModified 2024-12-28
 */

import { z } from 'zod';

// 🛡️ **ELITE TYPE SAFETY SCHEMAS**

// Core User Schema (matching backend)
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  nostr_pubkey: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .optional(),
  role: z.enum(['creator', 'supporter', 'admin']).optional(),
  avatar_url: z.string().url().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// API Response Schema with strict validation
const APIResponseSchema = z.object({
  data: z.unknown().nullable(),
  error: z.string().nullable(),
  message: z.string().optional(),
});

// Login Response Schema
const LoginResponseSchema = z.object({
  user: UserSchema,
  token: z.string(),
});

// Challenge Response Schema
const NOSTRChallengeSchema = z.object({
  challenge: z.string(),
});

// Auth Verification Response Schema
const AuthVerificationResponseSchema = z.object({
  user: UserSchema,
  valid: z.boolean(),
});

// 🏗️ **TYPE DEFINITIONS** (Derived from validated schemas)
export type User = z.infer<typeof UserSchema>;

export interface AuthResponse {
  user: User | null;
  session: {
    token: string;
    valid: boolean;
  } | null;
  error?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  name: string;
}

// 🛡️ **SAFE API RESPONSE PARSER**
// Eliminates unsafe `any` assignments with runtime validation
async function safeParseApiResponse<T>(
  response: Response,
  dataSchema: z.ZodSchema<T>
): Promise<{ data: T | null; error: string | null; message?: string }> {
  try {
    // Parse response as unknown first
    const rawData: unknown = await response.json();

    // Validate response structure
    const apiResponse = APIResponseSchema.parse(rawData);

    // If we have data, validate it against the expected schema
    if (apiResponse.data !== null) {
      const validatedData = dataSchema.parse(apiResponse.data);
      return {
        data: validatedData,
        error: apiResponse.error,
        message: apiResponse.message,
      };
    }

    // No data but valid API response structure
    return {
      data: null,
      error: apiResponse.error,
      message: apiResponse.message,
    };
  } catch (error) {
    // Handle parsing or validation errors
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Invalid API response format',
      message: 'Response validation failed',
    };
  }
}

export class AuthService {
  // 🔐 Traditional Email/Password Login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result = await safeParseApiResponse(response, LoginResponseSchema);

      if (!response.ok) {
        return {
          user: null,
          session: null,
          error: result.message || 'Login failed',
        };
      }

      // Token is now stored in HttpOnly cookie by the backend automatically.

      return {
        user: result.data?.user || null,
        session: result.data?.token ? { token: result.data.token, valid: true } : null,
      };
    } catch (error: unknown) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }

  // 🔐 Traditional Email/Password Signup
  async signup(credentials: SignupCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...credentials,
          confirmPassword: credentials.password,
        }),
      });

      const result = await safeParseApiResponse(response, LoginResponseSchema);

      if (!response.ok) {
        return {
          user: null,
          session: null,
          error: result.message || 'Signup failed',
        };
      }

      // Token is now stored in HttpOnly cookie by the backend automatically.

      return {
        user: result.data?.user || null,
        session: result.data?.token ? { token: result.data.token, valid: true } : null,
      };
    } catch (error: unknown) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'Signup failed',
      };
    }
  }

  // 🌐 NOSTR Authentication Challenge
  async generateNostrChallenge(): Promise<{ challenge?: string; error?: string }> {
    try {
      const response = await fetch('/api/auth/challenge', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await safeParseApiResponse(response, NOSTRChallengeSchema);

      if (!response.ok) {
        return { error: result.message || 'Failed to generate challenge' };
      }

      return { challenge: result.data?.challenge };
    } catch (error: unknown) {
      return { error: error instanceof Error ? error.message : 'Challenge generation failed' };
    }
  }

  // 🌐 NOSTR Authentication with Signature
  async authenticateNostr(params: {
    nostr_pubkey: string;
    challenge: string;
    signature: string;
    timestamp: number;
    role?: 'creator' | 'supporter' | 'admin';
  }): Promise<AuthResponse> {
    try {
      const response = await fetch('/api/auth/authenticate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const result = await safeParseApiResponse(response, LoginResponseSchema);

      if (!response.ok) {
        return {
          user: null,
          session: null,
          error: result.message || 'NOSTR authentication failed',
        };
      }

      // Token is now stored in HttpOnly cookie by the backend automatically.

      return {
        user: result.data?.user || null,
        session: result.data?.token ? { token: result.data.token, valid: true } : null,
      };
    } catch (error: unknown) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'NOSTR authentication failed',
      };
    }
  }

  // 🔍 Verify Current Authentication
  async verifyAuth(): Promise<AuthResponse> {
    try {
      // Token is in HttpOnly cookie, sent automatically with credentials: 'include'
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await safeParseApiResponse(response, AuthVerificationResponseSchema);

      if (!response.ok) {
        return {
          user: null,
          session: null,
          error: result.message || 'Authentication verification failed',
        };
      }

      return {
        user: result.data?.user || null,
        session: { token: 'httponly-cookie', valid: result.data?.valid || false },
      };
    } catch (error: unknown) {
      return {
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'Auth verification failed',
      };
    }
  }

  // 🚪 Logout
  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      // Call backend logout — HttpOnly cookie cleared server-side
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      };
    }
  }

  // 🔑 Get Current Token
  // Token is stored in HttpOnly cookie — not accessible from JS.
  // This method is kept for backward compatibility but returns null.
  getToken(): string | null {
    return null;
  }

  // 👤 Get Current User — requires a server call since JWT is in HttpOnly cookie
  getCurrentUser(): User | null {
    // Cannot decode JWT from HttpOnly cookie client-side.
    // Use verifyAuth() for async user retrieval instead.
    return null;
  }
}

// 🌟 Export singleton instance
export const authService = new AuthService();

// 🚀 NOSTR Key Generation and Utilities
export async function generateNostrKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const { generateSecretKey, getPublicKey } = await import('nostr-tools/pure');

  // Generate a random private key
  const privateKey = generateSecretKey();
  const publicKey = getPublicKey(privateKey);

  return {
    publicKey,
    privateKey: Array.from(privateKey)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  };
}

export async function signNostrChallenge(privateKey: string, challenge: string): Promise<string> {
  const { finalizeEvent } = await import('nostr-tools/pure');

  // Convert hex string back to Uint8Array
  const privateKeyBytes = new Uint8Array(
    privateKey.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  const event = {
    kind: 22242, // NOSTR auth event kind
    created_at: Math.floor(Date.now() / 1000),
    tags: [['challenge', challenge]],
    content: '',
    pubkey: '', // Will be set by finalizeEvent
  };

  const signedEvent = finalizeEvent(event, privateKeyBytes);
  return signedEvent.sig;
}
