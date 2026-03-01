/**
 * 🧪 API Handler Types Tests
 * Validates type safety and schema validation for API handlers
 */

import { z } from 'zod';
import {
  TypedRequest,
  ApiResponse,
  PaginationQuerySchema,
  ApiErrorCode,
  UserRole,
  AuthenticatedUser,
  RouteValidationSchemas,
  PaginatedResponse,
  HealthStatus,
  HealthCheckResponse,
  ValidationResult,
} from '../api-handlers';

describe('API Handler Types', () => {
  describe('PaginationQuerySchema', () => {
    it('should validate valid pagination query', () => {
      const validQuery = {
        page: '1',
        limit: '20',
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };

      const result = PaginationQuerySchema.safeParse(validQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortBy).toBe('createdAt');
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should apply default values', () => {
      const minimalQuery = {};

      const result = PaginationQuerySchema.safeParse(minimalQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should enforce minimum values', () => {
      const invalidQuery = {
        page: '0',
        limit: '0',
      };

      const result = PaginationQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it('should enforce maximum limit', () => {
      const invalidQuery = {
        limit: '1000',
      };

      const result = PaginationQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });

    it('should validate sort order enum', () => {
      const invalidQuery = {
        sortOrder: 'invalid',
      };

      const result = PaginationQuerySchema.safeParse(invalidQuery);
      expect(result.success).toBe(false);
    });
  });

  describe('ApiResponse', () => {
    it('should create success response', () => {
      const response: ApiResponse<{ id: string }> = {
        success: true,
        data: { id: '123' },
        timestamp: Date.now(),
      };

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: '123' });
      expect(response.error).toBeUndefined();
    });

    it('should create error response', () => {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ApiErrorCode.NOT_FOUND,
          message: 'Resource not found',
        },
        timestamp: Date.now(),
      };

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ApiErrorCode.NOT_FOUND);
      expect(response.data).toBeUndefined();
    });

    it('should include metadata', () => {
      const response: ApiResponse<string[]> = {
        success: true,
        data: ['item1', 'item2'],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
        timestamp: Date.now(),
      };

      expect(response.meta?.pagination?.total).toBe(2);
    });
  });

  describe('AuthenticatedUser', () => {
    it('should create authenticated user with all fields', () => {
      const user: AuthenticatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        nostrPubkey: 'a'.repeat(64),
        role: UserRole.CREATOR,
        permissions: ['create:content', 'edit:content'],
        sessionId: 'session-456',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      expect(user.role).toBe(UserRole.CREATOR);
      expect(user.permissions).toHaveLength(2);
    });

    it('should create minimal authenticated user', () => {
      const user: AuthenticatedUser = {
        id: 'user-123',
        role: UserRole.USER,
        permissions: [],
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      expect(user.id).toBe('user-123');
      expect(user.email).toBeUndefined();
      expect(user.nostrPubkey).toBeUndefined();
    });
  });

  describe('PaginatedResponse', () => {
    it('should create paginated response', () => {
      const response: PaginatedResponse<{ id: string }> = {
        items: [{ id: '1' }, { id: '2' }],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      expect(response.items).toHaveLength(2);
      expect(response.pagination.hasNext).toBe(false);
    });

    it('should indicate next page availability', () => {
      const response: PaginatedResponse<number> = {
        items: Array.from({ length: 20 }, (_, i) => i),
        pagination: {
          page: 1,
          limit: 20,
          total: 50,
          totalPages: 3,
          hasNext: true,
          hasPrev: false,
        },
      };

      expect(response.pagination.hasNext).toBe(true);
      expect(response.pagination.totalPages).toBe(3);
    });
  });

  describe('HealthCheckResponse', () => {
    it('should create healthy status', () => {
      const health: HealthCheckResponse = {
        status: HealthStatus.HEALTHY,
        timestamp: Date.now(),
        uptime: 3600,
        version: '1.0.0',
        services: [
          {
            name: 'database',
            status: HealthStatus.HEALTHY,
            responseTime: 15,
            lastChecked: Date.now(),
          },
          {
            name: 'redis',
            status: HealthStatus.HEALTHY,
            responseTime: 5,
            lastChecked: Date.now(),
          },
        ],
      };

      expect(health.status).toBe(HealthStatus.HEALTHY);
      expect(health.services).toHaveLength(2);
      expect(health.services.every((s) => s.status === HealthStatus.HEALTHY)).toBe(true);
    });

    it('should create degraded status', () => {
      const health: HealthCheckResponse = {
        status: HealthStatus.DEGRADED,
        timestamp: Date.now(),
        uptime: 3600,
        version: '1.0.0',
        services: [
          {
            name: 'database',
            status: HealthStatus.HEALTHY,
            responseTime: 15,
            lastChecked: Date.now(),
          },
          {
            name: 'redis',
            status: HealthStatus.DEGRADED,
            responseTime: 500,
            lastChecked: Date.now(),
            error: 'High latency detected',
          },
        ],
      };

      expect(health.status).toBe(HealthStatus.DEGRADED);
      expect(health.services.find((s) => s.name === 'redis')?.error).toBeDefined();
    });

    it('should create unhealthy status', () => {
      const health: HealthCheckResponse = {
        status: HealthStatus.UNHEALTHY,
        timestamp: Date.now(),
        uptime: 3600,
        version: '1.0.0',
        services: [
          {
            name: 'database',
            status: HealthStatus.UNHEALTHY,
            lastChecked: Date.now(),
            error: 'Connection refused',
          },
        ],
      };

      expect(health.status).toBe(HealthStatus.UNHEALTHY);
      expect(health.services[0].error).toBe('Connection refused');
    });
  });

  describe('ValidationResult', () => {
    it('should create successful validation result', () => {
      const result: ValidationResult<{ email: string }> = {
        success: true,
        data: { email: 'test@example.com' },
      };

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('test@example.com');
      expect(result.errors).toBeUndefined();
    });

    it('should create failed validation result', () => {
      const result: ValidationResult = {
        success: false,
        errors: [
          {
            field: 'email',
            message: 'Invalid email format',
            code: 'INVALID_EMAIL',
            value: 'not-an-email',
          },
        ],
      };

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.data).toBeUndefined();
    });
  });

  describe('RouteValidationSchemas', () => {
    it('should define validation schemas for route', () => {
      const schemas: RouteValidationSchemas<{ email: string }, { id: string }, { limit: string }> =
        {
          body: z.object({
            email: z.string().email(),
          }),
          params: z.object({
            id: z.string().uuid(),
          }),
          query: z.object({
            limit: z.string(),
          }),
        };

      // Test body validation
      const bodyResult = schemas.body?.safeParse({ email: 'test@example.com' });
      expect(bodyResult?.success).toBe(true);

      // Test params validation
      const paramsResult = schemas.params?.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(paramsResult?.success).toBe(true);

      // Test query validation
      const queryResult = schemas.query?.safeParse({ limit: '20' });
      expect(queryResult?.success).toBe(true);
    });

    it('should fail invalid validations', () => {
      const schemas: RouteValidationSchemas<{ email: string }> = {
        body: z.object({
          email: z.string().email(),
        }),
      };

      const result = schemas.body?.safeParse({ email: 'invalid' });
      expect(result?.success).toBe(false);
    });
  });

  describe('ApiErrorCode', () => {
    it('should have all standard HTTP error codes', () => {
      expect(ApiErrorCode.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ApiErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ApiErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(ApiErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ApiErrorCode.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should have domain-specific error codes', () => {
      expect(ApiErrorCode.AUTHENTICATION_FAILED).toBe('AUTHENTICATION_FAILED');
      expect(ApiErrorCode.PAYMENT_REQUIRED).toBe('PAYMENT_REQUIRED');
      expect(ApiErrorCode.NOSTR_ERROR).toBe('NOSTR_ERROR');
      expect(ApiErrorCode.LIGHTNING_ERROR).toBe('LIGHTNING_ERROR');
    });
  });

  describe('UserRole', () => {
    it('should define all user roles', () => {
      expect(UserRole.ADMIN).toBe('admin');
      expect(UserRole.CREATOR).toBe('creator');
      expect(UserRole.USER).toBe('user');
      expect(UserRole.GUEST).toBe('guest');
    });
  });

  describe('Type Safety', () => {
    it('should enforce typed request structure', () => {
      interface TestBody {
        name: string;
      }
      interface TestParams {
        id: string;
      }
      interface TestQuery {
        filter: string;
      }

      const mockRequest = {
        body: { name: 'test' },
        params: { id: '123' },
        query: { filter: 'active' },
      } as TypedRequest<TestBody, TestParams, TestQuery>;

      expect(mockRequest.body.name).toBe('test');
      expect(mockRequest.params.id).toBe('123');
      expect(mockRequest.query.filter).toBe('active');
    });

    it('should enforce typed response structure', () => {
      interface TestResponse {
        id: string;
        name: string;
      }

      const mockResponse: ApiResponse<TestResponse> = {
        success: true,
        data: {
          id: '123',
          name: 'test',
        },
        timestamp: Date.now(),
      };

      expect(mockResponse.data?.id).toBe('123');
      expect(mockResponse.data?.name).toBe('test');
    });
  });
});
