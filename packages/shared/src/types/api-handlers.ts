/**
 * 🚀 Elite API Route Handler Types
 * Comprehensive type safety for Express.js API routes
 * Epic 001 - Story 9: API Route Handler Types
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserRole } from './user';

// ========================================
// Core Request/Response Types
// ========================================

/**
 * Typed Request with validated body, params, and query
 */
export interface TypedRequest<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>,
> extends Omit<Request, 'body' | 'params' | 'query' | 'user'> {
  body: TBody;
  params: TParams;
  query: TQuery;
  user?: AuthenticatedUser;
}

/**
 * Typed Response with JSON helper
 */
export interface TypedResponse<TData = unknown> extends Response {
  json: (data: ApiResponse<TData>) => this;
}

/**
 * Authenticated User from JWT/Session
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  nostrPubkey?: string;
  nostr_pubkey: string;
  role: UserRole;
  permissions: string[];
  sessionId?: string;
  createdAt: number;
  expiresAt: number;
}

// UserRole is imported from ./user (canonical location)

// ========================================
// API Response Types
// ========================================

/**
 * Standard API Response Envelope
 */
export interface ApiResponse<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: ApiError;
  meta?: ApiMeta;
  timestamp: number;
}

/**
 * API Error Details
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string; // Only in development
  validationErrors?: ValidationError[];
}

/**
 * Validation Error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

/**
 * API Response Metadata
 */
export interface ApiMeta {
  requestId?: string;
  pagination?: PaginationMeta;
  rateLimit?: RateLimitMeta;
  cache?: CacheMeta;
  performance?: PerformanceMeta;
}

/**
 * Pagination Metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Rate Limit Metadata
 */
export interface RateLimitMeta {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter?: number; // Seconds
}

/**
 * Cache Metadata
 */
export interface CacheMeta {
  hit: boolean;
  ttl?: number;
  key?: string;
  generatedAt?: number;
}

/**
 * Performance Metadata
 */
export interface PerformanceMeta {
  duration: number; // milliseconds
  dbQueries?: number;
  cacheHits?: number;
  externalCalls?: number;
}

// ========================================
// Route Handler Types
// ========================================

/**
 * Async Route Handler
 */
export type AsyncRouteHandler<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>,
  TResponse = unknown,
> = (
  req: TypedRequest<TBody, TParams, TQuery>,
  res: TypedResponse<TResponse>,
  next: NextFunction
) => Promise<void> | Promise<Response>;

/**
 * Sync Route Handler
 */
export type SyncRouteHandler<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>,
  TResponse = unknown,
> = (
  req: TypedRequest<TBody, TParams, TQuery>,
  res: TypedResponse<TResponse>,
  next: NextFunction
) => void | Response;

/**
 * Generic Route Handler (Async or Sync)
 */
export type RouteHandler<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>,
  TResponse = unknown,
> =
  | AsyncRouteHandler<TBody, TParams, TQuery, TResponse>
  | SyncRouteHandler<TBody, TParams, TQuery, TResponse>;

/**
 * Middleware Handler
 */
export type MiddlewareHandler<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>,
> = (
  req: TypedRequest<TBody, TParams, TQuery>,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Error Handler
 */
export type ErrorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// ========================================
// Validation Schema Types
// ========================================

/**
 * Route Validation Schemas
 */
export interface RouteValidationSchemas<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>,
> {
  body?: z.ZodSchema<TBody>;
  params?: z.ZodSchema<TParams>;
  query?: z.ZodSchema<TQuery>;
}

/**
 * Validation Result
 */
export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

// ========================================
// Route Configuration Types
// ========================================

/**
 * Route Configuration
 */
export interface RouteConfig<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>,
  TResponse = unknown,
> {
  path: string;
  method: HttpMethod;
  handler: RouteHandler<TBody, TParams, TQuery, TResponse>;
  middleware?: MiddlewareHandler[];
  validation?: RouteValidationSchemas<TBody, TParams, TQuery>;
  auth?: AuthConfig;
  rateLimit?: RateLimitConfig;
  cache?: CacheConfig;
  description?: string;
  tags?: string[];
}

/**
 * HTTP Methods
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

/**
 * Authentication Configuration
 */
export interface AuthConfig {
  required: boolean;
  roles?: UserRole[];
  permissions?: string[];
  skipForGuests?: boolean;
}

/**
 * Rate Limiting Configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Cache Configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  key?: string | ((req: Request) => string);
  invalidateOn?: string[]; // Event names that invalidate cache
  varyBy?: string[]; // Headers/query params to vary cache by
}

// ========================================
// Pagination & Filtering Types
// ========================================

/**
 * Pagination Query Parameters
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Filter Operators
 */
export enum FilterOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'nin',
  CONTAINS = 'contains',
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
  BETWEEN = 'between',
}

