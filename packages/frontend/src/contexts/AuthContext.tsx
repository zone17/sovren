/**
 * 🎯 **AUTH CONTEXT COMPATIBILITY LAYER**
 *
 * Elite Engineering: Maintains backward compatibility while using feature-based architecture
 * Re-exports AuthContext from the features/auth module
 */

// Re-export everything from the features-based AuthContext
export { AuthProvider, useAuth } from '../features/auth/services/AuthContext';

// Re-export types for convenience
export type {
    AuthContextValue,
    LoginCredentials, NostrChallenge, NostrSignature, SignupData, User
} from '../features/auth/types';
