/**
 * Community API Validation Schemas — #270, #283
 * Zod schemas for all EPIC-010 endpoint bodies.
 * Matches the finance.ts pattern from EPIC-011 for consistency.
 */

import { z } from 'zod';

// ============================================================================
// Shared constants
// ============================================================================

const SERVICE_TYPES = ['editing', 'writing', 'design', 'consulting', 'other'] as const;
const MAX_BIO = 2000;
const MAX_CONTENT = 4000;
const MAX_REVIEW_TEXT = 10000;
const MAX_GOALS = 10;

// ============================================================================
// Circles — EPIC-010
// ============================================================================

export const CreateCircleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(MAX_CONTENT).optional(),
  niche: z.string().max(100).optional(),
  maxMembers: z.number().int().min(5).max(20).optional(),
});

export const CreateCirclePostSchema = z.object({
  content: z.string().min(1).max(MAX_CONTENT),
});

// ============================================================================
// Mentorship — EPIC-010
// ============================================================================

export const RegisterMentorSchema = z.object({
  niche: z.string().min(1).max(100),
  audienceSizeRange: z.enum(['0-1k', '1k-10k', '10k-100k', '100k+']),
  bio: z.string().max(MAX_BIO).optional(),
  maxMentees: z.number().int().positive().max(100).optional(),
});

export const RequestMentorshipSchema = z.object({
  mentorId: z.string().min(1).max(200),
  niche: z.string().max(100).optional(),
  goals: z.array(z.string().max(500)).max(MAX_GOALS).optional(),
});

export const RespondMentorshipSchema = z.object({
  accept: z.boolean(),
});

export const UpdateMentorProfileSchema = z
  .object({
    niche: z.string().min(1).max(100).optional(),
    audienceSizeRange: z.enum(['0-1k', '1k-10k', '10k-100k', '100k+']).optional(),
    bio: z.string().max(MAX_BIO).optional(),
    maxMentees: z.number().int().positive().max(100).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

// ============================================================================
// Collaboration — EPIC-010
// ============================================================================

export const InviteCollaboratorSchema = z.object({
  contentId: z.string().min(1).max(200),
  collaboratorId: z.string().min(1).max(200),
  revenueSplitBps: z.number().int().positive().max(10000),
});

export const RespondCollaborationSchema = z.object({
  accept: z.boolean(),
});

export const UpdateRevenueSplitSchema = z.object({
  splits: z
    .array(
      z.object({
        creatorId: z.string().min(1).max(200),
        bps: z.number().int().min(0).max(10000),
      })
    )
    .min(1)
    .max(50),
});

// ============================================================================
// Marketplace — EPIC-010
// ============================================================================

export const CreateListingSchema = z.object({
  serviceType: z.enum(SERVICE_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().max(MAX_CONTENT).optional(),
  priceSats: z.number().int().positive(),
  portfolioUrls: z.array(z.string().url().startsWith('https://')).max(10).optional(),
});

export const UpdateListingSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(MAX_CONTENT).optional(),
    priceSats: z.number().int().positive().optional(),
    portfolioUrls: z.array(z.string().url().startsWith('https://')).max(10).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const PlaceOrderSchema = z.object({
  listingId: z.string().min(1).max(200),
  idempotencyKey: z.string().uuid(),
});

export const ReviewOrderSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().max(MAX_REVIEW_TEXT).optional(),
});