/**
 * Filter Condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Sort Configuration
 */
export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}

// ========================================
// Error Code Constants
// ========================================

export enum ApiErrorCode {
  // Client Errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',

  // Server Errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',

  // Domain-Specific Errors
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  NOSTR_ERROR = 'NOSTR_ERROR',
  LIGHTNING_ERROR = 'LIGHTNING_ERROR',
}

/**
 * HTTP Status Code to Error Code Mapping
 */
export const HTTP_STATUS_TO_ERROR_CODE: Record<number, ApiErrorCode> = {
  400: ApiErrorCode.BAD_REQUEST,
  401: ApiErrorCode.UNAUTHORIZED,
  403: ApiErrorCode.FORBIDDEN,
  404: ApiErrorCode.NOT_FOUND,
  405: ApiErrorCode.METHOD_NOT_ALLOWED,
  409: ApiErrorCode.CONFLICT,
  422: ApiErrorCode.UNPROCESSABLE_ENTITY,
  429: ApiErrorCode.RATE_LIMIT_EXCEEDED,
  500: ApiErrorCode.INTERNAL_SERVER_ERROR,
  501: ApiErrorCode.NOT_IMPLEMENTED,
  503: ApiErrorCode.SERVICE_UNAVAILABLE,
  504: ApiErrorCode.GATEWAY_TIMEOUT,
};

// ========================================
// Response Helper Types
// ========================================

/**
 * Success Response Builder
 */
export interface SuccessResponseBuilder<T = unknown> {
  data: T;
  meta?: Partial<ApiMeta>;
}

/**
 * Error Response Builder
 */
export interface ErrorResponseBuilder {
  code: ApiErrorCode | string;
  message: string;
  details?: Record<string, unknown>;
  validationErrors?: ValidationError[];
  statusCode?: number;
}

// ========================================
// Webhook Types
// ========================================

/**
 * Webhook Event
 */
export interface WebhookEvent<TPayload = unknown> {
  id: string;
  type: string;
  timestamp: number;
  payload: TPayload;
  signature?: string;
  source?: string;
}

/**
 * Webhook Handler
 */
export type WebhookHandler<TPayload = unknown> = (
  event: WebhookEvent<TPayload>,
  req: Request,
  res: Response
) => Promise<void>;

// ========================================
// API Versioning Types
// ========================================

/**
 * API Version
 */
export enum ApiVersion {
  V1 = 'v1',
  V2 = 'v2',
}

/**
 * Versioned Route Config
 */
export interface VersionedRouteConfig<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>,
  TResponse = unknown,
> extends RouteConfig<TBody, TParams, TQuery, TResponse> {
  version: ApiVersion;
  deprecated?: boolean;
  deprecationDate?: string;
  replacedBy?: string;
}

// ========================================
// Utility Types
// ========================================

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Extract Body Type from Route Handler
 */
export type ExtractBody<T> = T extends RouteHandler<infer TBody, any, any, any> ? TBody : never;

/**
 * Extract Response Type from Route Handler
 */
export type ExtractResponse<T> =
  T extends RouteHandler<any, any, any, infer TResponse> ? TResponse : never;

/**
 * Extract Params Type from Route Handler
 */
export type ExtractParams<T> =
  T extends RouteHandler<any, infer TParams, any, any> ? TParams : never;

/**
 * Extract Query Type from Route Handler
 */
export type ExtractQuery<T> = T extends RouteHandler<any, any, infer TQuery, any> ? TQuery : never;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Async Handler Wrapper Result
 */
export type AsyncHandlerResult<T> = Promise<T | void>;

/**
 * Route Handler with Error Handling
 */
export type SafeRouteHandler<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, string>,
  TResponse = unknown,
> = (
  req: TypedRequest<TBody, TParams, TQuery>,
  res: TypedResponse<TResponse>,
  next: NextFunction
) => AsyncHandlerResult<Response>;

// ========================================
// Health Check Types
// ========================================

/**
 * Health Check Status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Service Health
 */
export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  lastChecked: number;
  error?: string;
}

/**
 * Health Check Response
 */
export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: number;
  uptime: number;
  version: string;
  services: ServiceHealth[];
}

// ========================================
// Specific API Endpoint Types
// ========================================

/**
 * Authentication API Types
 */
export namespace AuthAPI {
  // Challenge Request/Response
  export interface ChallengeResponse {
    challenge: string;
    timestamp: number;
    expires_at: number;
    message: string;
  }

