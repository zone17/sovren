import { z } from 'zod';

// Export all type modules
export * from './nostr';
export * from './user';
export * from './quality-metrics';
export * from './nostr-key-management';
export * from './api-handlers';
export * from './payment-state';
export * from './nostr-service';

// Export config utilities
export * from '../config';

// Post types
export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  published: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  authorId: z.string(),
});

export type Post = z.infer<typeof PostSchema>;

// Payment types
export const PaymentSchema = z.object({
  id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['pending', 'completed', 'failed']),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string(),
  postId: z.string(),
  invoice: z.string().optional(),
  preimage: z.string().optional(),
});

export type Payment = z.infer<typeof PaymentSchema>;

// API Response types
export const ApiResponseSchema = <T extends z.ZodType>(
  dataSchema: T
): z.ZodObject<{
  success: z.ZodBoolean;
  data: z.ZodOptional<T>;
  error: z.ZodOptional<z.ZodString>;
  message: z.ZodOptional<z.ZodString>;
  timestamp: z.ZodOptional<z.ZodString>;
}> =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    timestamp: z.string().optional(),
  });

export type ApiResponse<T> = z.infer<ReturnType<typeof ApiResponseSchema<z.ZodType<T>>>>;

// Pagination types
export const PaginationSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().min(1).max(100).default(20),
  total: z.number().nonnegative(),
  totalPages: z.number().nonnegative(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

// Paginated response
export const PaginatedResponseSchema = <T extends z.ZodType>(
  dataSchema: T
) =>
  z.object({
    success: z.boolean(),
    data: z.array(dataSchema),
    pagination: PaginationSchema,
    error: z.string().optional(),
    message: z.string().optional(),
    timestamp: z.string().optional(),
  });

export type PaginatedResponse<T> = z.infer<ReturnType<typeof PaginatedResponseSchema<z.ZodType<T>>>>;
