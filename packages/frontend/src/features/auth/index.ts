/**
 * 🔐 **AUTH FEATURE MODULE EXPORTS**
 *
 * Elite Engineering Standards:
 * - Comprehensive feature encapsulation
 * - Type-safe exports with proper organization
 * - Clear separation of concerns
 * - TDD-compliant structure
 */

// 🛡️ **AUTHENTICATION SERVICES**
export { AuthProvider, useAuth, useAuthStatus } from './services/AuthContext';

// 🔒 **AUTHENTICATION COMPONENTS**
export { default as ProtectedRoute } from './components/ProtectedRoute';

// 🎯 **AUTH TYPES** - Now available!
export type {
  AuthContextValue,
  AuthResponse,
  AuthState,
  AuthStatus,
  LoginCredentials,
  NostrChallenge,
  NostrSignature,
  Permission,
  ProtectedRouteProps,
  SignupData,
  User,
  UserRole,
  UserWithPermissions,
} from './types';

// 🔧 **AUTH HOOKS** (when created)
// export { useLogin, useLogout, useSignup } from './hooks';

// 📦 **AUTH STORES** (when created)
// export { authStore, useAuthStore } from './stores';