  // Authenticate Request/Response
  export interface AuthenticateRequest {
    nostr_pubkey: string;
    challenge: string;
    timestamp: number;
    signature: string;
    role?: 'creator' | 'supporter' | 'admin';
  }

  export interface AuthenticateResponse {
    token: string;
    user: {
      nostr_pubkey: string;
      role: 'creator' | 'supporter' | 'admin';
      signature_verified: boolean;
    };
    expires_in: string;
  }

  // Refresh Request/Response
  export interface RefreshResponse {
    token: string;
    expires_in: string;
  }

  // Verify Response
  export interface VerifyResponse {
    user: {
      nostr_pubkey: string;
      role: string;
      signature_verified: boolean;
      iat: number;
      exp: number;
    };
    valid: boolean;
  }

  // Stats Response
  export interface StatsResponse {
    activeChallenges: number;
    jwtExpiresIn: string;
    challengeTTL: string;
    timestamp: number;
  }

  // Health Response
  export interface HealthResponse {
    status: 'healthy' | 'unhealthy';
    service: string;
    timestamp: number;
    challenge_generated: boolean;
  }

  // Route Handlers
  export type ChallengeHandler = AsyncRouteHandler<never, never, never, ChallengeResponse>;
  export type AuthenticateHandler = AsyncRouteHandler<
    AuthenticateRequest,
    never,
    never,
    AuthenticateResponse
  >;
  export type RefreshHandler = AsyncRouteHandler<never, never, never, RefreshResponse>;
  export type VerifyHandler = AsyncRouteHandler<never, never, never, VerifyResponse>;
  export type LogoutHandler = AsyncRouteHandler<
    never,
    never,
    never,
    { message: string; instructions: string }
  >;
  export type StatsHandler = AsyncRouteHandler<never, never, never, StatsResponse>;
  export type HealthHandler = AsyncRouteHandler<never, never, never, HealthResponse>;
}

/**
 * NOSTR API Types
 */
export namespace NostrAPI {
  // Event Publishing
  export interface PublishEventRequest {
    event: {
      kind: number;
      content: string;
      tags: string[][];
      created_at?: number;
    };
    relays?: string[];
  }

  export interface PublishEventResponse {
    success: boolean;
    eventId: string;
    relays: {
      url: string;
      success: boolean;
      error?: string;
    }[];
  }

  // Event Query
  export interface QueryEventsRequest {
    filters: {
      ids?: string[];
      authors?: string[];
      kinds?: number[];
      since?: number;
      until?: number;
      limit?: number;
    }[];
    relays?: string[];
  }

  export interface QueryEventsResponse {
    events: Array<{
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }>;
    relays: string[];
  }

  // Relay Management
  export interface AddRelayRequest {
    url: string;
    read: boolean;
    write: boolean;
  }

  export interface RelayInfo {
    url: string;
    state: 'connected' | 'disconnected' | 'connecting' | 'error';
    read: boolean;
    write: boolean;
    lastConnected?: number;
    lastError?: string;
  }

  // Route Handlers
  export type PublishEventHandler = AsyncRouteHandler<
    PublishEventRequest,
    never,
    never,
    PublishEventResponse
  >;
  export type QueryEventsHandler = AsyncRouteHandler<
    QueryEventsRequest,
    never,
    never,
    QueryEventsResponse
  >;
  export type AddRelayHandler = AsyncRouteHandler<AddRelayRequest, never, never, RelayInfo>;
  export type GetRelaysHandler = AsyncRouteHandler<never, never, never, RelayInfo[]>;
}

/**
 * Lightning Network API Types
 */
export namespace LightningAPI {
  // Invoice Creation
  export interface CreateInvoiceRequest {
    amount: number;
    description: string;
    expiry?: number;
    metadata?: Record<string, unknown>;
  }

  export interface CreateInvoiceResponse {
    paymentHash: string;
    paymentRequest: string;
    amount: number;
    description: string;
    expiresAt: number;
    createdAt: number;
  }

  // Invoice Status
  export interface InvoiceStatusParams {
    paymentHash: string;
  }

  export interface InvoiceStatusResponse {
    paymentHash: string;
    status: 'pending' | 'paid' | 'expired' | 'cancelled';
    amount: number;
    paidAt?: number;
    expiresAt: number;
  }

  // Payment
  export interface MakePaymentRequest {
    paymentRequest: string;
    amount?: number;
  }

  export interface MakePaymentResponse {
    paymentHash: string;
    status: 'success' | 'failed';
    preimage?: string;
    amount: number;
    fee: number;
    timestamp: number;
  }

  // Subscription
  export interface CreateSubscriptionRequest {
    creatorId: string;
    tier: string;
    amount: number;
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly';
  }

