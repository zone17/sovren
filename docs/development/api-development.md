# API Development Guide

**Epic 005 Backend Service Refactoring - Creating RESTful APIs**

---

## Table of Contents

1. [API Architecture](#api-architecture)
2. [Route Definition](#route-definition)
3. [Controller Implementation](#controller-implementation)
4. [DTO Creation](#dto-creation)
5. [Validation](#validation)
6. [Middleware](#middleware)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Documentation](#documentation)
10. [Best Practices](#best-practices)

---

## API Architecture

### RESTful Principles

```
HTTP Method | CRUD Operation | Example Endpoint
------------|----------------|------------------
GET         | Read           | GET /api/v1/users/:id
POST        | Create         | POST /api/v1/users
PUT         | Update (Full)  | PUT /api/v1/users/:id
PATCH       | Update (Partial)| PATCH /api/v1/users/:id
DELETE      | Delete         | DELETE /api/v1/users/:id
```

### API Versioning

```
/api/v1/*  - Current stable API
/api/v2/*  - Next version (if breaking changes)
```

---

## Route Definition

### Express Router Setup

```typescript
// packages/backend/src/routes/payments.ts
import { Router } from 'express';
import { container } from '@/container';
import { PaymentController } from '@/controllers/PaymentController';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { rateLimit } from '@/middleware/rateLimit';
import { createPaymentSchema, updatePaymentSchema } from '@/validators/payment';

const router = Router();
const controller = container.get<PaymentController>('PaymentController');

// Create payment
router.post(
  '/',
  authenticate,
  rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }),
  validateRequest(createPaymentSchema),
  controller.createPayment.bind(controller)
);

// Get payment by ID
router.get('/:id', authenticate, controller.getPayment.bind(controller));

// List payments
router.get('/', authenticate, controller.listPayments.bind(controller));

// Update payment
router.patch(
  '/:id',
  authenticate,
  validateRequest(updatePaymentSchema),
  controller.updatePayment.bind(controller)
);

// Cancel payment
router.delete('/:id', authenticate, controller.cancelPayment.bind(controller));

export default router;
```

### Route Organization

```
packages/backend/src/routes/
├── index.ts              # Main router (aggregates all routes)
├── auth.ts              # Authentication routes
├── users.ts             # User management
├── content.ts           # Content CRUD
├── payments.ts          # Payment operations
├── subscriptions.ts     # Subscription management
└── webhooks.ts          # Webhook handlers
```

---

## Controller Implementation

### Controller Template

```typescript
// packages/backend/src/controllers/PaymentController.ts
import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { IPaymentService } from '@/interfaces/payment/IPaymentService';
import { ILogger } from '@/interfaces/ILogger';
import { CreatePaymentDTO, UpdatePaymentDTO } from '@/dtos/payment';
import { ApiResponse } from '@/types/api';

@injectable()
export class PaymentController {
  constructor(
    @inject('IPaymentService') private readonly paymentService: IPaymentService,
    @inject('ILogger') private readonly logger: ILogger
  ) {}

  /**
   * Create new payment
   * POST /api/v1/payments
   */
  async createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: CreatePaymentDTO = req.body;
      const userId = req.user!.id;

      this.logger.info('Creating payment', { userId, amount: dto.amount });

      const payment = await this.paymentService.createPayment({
        ...dto,
        userId,
      });

      const response: ApiResponse = {
        success: true,
        data: payment,
        message: 'Payment created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment by ID
   * GET /api/v1/payments/:id
   */
  async getPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const payment = await this.paymentService.getPayment(id, userId);

      if (!payment) {
        res.status(404).json({
          success: false,
          error: { message: 'Payment not found', code: 'NOT_FOUND' },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List payments with pagination
   * GET /api/v1/payments?page=1&limit=20
   */
  async listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.paymentService.listPayments(userId, {
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result.payments,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
```

---

## DTO Creation

### Data Transfer Objects

```typescript
// packages/backend/src/dtos/payment.ts

/**
 * DTO for creating a payment
 */
export interface CreatePaymentDTO {
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * DTO for updating a payment
 */
export interface UpdatePaymentDTO {
  status?: 'pending' | 'completed' | 'failed' | 'canceled';
  metadata?: Record<string, any>;
}

/**
 * DTO for payment response
 */
export interface PaymentResponseDTO {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoice: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * DTO for payment list query
 */
export interface ListPaymentsQueryDTO {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}
```

### DTO Mapping

```typescript
// Map domain entity to DTO
export function toPaymentDTO(payment: Payment): PaymentResponseDTO {
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    invoice: payment.invoice,
    expiresAt: payment.expiresAt,
    createdAt: payment.createdAt,
  };
  // Exclude: userId, privateMetadata, internalStatus
}
```

---

## Validation

### Zod Schema Definition

```typescript
// packages/backend/src/validators/payment.ts
import { z } from 'zod';

export const createPaymentSchema = z.object({
  body: z.object({
    amount: z
      .number()
      .positive('Amount must be positive')
      .max(100_000_000, 'Amount exceeds maximum (1 BTC)'),

    currency: z.enum(['BTC', 'USD', 'EUR', 'GBP']).default('BTC'),

    description: z.string().min(1).max(500).optional(),

    metadata: z.record(z.any()).optional(),
  }),
});

export const updatePaymentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid payment ID'),
  }),

  body: z.object({
    status: z.enum(['pending', 'completed', 'failed', 'canceled']).optional(),

    metadata: z.record(z.any()).optional(),
  }),
});

export const listPaymentsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0, 'Page must be positive')
      .default('1'),

    limit: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => val > 0 && val <= 100, 'Limit must be 1-100')
      .default('20'),

    status: z.enum(['pending', 'completed', 'failed', 'canceled']).optional(),
  }),
});
```

### Validation Middleware

```typescript
// packages/backend/src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateRequest(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace with validated data
      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
        });
      } else {
        next(error);
      }
    }
  };
}
```

---

## Middleware

### Authentication Middleware

```typescript
// packages/backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: { message: 'No authentication token provided', code: 'UNAUTHORIZED' },
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded as any;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' },
    });
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}
```

### Rate Limiting

```typescript
// packages/backend/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '@/config/redis';

export function createRateLimiter(options: { max: number; windowMs: number; message?: string }) {
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:',
    }),
    max: options.max,
    windowMs: options.windowMs,
    message: {
      success: false,
      error: {
        message: options.message || 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
}

// Usage
export const apiRateLimit = createRateLimiter({
  max: 100,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const authRateLimit = createRateLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Too many login attempts',
});
```

---

## Error Handling

### Global Error Handler

```typescript
// packages/backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ServiceError } from '@/types/errors';

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
  // Log error
  console.error('Error:', error);

  // Handle known errors
  if (error instanceof ServiceError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
      },
    });
    return;
  }

  // Handle unexpected errors
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
}
```

---

## Testing

### Integration Test Example

```typescript
// packages/backend/src/routes/__tests__/payments.integration.test.ts
import request from 'supertest';
import { app } from '@/app';
import { generateAuthToken } from '@/test-utils/auth';

describe('Payment API', () => {
  let authToken: string;

  beforeAll(async () => {
    authToken = await generateAuthToken({ id: 'user123' });
  });

  describe('POST /api/v1/payments', () => {
    it('should create payment successfully', async () => {
      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 10000,
          currency: 'BTC',
          description: 'Test payment',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.amount).toBe(10000);
    });

    it('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: -100,
          currency: 'BTC',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      await request(app).post('/api/v1/payments').send({ amount: 10000 }).expect(401);
    });
  });
});
```

---

## Documentation

### OpenAPI/Swagger Specification

```yaml
# packages/backend/docs/api/payments.yaml
openapi: 3.0.0
info:
  title: Sovren Payment API
  version: 1.0.0
  description: Lightning Network payment operations

paths:
  /api/v1/payments:
    post:
      summary: Create payment
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreatePaymentRequest'
      responses:
        '201':
          description: Payment created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaymentResponse'
        '400':
          $ref: '#/components/responses/ValidationError'
        '401':
          $ref: '#/components/responses/Unauthorized'

components:
  schemas:
    CreatePaymentRequest:
      type: object
      required:
        - amount
        - currency
      properties:
        amount:
          type: number
          minimum: 1
          maximum: 100000000
        currency:
          type: string
          enum: [BTC, USD, EUR, GBP]
        description:
          type: string
          maxLength: 500

    PaymentResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          $ref: '#/components/schemas/Payment'

    Payment:
      type: object
      properties:
        id:
          type: string
          format: uuid
        amount:
          type: number
        currency:
          type: string
        status:
          type: string
          enum: [pending, completed, failed, canceled]
        invoice:
          type: string
        expiresAt:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time
```

---

## Best Practices

### 1. Use Proper HTTP Status Codes

```typescript
// ✅ GOOD
res.status(201).json({ success: true, data: created });  // Created
res.status(404).json({ success: false, error: ... });    // Not Found
res.status(422).json({ success: false, error: ... });    // Unprocessable

// ❌ BAD
res.status(200).json({ error: 'Not found' });  // Wrong status
```

### 2. Consistent Response Format

```typescript
// ✅ GOOD: Consistent structure
{
  "success": true,
  "data": { ... },
  "pagination": { ... }
}

// ❌ BAD: Inconsistent
{ "result": { ... } }  // Sometimes
{ "data": { ... } }    // Other times
```

### 3. Validate Input Early

```typescript
// ✅ GOOD: Middleware validation
router.post('/', validateRequest(schema), controller.create);

// ❌ BAD: Late validation in controller
async create(req, res) {
  if (!req.body.amount) throw new Error('Amount required');
}
```

---

**Next**: [Testing Guide](/docs/development/testing-guide.md)

---

**Last Updated**: 2025-10-27
**Epic**: Epic 005 - Backend Service Refactoring
**Story**: US-E5-039 - Developer Documentation
