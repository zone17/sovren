/**
 * Finance API Validation Schemas — H-7
 * Zod schemas for all EPIC-011 endpoint bodies.
 * Enforces max-length constraints to prevent oversized payloads.
 */

import { z } from 'zod';

// ============================================================================
// Shared constants
// ============================================================================

const MAX_FILLED_TEXT = 64 * 1024; // 64 KB — contract body
const MAX_DESCRIPTION = 4 * 1024; // 4 KB — general description fields
const MAX_TEMPLATE_TEXT = 64 * 1024; // 64 KB — template bodies

const REVENUE_SOURCES = [
  'subscriptions',
  'tips',
  'sponsorships',
  'services',
  'affiliate',
  'marketplace',
  'other',
] as const;

const EXPENSE_TYPES = ['equipment', 'software', 'services', 'travel', 'office', 'other'] as const;

const CONTRACT_STATUSES = ['draft', 'sent', 'signed', 'expired', 'terminated'] as const;

const CONTRACT_CATEGORIES = [
  'sponsorship',
  'licensing',
  'freelance',
  'collaboration',
  'general',
] as const;

const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'] as const;

const RECURRING_INTERVALS = ['weekly', 'biweekly', 'monthly', 'quarterly'] as const;

// ============================================================================
// Line Items — L-4: strict JSONB schema
// ============================================================================

export const LineItemSchema = z.object({
  description: z.string().min(1).max(MAX_DESCRIPTION),
  quantity: z.number().int().positive(),
  unitPriceSats: z.number().int().positive(),
});

export type LineItem = z.infer<typeof LineItemSchema>;

// ============================================================================
// Contracts — H-3 note: filledText stored raw, never rendered server-side
// ============================================================================

export const CreateContractSchema = z.object({
  templateId: z.string().uuid().optional(),
  counterparty: z.string().min(1).max(255),
  filledText: z.string().min(1).max(MAX_FILLED_TEXT),
});

export const UpdateContractSchema = z
  .object({
    filledText: z.string().min(1).max(MAX_FILLED_TEXT).optional(),
    status: z.enum(CONTRACT_STATUSES).optional(),
  })
  .refine((obj) => obj.filledText !== undefined || obj.status !== undefined, {
    message: 'At least one of filledText or status must be provided',
  });

export const AnalyzeContractSchema = z.object({
  text: z.string().min(1).max(MAX_FILLED_TEXT),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(CONTRACT_CATEGORIES),
  templateText: z.string().min(1).max(MAX_TEMPLATE_TEXT),
});

// ============================================================================
// Invoices — M-8: recurrence limits
// ============================================================================

export const InvoiceSchema = z.object({
  clientName: z.string().min(1).max(255),
  lineItems: z.array(LineItemSchema).min(1).max(100),
  dueDate: z.string().date().optional(),
  recurringInterval: z.enum(RECURRING_INTERVALS).optional(),
  recurrenceEndDate: z.string().date().optional(),
});

export const UpdateInvoiceStatusSchema = z.object({
  status: z.enum(INVOICE_STATUSES),
});

// ============================================================================
// Revenue
// ============================================================================

export const RecordRevenueSchema = z.object({
  source: z.enum(REVENUE_SOURCES),
  amountSats: z.number().int().positive(),
  description: z.string().max(MAX_DESCRIPTION).optional(),
});

// L-4: target_distribution values must all be numbers; sum-to-100 validated in service
export const SetDiversificationGoalsSchema = z.object({
  targets: z.record(z.enum(REVENUE_SOURCES), z.number().nonnegative().max(100)),
});

// ============================================================================
// Tax / Expenses — H-7 + L-4
// ============================================================================

export const ExpenseSchema = z.object({
  categoryId: z.string().uuid().optional(),
  description: z.string().min(1).max(MAX_DESCRIPTION),
  amountSats: z.number().int().positive(),
  expenseDate: z.string().date().optional(),
});

export const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(EXPENSE_TYPES),
});
