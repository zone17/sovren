/**
 * AUTH COMPATIBILITY LAYER
 *
 * Clean re-export layer for backward compatibility
 * This maintains our feature-based architecture while supporting legacy imports
 */

// Re-export all auth types from features
export type {
  AuthContextValue,
  AuthResponse,
  LoginCredentials,
  NostrChallenge,
  NostrSignature,
  SignupData,
  User,
} from '../features/auth/types';

// Re-export auth services and context
export { AuthProvider, useAuth } from '../features/auth/services/AuthContext';
