/**
 * 🔐 **AUTH FEATURE TYPE DEFINITIONS**
 *
 * Elite Engineering Standards:
 * - Comprehensive type safety for authentication
 * - Zero `any` types with proper interfaces
 * - Zod schema validation integration
 * - Complete user role and permission modeling
 */

// 🎯 **USER ROLES & PERMISSIONS**
export type UserRole = 'creator' | 'supporter' | 'admin';

export type Permission =
  | 'content.create'
  | 'content.edit'
  | 'content.delete'
  | 'content.publish'
  | 'payments.receive'
  | 'payments.send'
  | 'admin.users'
  | 'admin.content'
  | 'admin.system';

// 👤 **USER INTERFACE**
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  nostr_pubkey?: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  created_at: string;
  updated_at: string;
  email_verified: boolean;
  nostr_verified: boolean;
  permissions: Permission[];
}

// 🔑 **AUTHENTICATION STATE**
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  error: string | null;
  lastActivity: string | null;
}

// 📝 **LOGIN CREDENTIALS**
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// 📋 **SIGNUP DATA**
export interface SignupData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  terms_accepted: boolean;
  marketing_consent?: boolean;
}

// 🌐 **NOSTR AUTHENTICATION**
export interface NostrChallenge {
  challenge: string;
  expires_at: string;
  used: boolean;
}

export interface NostrSignature {
  signature: string;
  pubkey: string;
  challenge: string;
  timestamp: number;
  event?: Record<string, unknown>;
}

// 🔄 **AUTH API RESPONSES**
export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  error?: string;
  challenge?: string;
  requiresConfirmation?: boolean;
}

// 🛡️ **PROTECTED ROUTE PROPS**
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: UserRole;
  requirePermissions?: Permission[];
  fallbackPath?: string;
  showAccessDenied?: boolean;
}

// 🎯 **AUTH CONTEXT TYPES**
export interface AuthContextValue {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  signup: (data: SignupData) => Promise<AuthResponse>;
  authenticateNostr: (signature: NostrSignature) => Promise<AuthResponse>;
  generateNostrChallenge: () => Promise<{ challenge?: string; timestamp?: number; error?: string }>;
  refreshToken: () => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  verifyEmail: (token: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
}

// 🔧 **UTILITY TYPES**
export type AuthStatus = Pick<AuthState, 'isAuthenticated' | 'isLoading' | 'user'>;

export type UserWithPermissions = User & {
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
};

// Account Linking
export * from './account-linking';
