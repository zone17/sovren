import { z } from 'zod';

// User types
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  nostrPubkey: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

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
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T): z.ZodObject<any> =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  });

export type ApiResponse<T> = z.infer<ReturnType<typeof ApiResponseSchema<z.ZodType<T>>>>;
