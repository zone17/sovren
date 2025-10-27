# ADR-009: Zod for Validation

**Date**: 2025-10-27
**Status**: Accepted
**Epic**: Epic 005 - Backend Service Refactoring
**Related ADRs**: [ADR-006 (TypeScript Strict Mode)](./ADR-006-typescript-strict-mode.md), [ADR-011 (OpenAPI)](./ADR-011-openapi-documentation.md)

## Context

Input validation was inconsistent across the codebase:
- Manual validation logic scattered throughout controllers
- No runtime type checking for API requests
- Duplicate validation code across frontend and backend
- Poor error messages for invalid input
- TypeScript types not validated at runtime

## Decision

We will use **Zod** for all runtime schema validation and type inference.

**Implementation**:
```typescript
import { z } from 'zod';

// Define schema
const CreatePaymentSchema = z.object({
  amount: z.number().positive().int(),
  userId: z.string().uuid(),
  description: z.string().min(1).max(500),
  metadata: z.record(z.string()).optional(),
});

// Infer TypeScript type from schema
type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

// Validate at runtime
function createPayment(input: unknown): CreatePaymentInput {
  return CreatePaymentSchema.parse(input); // Throws if invalid
}

// Or use safeParse for error handling
const result = CreatePaymentSchema.safeParse(input);
if (!result.success) {
  return { errors: result.error.flatten() };
}
```

**Key Benefits**:
1. **Type Inference**: Schemas generate TypeScript types automatically
2. **Runtime Safety**: Validates data at runtime, not just compile time
3. **Schema Reuse**: Same schema for frontend and backend
4. **Clear Errors**: Structured validation error messages
5. **Composability**: Build complex schemas from simple ones

## Consequences

### Positive

1. **Single Source of Truth**: Schema defines both types and validation
2. **API Safety**: All API inputs validated before processing
3. **Better Error Messages**: Clear validation errors for users
4. **Shared Schemas**: Reuse schemas across packages
5. **OpenAPI Generation**: Can generate OpenAPI specs from Zod schemas

### Negative

1. **Bundle Size**: Adds ~13KB to frontend bundle (gzipped)
2. **Performance**: Validation has runtime cost (minimal ~1ms)
3. **Learning Curve**: Team needs to learn Zod API

## Alternatives Considered

- **Joi**: More verbose, worse TypeScript support - Rejected
- **Yup**: Older, less type-safe - Rejected
- **class-validator**: Requires decorators, more complex - Rejected
- **io-ts**: Functional style, steeper learning curve - Rejected

## Example Patterns

```typescript
// Email validation
const EmailSchema = z.string().email();

// Branded types with Zod
const UserIdSchema = z.string().uuid().brand<'UserId'>();

// Nested objects
const UserSchema = z.object({
  id: UserIdSchema,
  email: EmailSchema,
  profile: z.object({
    name: z.string(),
    bio: z.string().optional(),
  }),
});

// Array validation
const UserListSchema = z.array(UserSchema);

// Union types
const PaymentMethodSchema = z.union([
  z.literal('lightning'),
  z.literal('onchain'),
]);

// Transform and refine
const DateSchema = z.string().transform(str => new Date(str));
const PositiveSchema = z.number().refine(n => n > 0, {
  message: 'Must be positive',
});
```

## Related Documentation

- [Zod Documentation](https://zod.dev)
- [API Validation Guide](/docs/development/backend-developer-guide.md#validation)
- [Shared Schemas](/packages/shared/src/validation/)

## Revision History

- **2025-10-27**: Initial decision documented for Epic 005