  export interface SubscriptionResponse {
    id: string;
    userId: string;
    creatorId: string;
    tier: string;
    amount: number;
    interval: string;
    status: 'active' | 'cancelled' | 'expired';
    nextPaymentAt: number;
    createdAt: number;
  }

  // Payment History
  export interface PaymentHistoryItem {
    id: string;
    type: 'payment' | 'invoice';
    amount: number;
    status: string;
    timestamp: number;
    description: string;
  }

  // Payout
  export interface ProcessPayoutRequest {
    amount: number;
    destination: string;
  }

  export interface PayoutResponse {
    id: string;
    creatorId: string;
    amount: number;
    destination: string;
    status: 'pending' | 'completed' | 'failed';
    processedAt?: number;
    createdAt: number;
  }

  // Node Info
  export interface NodeInfoResponse {
    alias: string;
    pubkey: string;
    version: string;
    numChannels: number;
    numPeers: number;
    blockHeight: number;
  }

  // Route Handlers
  export type GetNodeInfoHandler = AsyncRouteHandler<never, never, never, NodeInfoResponse>;
  export type CreateInvoiceHandler = AsyncRouteHandler<
    CreateInvoiceRequest,
    never,
    never,
    CreateInvoiceResponse
  >;
  export type CheckInvoiceHandler = AsyncRouteHandler<
    never,
    InvoiceStatusParams,
    never,
    InvoiceStatusResponse
  >;
  export type MakePaymentHandler = AsyncRouteHandler<
    MakePaymentRequest,
    never,
    never,
    MakePaymentResponse
  >;
  export type CreateSubscriptionHandler = AsyncRouteHandler<
    CreateSubscriptionRequest,
    never,
    never,
    SubscriptionResponse
  >;
  export type CancelSubscriptionHandler = AsyncRouteHandler<
    never,
    { subscriptionId: string },
    never,
    SubscriptionResponse
  >;
  export type GetPaymentHistoryHandler = AsyncRouteHandler<
    never,
    never,
    never,
    PaymentHistoryItem[]
  >;
  export type GetSubscriptionsHandler = AsyncRouteHandler<
    never,
    never,
    never,
    SubscriptionResponse[]
  >;
  export type ProcessPayoutHandler = AsyncRouteHandler<
    ProcessPayoutRequest,
    never,
    never,
    PayoutResponse
  >;
  export type GetPayoutsHandler = AsyncRouteHandler<never, never, never, PayoutResponse[]>;
}

/**
 * Content API Types
 */
export namespace ContentAPI {
  export interface CreateContentRequest {
    title: string;
    content: string;
    type: 'post' | 'article' | 'video' | 'audio';
    tags?: string[];
    metadata?: Record<string, unknown>;
    monetization?: {
      enabled: boolean;
      price?: number;
      tier?: string;
    };
  }

  export interface ContentResponse {
    id: string;
    authorPubkey: string;
    title: string;
    content: string;
    type: string;
    tags: string[];
    createdAt: number;
    updatedAt: number;
    nostrEventId?: string;
  }

  export type CreateContentHandler = AsyncRouteHandler<
    CreateContentRequest,
    never,
    never,
    ContentResponse
  >;
  export type GetContentHandler = AsyncRouteHandler<never, { id: string }, never, ContentResponse>;
  export type UpdateContentHandler = AsyncRouteHandler<
    Partial<CreateContentRequest>,
    { id: string },
    never,
    ContentResponse
  >;
  export type DeleteContentHandler = AsyncRouteHandler<
    never,
    { id: string },
    never,
    { success: boolean }
  >;
  export type ListContentHandler = AsyncRouteHandler<
    never,
    never,
    PaginationQuery,
    PaginatedResponse<ContentResponse>
  >;
}

/**
 * User API Types
 */
export namespace UserAPI {
  export interface UserProfile {
    id: string;
    nostrPubkey: string;
    username?: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
    website?: string;
    nip05?: string;
    lud16?: string;
    createdAt: number;
    updatedAt: number;
  }

  export interface UpdateProfileRequest {
    username?: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
    website?: string;
    nip05?: string;
    lud16?: string;
  }

  export type GetProfileHandler = AsyncRouteHandler<never, { pubkey: string }, never, UserProfile>;
  export type UpdateProfileHandler = AsyncRouteHandler<
    UpdateProfileRequest,
    never,
    never,
    UserProfile
  >;
  export type GetCurrentUserHandler = AsyncRouteHandler<never, never, never, UserProfile>;
}

// ========================================
// Export All Schemas
// ========================================

export const ApiHandlerSchemas = {
  PaginationQuery: PaginationQuerySchema,
} as const;
