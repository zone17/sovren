import type { VercelRequest } from './vercel';
import { User } from '@sovren/shared/types';

/**
 * 🔐 API Types for Type-Safe Route Handlers
 *
 * This module provides comprehensive type definitions for API routes,
 * ensuring type safety across request/response handling, authentication,
 * and error management.
 */

// ============================================
// AUTHENTICATION TYPES
// ============================================

/**
 * Extended Vercel request with authenticated user
 */
export interface AuthenticatedRequest extends VercelRequest {
  user: User;
}

/**
 * Result of user authentication
 */
export interface AuthResult {
  user: User | null;
  error?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Successful API response with typed data
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
}

/**
 * API error response with detailed error information
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  code?: string;
  details?: Record<string, string[] | string>;
  timestamp?: string;
  requestId?: string;
  retryAfter?: number;
}

/**
 * Discriminated union of API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// QUERY PARAMETER TYPES
// ============================================

/**
 * Base pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Posts query parameters with pagination and filters
 */
export interface PostsQueryParams extends PaginationParams {
  published?: 'true' | 'false' | 'all';
  author_id?: string;
  search?: string;
  sortBy?: 'created_at' | 'updated_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/**
 * User query parameters
 */
export interface UsersQueryParams extends PaginationParams {
  role?: 'creator' | 'supporter' | 'admin';
  status?: 'active' | 'inactive' | 'suspended';
  search?: string;
}

// ============================================
// REQUEST BODY TYPES
// ============================================

/**
 * User registration request body
 */
export interface RegisterRequestBody {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

/**
 * User login request body
 */
export interface LoginRequestBody {
  email: string;
  password: string;
}

/**
 * User update request body
 */
export interface UpdateUserRequestBody {
  name?: string;
  email?: string;
  bio?: string;
  location?: string;
  website?: string;
}

/**
 * Post creation request body
 */
export interface CreatePostRequestBody {
  title: string;
  content: string;
  published?: boolean;
}

/**
 * Post update request body
 */
export interface UpdatePostRequestBody {
  title?: string;
  content?: string;
  published?: boolean;
}

/**
 * Payment intent creation request body
 */
export interface CreatePaymentIntentRequestBody {
  amount: number;
  currency: string;
  postId?: string;
  creatorId?: string;
  metadata?: Record<string, string>;
}

// ============================================
// RESPONSE DATA TYPES
// ============================================

/**
 * User profile response (public-facing)
 */
export interface UserProfileResponse {
  id: string;
  name: string;
  email?: string; // Only included for own profile
  createdAt: string;
  updatedAt: string;
}

/**
 * User registration response
 */
export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    createdAt: string;
  };
  session?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    tokenType: string;
  } | null;
  requiresEmailVerification: boolean;
}

/**
 * Post response
 */
export interface PostResponse {
  id: string;
  title: string;
  content: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  author_id: string;
  users?: {
    id: string;
    name: string;
  };
}

/**
 * Posts list response with pagination
 */
export interface PostsListResponse {
  posts: PostResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: {
    published: 'true' | 'false' | 'all';
    author_id?: string;
    search?: string;
  };
}

/**
 * Payment intent response
 */
export interface PaymentIntentResponse {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  invoice?: string;
  createdAt: string;
}

// ============================================
// ERROR CODE ENUMS
// ============================================

/**
 * Standard API error codes
 */
export enum ApiErrorCode {
  // Authentication errors (401)
  AUTH_MISSING_HEADER = 'AUTH_MISSING_HEADER',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED_TOKEN = 'AUTH_EXPIRED_TOKEN',
  AUTH_REQUIRED = 'AUTH_REQUIRED',

  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation errors (400)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resource errors (404)
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  POST_NOT_FOUND = 'POST_NOT_FOUND',

  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  USER_EXISTS = 'USER_EXISTS',
  EMAIL_TAKEN = 'EMAIL_TAKEN',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Registration errors
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  WEAK_PASSWORD = 'WEAK_PASSWORD',

  // Email errors
  EMAIL_UPDATE_FAILED = 'EMAIL_UPDATE_FAILED',
  EMAIL_VERIFICATION_REQUIRED = 'EMAIL_VERIFICATION_REQUIRED',

  // Account errors
  ACCOUNT_DELETION_FAILED = 'ACCOUNT_DELETION_FAILED',
  UPDATE_FAILED = 'UPDATE_FAILED',
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(
  response: ApiResponse<unknown>
): response is ApiErrorResponse {
  return response.success === false;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Extract data type from API response
 */
export type ExtractApiData<T extends ApiResponse<any>> = T extends ApiSuccessResponse<infer D>
  ? D
  : never;

/**
 * Handler function signature for API routes
 */
export type ApiRouteHandler<T = unknown> = (
  req: VercelRequest,
  res: import('./vercel').VercelResponse
) => Promise<ApiResponse<T> | void>;

/**
 * Authenticated handler function signature
 */
export type AuthenticatedApiRouteHandler<T = unknown> = (
  req: AuthenticatedRequest,
  res: import('./vercel').VercelResponse
) => Promise<ApiResponse<T> | void>;
