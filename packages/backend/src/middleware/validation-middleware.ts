/**
 * Validation Middleware for API Routes
 *
 * Provides Zod schema validation for request body, query params, and path params
 * Integrates with controllers for type-safe request handling
 */

import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, z, ZodError, ZodSchema } from 'zod';
import logger from '../lib/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// ============================================================================
// Validation Middleware Factory
// ============================================================================

/**
 * Creates validation middleware for Express routes
 *
 * @param schemas - Zod schemas for body, query, and params validation
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.post('/content/publish',
 *   validate({
 *     body: PublishContentSchema,
 *     query: PaginationSchema,
 *   }),
 *   contentController.publish
 * );
 * ```
 */
export const validate = (schemas: ValidationTargets) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors: ValidationError[] = [];
    const startTime = Date.now();

    try {
      // Validate request body
      if (schemas.body) {
        try {
          req.body = await schemas.body.parseAsync(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodErrors(error, 'body'));
          }
        }
      }

      // Validate query parameters
      if (schemas.query) {
        try {
          req.query = await schemas.query.parseAsync(req.query) as any;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodErrors(error, 'query'));
          }
        }
      }

      // Validate path parameters
      if (schemas.params) {
        try {
          req.params = await schemas.params.parseAsync(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodErrors(error, 'params'));
          }
        }
      }

      // If validation errors exist, return 400
      if (errors.length > 0) {
        const validationTime = Date.now() - startTime;

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors,
          metadata: {
            timestamp: new Date().toISOString(),
            validationTime: `${validationTime}ms`,
          },
        });
        return;
      }

      // Validation successful, continue to controller
      next();
    } catch (error) {
      // Unexpected validation error
      logger.error('Validation middleware error', { error });

      res.status(500).json({
        success: false,
        error: 'Validation system error',
        code: 'VALIDATION_SYSTEM_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format Zod validation errors into a consistent structure
 */
function formatZodErrors(error: ZodError, location: string): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.length > 0 ? `${location}.${err.path.join('.')}` : location,
    message: err.message,
    code: err.code,
  }));
}

// ============================================================================
// Common Validation Schemas
// ============================================================================

/**
 * Standard pagination schema for GET endpoints
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * UUID parameter validation
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Time range schema for analytics endpoints
 */
export const timeRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});

// ============================================================================
// Validation Helper Utilities
// ============================================================================

/**
 * Manually validate data against a schema (for use in services/controllers)
 */
export async function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: ValidationError[] }> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        errors: formatZodErrors(error, 'data'),
      };
    }
    throw error;
  }
}

/**
 * Safe parse with default value
 */
export function parseWithDefault<T>(schema: ZodSchema<T>, data: unknown, defaultValue: T): T {
  try {
    return schema.parse(data);
  } catch (error) {
    logger.warn('Validation failed, using default', { error });
    return defaultValue;
  }
}

// ============================================================================
// Custom Validators
// ============================================================================

/**
 * Validate NOSTR public key format (64 hex characters)
 */
export const nostrPubkeyValidator = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, 'Invalid NOSTR public key format (must be 64 hex characters)');

/**
 * Validate npub format
 */
export const npubValidator = z
  .string()
  .regex(/^npub[0-9a-z]{59}$/, 'Invalid npub format');

/**
 * Validate Lightning invoice (BOLT11)
 */
export const bolt11Validator = z
  .string()
  .regex(/^ln(bc|tb)[0-9a-z]+$/, 'Invalid Lightning invoice format');

/**
 * Validate Bitcoin amount (satoshis)
 */
export const satoshiAmountValidator = z
  .number()
  .int()
  .min(1)
  .max(21_000_000_000_000) // Max Bitcoin supply in sats
  .describe('Amount in satoshis');

/**
 * Validate URL with specific protocols
 */
export const secureUrlValidator = z
  .string()
  .url()
  .refine((url) => url.startsWith('https://') || url.startsWith('wss://'), {
    message: 'Only HTTPS and WSS URLs are allowed',
  });

// ============================================================================
// Request Sanitization
// ============================================================================

/**
 * Sanitize string input to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitization middleware for all string inputs
 */
export const sanitizeInputs = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize body strings
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query strings
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query) as any;
    }

    next();
  } catch (error) {
    logger.error('Sanitization error', { error });
    next(); // Continue even if sanitization fails
  }
};

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

// ============================================================================
// Simple Request Validation (consolidated from validation.ts)
// ============================================================================

/**
 * Middleware for validating request body against a Zod schema.
 * Simpler alternative to `validate()` when only body validation is needed.
 */
export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error: any) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors || error.message,
      });
    }
  };
};

// ============================================================================
// Export Middleware Stack
// ============================================================================

/**
 * Standard validation middleware stack for all routes
 */
export const validationMiddlewareStack = [
  sanitizeInputs,
  // Add other validation middleware here
];
