# Epic 001: Type Safety Improvements - Story Breakdown

**Generated**: 2025-10-23
**Epic Reference**: `/Users/fp/Desktop/Sovren/docs/refactoring/EPIC-001-type-safety-improvements.md`
**Status**: Ready for Development
**Total Stories**: 12 stories (12 points, 2-3 days with 2-3 developers)

## Executive Summary

This document decomposes Epic 001 into 12 granular, 1-point user stories organized into 3 parallel work streams:

- **Stream A: Frontend Types** (5 stories) - Can work in parallel
- **Stream B: Shared Package Types** (3 stories) - Can work in parallel
- **Stream C: API & Integration Types** (2 stories) - Can work in parallel
- **Stream D: Strict Mode Enablement** (2 stories) - Sequential, depends on A+B+C completion

**Parallel Work Capacity**: 3 developers can work simultaneously on Streams A, B, and C
**Critical Path**: Stream D must wait for A+B+C completion (5-6 hours dependency)

---

## Work Stream Organization

### Sprint 0: Type Foundation (Stories 1-10, ~6-8 hours, Parallel)

#### Stream A: Frontend Types (5 stories, 1 developer)

- Story 1: Replace `any` in event handlers and form components
- Story 2: Type API response handlers with proper interfaces
- Story 3: Replace `any` in validation middleware
- Story 4: Type email service templates and methods
- Story 5: Type test utilities and mock providers

#### Stream B: Shared Package Types (3 stories, 1 developer)

- Story 6: Replace `any` in quality-metrics types with proper Zod schemas
- Story 7: Type NOSTR key management interfaces
- Story 8: Type environment validator with proper type guards

#### Stream C: API & Integration Types (2 stories, 1 developer)

- Story 9: Type API route handlers with proper request/response types
- Story 10: Type NOSTR service event validation

### Sprint 1: Strict Mode Enforcement (Stories 11-12, ~2-3 hours, Sequential)

#### Stream D: Strict Mode (2 stories, 1 developer)

- Story 11: Enable stricter TypeScript compiler options incrementally
- Story 12: Fix strict mode violations and validate type coverage

---

## Story Details

---

### STORY 1: Replace `any` in Event Handlers and Form Components

**ID**: EPIC-001-S01
**Priority**: High
**Size**: 1 point (2-3 hours)
**Work Stream**: Stream A (Frontend)
**Risk**: Low

#### User Story

**As a** frontend developer
**I want** properly typed event handlers and form component props
**So that** I get accurate IDE autocomplete and compile-time error detection for user interactions

#### Acceptance Criteria

- [ ] **Given** a React component with event handlers
      **When** TypeScript analyzes the component
      **Then** all event handlers use proper React event types (MouseEvent, ChangeEvent, FormEvent, etc.)

- [ ] **Given** form components with input handlers
      **When** developers implement onChange/onSubmit handlers
      **Then** TypeScript infers correct event target types without casting

- [ ] **Given** custom event handlers with data payloads
      **When** events are dispatched
      **Then** payload types are validated at compile time

#### Technical Implementation

**Files to Modify**:

- `packages/frontend/src/pages/Login.tsx` - Login form event handlers
- `packages/frontend/src/pages/Signup.tsx` - Signup form event handlers
- `packages/frontend/src/pages/Profile.tsx` - Profile form event handlers
- `packages/frontend/src/pages/Post.tsx` - Post creation form handlers

**Approach**:

```typescript
// BEFORE (incorrect)
const handleSubmit = (e: any) => {
  e.preventDefault();
  const formData = new FormData(e.target);
};

// AFTER (correct)
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
};

// BEFORE (incorrect)
const handleChange = (e: any) => {
  setValue(e.target.value);
};

// AFTER (correct)
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.currentTarget.value);
};
```

**Type Patterns**:

- `React.FormEvent<HTMLFormElement>` for form submissions
- `React.ChangeEvent<HTMLInputElement>` for input changes
- `React.MouseEvent<HTMLButtonElement>` for button clicks
- `React.KeyboardEvent<HTMLInputElement>` for keyboard events

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 2 (API response types), Story 5 (test utilities)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 2, 3, 4, 5 (Stream A), Stories 6, 7, 8 (Stream B), Stories 9, 10 (Stream C)
**Work stream**: `frontend-types` (Stream A)
**Rationale**: No shared dependencies with other stories; modifications are isolated to page components

#### Definition of Done

- [ ] All event handlers in Login.tsx use proper React.FormEvent types
- [ ] All event handlers in Signup.tsx use proper React.ChangeEvent types
- [ ] All event handlers in Profile.tsx use proper event types
- [ ] All event handlers in Post.tsx use proper event types
- [ ] TypeScript compiler shows no errors for these files
- [ ] All existing tests continue to pass
- [ ] No new ESLint warnings for explicit-any
- [ ] IDE autocomplete works correctly for event properties
- [ ] Code review approved by team member

#### Security Considerations

- Input validation types ensure proper data sanitization at compile time
- Form event types prevent XSS vulnerabilities through type-safe value access
- No security vulnerabilities introduced by type changes

#### Testing Requirements

**Unit Tests**:

- Test that form submission handlers receive correct event types
- Test that input change handlers receive correct target types
- Test that existing component tests still pass with new types

**Manual Testing**:

- Verify IDE autocomplete works for event.currentTarget
- Verify no runtime errors when interacting with forms
- Test all form submission flows (login, signup, profile update, post creation)

#### Performance Requirements

- No performance impact (compile-time only change)
- Build time increase: < 1 second

#### Estimated Complexity

**Size**: 1 point (2-3 hours)
**Breakdown**:

- 1 hour: Update all event handler types
- 0.5 hour: Fix any type errors revealed
- 0.5 hour: Run tests and verify
- 1 hour: Code review buffer

**Priority**: High
**Risk**: Low - Well-understood React event types with comprehensive test coverage

---

### STORY 2: Type API Response Handlers with Proper Interfaces

**ID**: EPIC-001-S02
**Priority**: High
**Size**: 1 point (2-3 hours)
**Work Stream**: Stream A (Frontend)
**Risk**: Low

#### User Story

**As a** frontend developer
**I want** properly typed API response handlers
**So that** API data is type-safe throughout the application and prevents runtime errors

#### Acceptance Criteria

- [ ] **Given** an API call to fetch user data
      **When** the response is processed
      **Then** TypeScript validates response structure at compile time

- [ ] **Given** an API error response
      **When** error handling logic executes
      **Then** error types are properly discriminated (network vs validation vs auth)

- [ ] **Given** paginated API responses
      **When** pagination metadata is accessed
      **Then** TypeScript infers correct types for page, limit, total fields

#### Technical Implementation

**Files to Modify**:

- `packages/frontend/src/pages/Home.tsx` - Feed data fetching
- `packages/frontend/src/pages/Profile.tsx` - User profile data
- `packages/frontend/src/pages/Post.tsx` - Post data fetching
- `packages/frontend/src/services/api.ts` (if exists) - API client types

**Create New Types**:

- `packages/frontend/src/types/api-responses.ts`

**Approach**:

```typescript
// Create proper API response types
// packages/frontend/src/types/api-responses.ts

export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface UserProfileResponse {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostResponse {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  likesCount: number;
  repliesCount: number;
  isLiked: boolean;
}

export interface FeedResponse extends PaginatedResponse<PostResponse> {}

// BEFORE (incorrect)
const fetchProfile = async (userId: string): Promise<any> => {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
};

// AFTER (correct)
const fetchProfile = async (userId: string): Promise<ApiResponse<UserProfileResponse>> => {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
};
```

**Error Handling Types**:

```typescript
export type ApiError =
  | { type: 'network'; message: string; status?: never }
  | { type: 'validation'; message: string; status: 400; errors: Record<string, string[]> }
  | { type: 'auth'; message: string; status: 401 | 403 }
  | { type: 'server'; message: string; status: 500 };
```

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 1 (event handlers), Story 9 (API routes)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 1, 3, 4, 5 (Stream A), Stories 6, 7, 8 (Stream B), Stories 9, 10 (Stream C)
**Work stream**: `frontend-types` (Stream A)
**Rationale**: API response types are consumed by components but don't affect other type definitions

#### Definition of Done

- [ ] API response type definitions created in `types/api-responses.ts`
- [ ] All fetch calls in Home.tsx use proper response types
- [ ] All fetch calls in Profile.tsx use proper response types
- [ ] All fetch calls in Post.tsx use proper response types
- [ ] Error handling uses discriminated union types
- [ ] TypeScript compiler shows no errors
- [ ] All existing tests pass
- [ ] IDE autocomplete works for API response fields
- [ ] Code review approved

#### Security Considerations

- Response types enforce validation of sensitive fields (auth tokens, user IDs)
- Type guards prevent accessing undefined fields that could cause security issues
- Error types prevent leaking sensitive server error details to users

#### Testing Requirements

**Unit Tests**:

- Test that API response handlers parse successful responses correctly
- Test that error responses are properly typed and discriminated
- Test pagination metadata extraction with proper types
- Mock API responses conform to defined types

**Integration Tests**:

- Test actual API calls return data matching TypeScript types
- Test error scenarios return properly typed errors

#### Performance Requirements

- No performance impact (compile-time only change)
- Runtime: No overhead from type annotations
- Build time increase: < 1 second

#### Estimated Complexity

**Size**: 1 point (2-3 hours)
**Breakdown**:

- 1 hour: Define all API response interfaces
- 1 hour: Update all fetch calls with proper types
- 0.5 hour: Add error handling types
- 0.5 hour: Test and verify

**Priority**: High
**Risk**: Low - Standard API typing patterns with existing test coverage

---

### STORY 3: Replace `any` in Validation Middleware

**ID**: EPIC-001-S03
**Priority**: High
**Size**: 1 point (2-3 hours)
**Work Stream**: Stream A (Frontend)
**Risk**: Medium (security-critical component)

#### User Story

**As a** security-conscious developer
**I want** properly typed validation middleware
**So that** input sanitization and validation is type-safe and prevents security vulnerabilities

#### Acceptance Criteria

- [ ] **Given** user input data requiring validation
      **When** validation middleware processes the input
      **Then** TypeScript enforces proper input/output types without `any`

- [ ] **Given** field-level validation rules
      **When** validation executes
      **Then** field types are properly constrained and validated

- [ ] **Given** sanitization functions
      **When** data is sanitized
      **Then** input and output types are properly typed (no information loss)

#### Technical Implementation

**Files to Modify**:

- `packages/frontend/lib/middleware/validation.ts`

**Current Issues**:

```typescript
// BEFORE (security risk - using any)
const sanitizeInput = (obj: any): any => {
  const sanitized: any = {};
  // ... sanitization logic
};

function checkFieldLengths(data: any, maxLength: number): ValidationResult<any> {
  // ... validation logic
}

function filterAllowedFields(data: any, allowedFields: string[]): any {
  const filtered: any = {};
  // ... filtering logic
}
```

**Approach**:

```typescript
// AFTER (type-safe validation)
type Sanitizable = string | number | boolean | null | undefined;
type SanitizedObject<T> = {
  [K in keyof T]: T[K] extends Sanitizable ? T[K] : never;
};

function sanitizeInput<T extends Record<string, Sanitizable>>(obj: T): SanitizedObject<T> {
  const sanitized = {} as SanitizedObject<T>;
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sanitized[key] = DOMPurify.sanitize(obj[key] as string) as any;
    } else {
      sanitized[key] = obj[key] as any;
    }
  }
  return sanitized;
}

interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: Record<keyof T, string[]>;
}

function checkFieldLengths<T extends Record<string, string>>(
  data: T,
  maxLength: number
): ValidationResult<T> {
  const errors: Partial<Record<keyof T, string[]>> = {};

  for (const key in data) {
    if (data[key].length > maxLength) {
      errors[key] = [`Field ${String(key)} exceeds maximum length of ${maxLength}`];
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    data: Object.keys(errors).length === 0 ? data : undefined,
    errors: Object.keys(errors).length > 0 ? (errors as Record<keyof T, string[]>) : undefined,
  };
}

function filterAllowedFields<T extends Record<string, unknown>, K extends keyof T>(
  data: T,
  allowedFields: K[]
): Pick<T, K> {
  const filtered = {} as Pick<T, K>;
  for (const key of allowedFields) {
    if (key in data) {
      filtered[key] = data[key];
    }
  }
  return filtered;
}
```

**Type Guards for Validation**:

```typescript
function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUsername(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(value);
}
```

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 1 (form event handlers use validation), Story 2 (API responses use validation)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 1, 2, 4, 5 (Stream A), Stories 6, 7, 8 (Stream B), Stories 9, 10 (Stream C)
**Work stream**: `frontend-types` (Stream A)
**Rationale**: Validation middleware is independent; changes don't affect other type definitions

#### Definition of Done

- [ ] `sanitizeInput` function uses proper generic types instead of `any`
- [ ] `checkFieldLengths` function uses generic constrained types
- [ ] `filterAllowedFields` function uses Pick utility type
- [ ] Type guards created for common validation patterns
- [ ] TypeScript compiler shows no errors in validation.ts
- [ ] All validation tests pass with new types
- [ ] Security review completed (input sanitization is critical)
- [ ] No ESLint explicit-any warnings
- [ ] Code review approved

#### Security Considerations

**CRITICAL**: This is security-sensitive code that handles user input sanitization

- Input types must prevent injection attacks (XSS, SQL injection)
- Sanitization must not lose type information that could bypass validation
- Type guards must properly validate email/username formats
- Generic constraints must prevent accepting dangerous types (functions, objects with methods)
- All validation rules must be compile-time enforced

**Security Testing Required**:

- Test with malicious payloads (script tags, SQL fragments)
- Verify type system prevents bypassing validation
- Test edge cases (null, undefined, empty strings)

#### Testing Requirements

**Unit Tests**:

- Test `sanitizeInput` with valid data → returns properly typed sanitized data
- Test `sanitizeInput` with XSS payload → returns sanitized string
- Test `checkFieldLengths` with valid data → returns ValidationResult with valid: true
- Test `checkFieldLengths` with oversized data → returns errors object
- Test `filterAllowedFields` removes disallowed fields
- Test type guards correctly identify valid/invalid inputs

**Security Tests**:

- Test XSS payload sanitization: `<script>alert('xss')</script>` → sanitized
- Test SQL injection patterns: `'; DROP TABLE users--` → sanitized
- Test null byte injection: `user\0admin` → sanitized
- Test prototype pollution: `__proto__` field → rejected

#### Performance Requirements

- Sanitization overhead: < 1ms per object (same as before)
- No performance degradation from generic types
- Build time increase: < 1 second

#### Estimated Complexity

**Size**: 1 point (2-3 hours)
**Breakdown**:

- 1 hour: Implement generic types for validation functions
- 0.5 hour: Create type guards for common patterns
- 0.5 hour: Security testing with malicious payloads
- 1 hour: Code review and security review

**Priority**: High
**Risk**: Medium - Security-critical component requiring thorough testing and review

---

### STORY 4: Type Email Service Templates and Methods

**ID**: EPIC-001-S04
**Priority**: Medium
**Size**: 1 point (2 hours)
**Work Stream**: Stream A (Frontend)
**Risk**: Low

#### User Story

**As a** developer integrating email functionality
**I want** properly typed email service methods and templates
**So that** email template data is validated at compile time and prevents runtime errors

#### Acceptance Criteria

- [ ] **Given** email template data
      **When** an email is sent
      **Then** TypeScript validates template variables match the template type

- [ ] **Given** different email types (welcome, payment, notification)
      **When** email methods are called
      **Then** each email type has specific typed parameters

- [ ] **Given** email sending results
      **When** the email service returns
      **Then** result types properly discriminate success vs failure

#### Technical Implementation

**Files to Modify**:

- `packages/frontend/lib/services/emailService.ts`

**Current Issues**:

```typescript
// BEFORE (weak typing)
templateData?: Record<string, any>;

sendPaymentConfirmation(to: string, name: string, paymentData: any): Promise<EmailResult>

private replaceTemplateVars(template: string, data: Record<string, any>): string
```

**Approach**:

```typescript
// Define specific template data types
interface WelcomeEmailData {
  name: string;
  loginUrl: string;
  verificationToken?: string;
}

interface PaymentConfirmationData {
  name: string;
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface PasswordResetData {
  name: string;
  resetLink: string;
  expiresAt: string;
}

// Type-safe email result
type EmailResult =
  | { success: true; messageId: string }
  | { success: false; error: string; code: EmailErrorCode };

enum EmailErrorCode {
  INVALID_RECIPIENT = 'INVALID_RECIPIENT',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
}

// Type-safe email methods
class EmailService {
  async sendWelcomeEmail(to: string, data: WelcomeEmailData): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: 'Welcome to Sovren!',
      template: 'welcome',
      data,
    });
  }

  async sendPaymentConfirmation(to: string, data: PaymentConfirmationData): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: 'Payment Confirmation',
      template: 'payment-confirmation',
      data,
    });
  }

  private replaceTemplateVars<T extends Record<string, string | number>>(
    template: string,
    data: T
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = data[key as keyof T];
      return value !== undefined ? String(value) : '';
    });
  }
}
```

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 2 (API responses), Story 9 (API routes that trigger emails)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 1, 2, 3, 5 (Stream A), Stories 6, 7, 8 (Stream B), Stories 9, 10 (Stream C)
**Work stream**: `frontend-types` (Stream A)
**Rationale**: Email service is independent; no shared dependencies with other stories

#### Definition of Done

- [ ] Template data types created (WelcomeEmailData, PaymentConfirmationData, etc.)
- [ ] EmailResult type uses discriminated union
- [ ] All email methods use specific typed parameters (no `any`)
- [ ] `replaceTemplateVars` uses generic constrained type
- [ ] TypeScript compiler shows no errors in emailService.ts
- [ ] All email service tests pass
- [ ] No ESLint explicit-any warnings
- [ ] Code review approved

#### Security Considerations

- Email template data types prevent injection of malicious content
- Type-safe template variable replacement prevents XSS in emails
- Recipient validation ensures email addresses are properly typed

#### Testing Requirements

**Unit Tests**:

- Test sendWelcomeEmail with valid data → success result
- Test sendPaymentConfirmation with valid data → success result
- Test replaceTemplateVars correctly substitutes typed variables
- Test missing template variables → empty string substitution
- Test email result types are properly discriminated

**Integration Tests**:

- Test actual email sending with typed data
- Test error cases return properly typed EmailResult

#### Performance Requirements

- No performance impact (compile-time only change)
- Build time increase: < 1 second

#### Estimated Complexity

**Size**: 1 point (2 hours)
**Breakdown**:

- 0.5 hour: Define template data interfaces
- 0.5 hour: Update email methods with proper types
- 0.5 hour: Update template variable replacement
- 0.5 hour: Test and verify

**Priority**: Medium
**Risk**: Low - Standard typing patterns, not on critical path

---

### STORY 5: Type Test Utilities and Mock Providers

**ID**: EPIC-001-S05
**Priority**: Medium
**Size**: 1 point (2 hours)
**Work Stream**: Stream A (Frontend)
**Risk**: Low

#### User Story

**As a** developer writing tests
**I want** properly typed test utilities and mock providers
**So that** test code benefits from type safety and catches errors early

#### Acceptance Criteria

- [ ] **Given** test provider wrappers
      **When** tests render components with providers
      **Then** provider props are properly typed (no `any`)

- [ ] **Given** mock query response utilities
      **When** tests create mock API responses
      **Then** mock data conforms to actual API response types

- [ ] **Given** test data factories
      **When** tests generate test data
      **Then** TypeScript validates test data matches expected types

#### Technical Implementation

**Files to Modify**:

- `packages/frontend/src/test-utils/test-providers.tsx`
- `packages/frontend/src/test-utils/react-query-test-utils.tsx`

**Current Issues**:

```typescript
// BEFORE (weak typing in test-utils/test-providers.tsx)
currentUser: any;

// BEFORE (weak typing in react-query-test-utils.tsx)
declare const jest: any;
declare const expect: any;
export const createMockResponse = (data: any, status = 200, ok = true) => ...
export const expectQueryToBeLoading = (queryClient: QueryClient, queryKey: any[]) => ...
```

**Approach**:

```typescript
// packages/frontend/src/test-utils/test-providers.tsx

import { User } from '@sovren/shared/types';

interface TestProvidersOptions {
  initialState?: Partial<RootState>;
  currentUser?: User | null;
  isAuthenticated?: boolean;
  routerEntries?: string[];
}

interface AllTheProvidersProps {
  children: React.ReactNode;
  options?: TestProvidersOptions;
}

export function AllTheProviders({ children, options = {} }: AllTheProvidersProps) {
  // ... properly typed provider setup
}

// packages/frontend/src/test-utils/react-query-test-utils.tsx

// Remove unsafe global declarations
// Use proper imports instead
import { jest, expect } from '@jest/globals';

export function createMockResponse<T>(data: T, status = 200, ok = true): Response {
  return {
    json: async () => data,
    status,
    ok,
    statusText: ok ? 'OK' : 'Error',
  } as Response;
}

export function expectQueryToBeLoading(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): void {
  const query = queryClient.getQueryState(queryKey);
  expect(query?.status).toBe('loading');
}

export function expectQueryToBeSuccess<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  expectedData?: T
): void {
  const query = queryClient.getQueryState<T>(queryKey);
  expect(query?.status).toBe('success');
  if (expectedData !== undefined) {
    expect(query?.data).toEqual(expectedData);
  }
}
```

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 1 (test providers wrap components), Story 2 (mock API responses)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 1, 2, 3, 4 (Stream A), Stories 6, 7, 8 (Stream B), Stories 9, 10 (Stream C)
**Work stream**: `frontend-types` (Stream A)
**Rationale**: Test utilities are independent infrastructure; safe to work in parallel

#### Definition of Done

- [ ] TestProvidersOptions interface properly typed
- [ ] AllTheProviders props properly typed (no `any`)
- [ ] Global `jest` and `expect` declarations removed (use proper imports)
- [ ] createMockResponse uses generic type parameter
- [ ] expectQueryToBeLoading uses proper readonly array type for queryKey
- [ ] expectQueryToBeSuccess uses generic type parameter
- [ ] TypeScript compiler shows no errors in test utility files
- [ ] All tests using these utilities pass
- [ ] No ESLint explicit-any warnings
- [ ] Code review approved

#### Security Considerations

- Test mocks properly type user authentication state
- Mock providers don't leak sensitive data types
- Test utilities validate expected security boundaries

#### Testing Requirements

**Unit Tests**:

- Test test providers with different user authentication states
- Test createMockResponse returns properly typed Response
- Test query expectation utilities work with typed query keys
- Verify existing tests still pass with new types

**Meta-Testing** (tests for test utilities):

- Verify test providers correctly wrap components
- Verify mock responses conform to type constraints

#### Performance Requirements

- No performance impact on test execution
- Build time increase: < 1 second

#### Estimated Complexity

**Size**: 1 point (2 hours)
**Breakdown**:

- 0.5 hour: Type test provider options and props
- 0.5 hour: Fix react-query test utilities
- 0.5 hour: Remove unsafe global declarations
- 0.5 hour: Verify all tests pass

**Priority**: Medium
**Risk**: Low - Test infrastructure improvements, low risk of breaking production code

---

### STORY 6: Replace `any` in Quality Metrics Types with Proper Zod Schemas

**ID**: EPIC-001-S06
**Priority**: High
**Size**: 1 point (2-3 hours)
**Work Stream**: Stream B (Shared Package)
**Risk**: Low

#### User Story

**As a** developer using quality metrics
**I want** properly typed visualization data and configuration objects
**So that** quality metrics data is validated and type-safe across frontend and backend

#### Acceptance Criteria

- [ ] **Given** quality metrics visualization data
      **When** TypeScript analyzes the code
      **Then** visualization data uses proper typed schemas (not `z.any()`)

- [ ] **Given** quality metrics configuration objects
      **When** configs are passed to metrics services
      **Then** TypeScript validates config structure at compile time

- [ ] **Given** AI insights and recommendations
      **When** metrics are processed
      **Then** TypeScript enforces proper types for suggestions, thresholds, and analysis results

#### Technical Implementation

**Files to Modify**:

- `packages/shared/src/types/quality-metrics.ts`
- `packages/shared/src/types/quality-metrics.d.ts` (regenerate after TS changes)

**Current Issues**:

```typescript
// BEFORE (weak typing with z.any())
visualizations: z.array(
  z.object({
    type: z.enum(['line_chart', 'heatmap', 'treemap', 'gauge']),
    data: z.any(),  // ❌ Too permissive
    config: z.any(), // ❌ Too permissive
  })
),

keyMetrics: z.record(z.string(), z.any()), // ❌ Too permissive

updateThresholds(projectId: string, thresholds: any): Promise<void>; // ❌
getRefactoringSuggestions(projectId: string): Promise<any[]>; // ❌
classifyBug(bug: any): Promise<any>; // ❌
```

**Approach**:

```typescript
// Define specific visualization data types
const LineChartDataSchema = z.object({
  labels: z.array(z.string()),
  datasets: z.array(
    z.object({
      label: z.string(),
      data: z.array(z.number()),
      borderColor: z.string().optional(),
      backgroundColor: z.string().optional(),
    })
  ),
});

const HeatmapDataSchema = z.object({
  rows: z.array(z.string()),
  columns: z.array(z.string()),
  values: z.array(z.array(z.number())),
  colorScale: z.enum(['red-green', 'blue-yellow', 'grayscale']).optional(),
});

const TreemapDataSchema = z.object({
  name: z.string(),
  value: z.number().optional(),
  children: z.lazy(() => z.array(TreemapDataSchema)).optional(),
  color: z.string().optional(),
});

const GaugeDataSchema = z.object({
  value: z.number(),
  min: z.number(),
  max: z.number(),
  threshold: z.number().optional(),
  label: z.string(),
});

// Discriminated union for visualization data
const VisualizationDataSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('line_chart'), data: LineChartDataSchema }),
  z.object({ type: z.literal('heatmap'), data: HeatmapDataSchema }),
  z.object({ type: z.literal('treemap'), data: TreemapDataSchema }),
  z.object({ type: z.literal('gauge'), data: GaugeDataSchema }),
]);

// Configuration schemas
const LineChartConfigSchema = z.object({
  responsive: z.boolean().optional(),
  maintainAspectRatio: z.boolean().optional(),
  legend: z
    .object({
      display: z.boolean(),
      position: z.enum(['top', 'bottom', 'left', 'right']).optional(),
    })
    .optional(),
});

const VisualizationConfigSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('line_chart'), config: LineChartConfigSchema }),
  z.object({ type: z.literal('heatmap'), config: z.object({}).optional() }),
  z.object({ type: z.literal('treemap'), config: z.object({}).optional() }),
  z.object({ type: z.literal('gauge'), config: z.object({}).optional() }),
]);

// Update visualization schema
export const VisualizationSchema = z.object({
  type: z.enum(['line_chart', 'heatmap', 'treemap', 'gauge']),
  data: z.union([LineChartDataSchema, HeatmapDataSchema, TreemapDataSchema, GaugeDataSchema]),
  config: z.object({}).passthrough().optional(), // Allow any config for flexibility
});

// Key metrics with proper types
const KeyMetricsSchema = z.record(
  z.string(),
  z.union([
    z.number(),
    z.string(),
    z.boolean(),
    z.object({
      value: z.number(),
      unit: z.string().optional(),
      trend: z.enum(['up', 'down', 'stable']).optional(),
    }),
  ])
);

// AI service method types
export interface QualityThresholds {
  coverage: { min: number; target: number };
  complexity: { max: number; warning: number };
  maintainability: { min: number; target: number };
  bugs: { critical: number; high: number; medium: number };
}

export interface RefactoringSuggestion {
  file: string;
  line: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'complexity' | 'duplication' | 'performance' | 'maintainability';
  description: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  impact: string;
}

export interface BugClassification {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'functionality' | 'ui' | 'data';
  priority: number;
  estimatedFixTime: string;
  suggestedOwner?: string;
}

export interface Anomaly {
  type: 'performance' | 'error_rate' | 'resource_usage';
  timestamp: string;
  severity: 'warning' | 'error' | 'critical';
  description: string;
  affectedComponents: string[];
  suggestedAction: string;
}

export interface PerformanceOptimization {
  component: string;
  issue: string;
  currentMetric: number;
  targetMetric: number;
  optimizationType: 'caching' | 'lazy_loading' | 'code_splitting' | 'debouncing';
  estimatedImprovement: string;
  implementationSteps: string[];
}

// Update service interface
export interface QualityMetricsAIService {
  updateThresholds(projectId: string, thresholds: QualityThresholds): Promise<void>;
  getRefactoringSuggestions(projectId: string): Promise<RefactoringSuggestion[]>;
  classifyBug(bug: {
    title: string;
    description: string;
    stackTrace?: string;
  }): Promise<BugClassification>;
  detectAnomalies(projectId: string): Promise<Anomaly[]>;
  optimizePerformance(projectId: string): Promise<PerformanceOptimization[]>;
}
```

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 2 (frontend uses these types), Story 9 (API routes use these types)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 1-5 (Stream A), Stories 7, 8 (Stream B), Stories 9, 10 (Stream C)
**Work stream**: `shared-types` (Stream B)
**Rationale**: Shared types are independent; changes only affect imports in other packages

#### Definition of Done

- [ ] Visualization data schemas defined for all chart types (line, heatmap, treemap, gauge)
- [ ] Configuration schemas defined for each visualization type
- [ ] KeyMetrics uses properly constrained Zod schema (no `z.any()`)
- [ ] QualityThresholds interface replaces `any` parameter
- [ ] RefactoringSuggestion interface replaces `any[]` return type
- [ ] BugClassification interface replaces `any` return type
- [ ] Anomaly interface defined for detectAnomalies return type
- [ ] PerformanceOptimization interface defined for optimizePerformance return type
- [ ] TypeScript compiler shows no errors in quality-metrics.ts
- [ ] Generated .d.ts file updated with new types
- [ ] All packages importing these types compile successfully
- [ ] No ESLint explicit-any warnings
- [ ] Code review approved

#### Security Considerations

- Zod schemas validate untrusted data from external sources
- Proper types prevent injection of malicious visualization configs
- AI service types ensure sensitive bug data is properly structured

#### Testing Requirements

**Unit Tests**:

- Test Zod schemas validate correct visualization data
- Test Zod schemas reject invalid visualization data
- Test discriminated unions correctly narrow types
- Test key metrics schema accepts valid metric types
- Test key metrics schema rejects invalid metric types

**Integration Tests**:

- Test frontend components using quality metrics types compile correctly
- Test API routes using quality metrics types compile correctly

#### Performance Requirements

- Zod validation overhead: < 5ms per object
- No runtime performance impact on non-validated usage
- Build time increase: < 2 seconds (Zod schema compilation)

#### Estimated Complexity

**Size**: 1 point (2-3 hours)
**Breakdown**:

- 1 hour: Define visualization data and config schemas
- 0.5 hour: Define AI service interfaces
- 0.5 hour: Update Zod schemas for key metrics
- 1 hour: Test and verify all imports

**Priority**: High
**Risk**: Low - Shared types used across packages, but good test coverage

---

### STORY 7: Type NOSTR Key Management Interfaces

**ID**: EPIC-001-S07
**Priority**: Medium
**Size**: 1 point (1.5-2 hours)
**Work Stream**: Stream B (Shared Package)
**Risk**: Low

#### User Story

**As a** developer integrating NOSTR functionality
**I want** properly typed NOSTR key management interfaces
**So that** cryptographic operations are type-safe and metadata is properly validated

#### Acceptance Criteria

- [ ] **Given** NOSTR key metadata
      **When** TypeScript analyzes the code
      **Then** metadata uses proper typed schema instead of `z.record(z.any())`

- [ ] **Given** NOSTR key management results
      **When** generic type parameter T is used
      **Then** TypeScript properly constrains T to prevent unsafe types

- [ ] **Given** key derivation and encryption operations
      **When** methods are called
      **Then** input and output types are properly validated

#### Technical Implementation

**Files to Modify**:

- `packages/shared/src/types/nostr-key-management.ts`

**Current Issues**:

```typescript
// BEFORE (weak typing)
metadata: z.record(z.any()).optional(),

export interface NostrKeyManagementResult<T = any> {
  // ... generic with unsafe default
}

metadata?: Record<string, any>;
```

**Approach**:

```typescript
// Define specific metadata types
export const NostrKeyMetadataSchema = z.object({
  label: z.string().optional(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().optional(),
  purpose: z.enum(['signing', 'encryption', 'authentication']).optional(),
  tags: z.array(z.string()).optional(),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'sign'])).optional(),
  expiresAt: z.string().datetime().optional(),
  rotationPolicy: z
    .object({
      enabled: z.boolean(),
      intervalDays: z.number().positive(),
    })
    .optional(),
});

export type NostrKeyMetadata = z.infer<typeof NostrKeyMetadataSchema>;

// Update schema to use specific metadata type
export const NostrKeySchema = z.object({
  publicKey: z.string().regex(/^[0-9a-f]{64}$/),
  privateKey: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  metadata: NostrKeyMetadataSchema.optional(),
});

// Constrain generic type parameter
export interface NostrKeyManagementResult<T extends z.ZodTypeAny = z.ZodString> {
  success: boolean;
  data?: z.infer<T>;
  error?: {
    code: NostrErrorCode;
    message: string;
    details?: Record<string, string>;
  };
}

export enum NostrErrorCode {
  INVALID_KEY_FORMAT = 'INVALID_KEY_FORMAT',
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_METADATA = 'INVALID_METADATA',
  KEY_EXPIRED = 'KEY_EXPIRED',
}

// Type-safe key management operations
export interface NostrKeyManager {
  generateKeyPair(
    metadata?: NostrKeyMetadata
  ): Promise<NostrKeyManagementResult<typeof NostrKeySchema>>;

  derivePublicKey(privateKey: string): Promise<NostrKeyManagementResult<z.ZodString>>;

  encryptMessage(
    recipientPublicKey: string,
    message: string,
    senderPrivateKey: string
  ): Promise<NostrKeyManagementResult<z.ZodString>>;

  decryptMessage(
    senderPublicKey: string,
    encryptedMessage: string,
    recipientPrivateKey: string
  ): Promise<NostrKeyManagementResult<z.ZodString>>;

  rotateKey(
    oldPrivateKey: string,
    metadata?: NostrKeyMetadata
  ): Promise<NostrKeyManagementResult<typeof NostrKeySchema>>;

  validateKey(key: string): Promise<NostrKeyManagementResult<z.ZodBoolean>>;
}
```

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 10 (NOSTR service uses these types)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 1-5 (Stream A), Stories 6, 8 (Stream B), Stories 9, 10 (Stream C)
**Work stream**: `shared-types` (Stream B)
**Rationale**: NOSTR types are independent; safe to work in parallel with other type improvements

#### Definition of Done

- [ ] NostrKeyMetadataSchema defined with specific fields
- [ ] NostrKeyMetadata type exported
- [ ] NostrKeyManagementResult generic constrained to z.ZodTypeAny
- [ ] NostrErrorCode enum defined
- [ ] NostrKeyManager interface methods properly typed
- [ ] TypeScript compiler shows no errors
- [ ] All NOSTR-related code using these types compiles
- [ ] No ESLint explicit-any warnings
- [ ] Code review approved

#### Security Considerations

**CRITICAL**: Cryptographic key management must be properly typed

- Private key types must prevent accidental logging or exposure
- Metadata permissions must be validated at compile time
- Key format validation enforced by regex patterns in Zod schema
- Encryption/decryption operations must have proper error types
- Key rotation must preserve metadata integrity

#### Testing Requirements

**Unit Tests**:

- Test NostrKeyMetadataSchema validates correct metadata
- Test NostrKeyMetadataSchema rejects invalid metadata
- Test NostrKeyManagementResult properly types success and error cases
- Test key format validation with valid/invalid hex strings

**Security Tests**:

- Test private keys are not accidentally exposed in error messages
- Test metadata validation prevents injection attacks
- Test key expiration is properly enforced

#### Performance Requirements

- Zod validation overhead: < 1ms per key operation
- No performance impact on cryptographic operations
- Build time increase: < 1 second

#### Estimated Complexity

**Size**: 1 point (1.5-2 hours)
**Breakdown**:

- 0.5 hour: Define NostrKeyMetadataSchema
- 0.5 hour: Constrain NostrKeyManagementResult generic
- 0.5 hour: Define NostrKeyManager interface
- 1 hour: Test and security review

**Priority**: Medium
**Risk**: Low - Well-defined domain with clear typing requirements

---

### STORY 8: Type Environment Validator with Proper Type Guards

**ID**: EPIC-001-S08
**Priority**: Low
**Size**: 1 point (1.5 hours)
**Work Stream**: Stream B (Shared Package)
**Risk**: Low

#### User Story

**As a** developer configuring the application
**I want** properly typed environment validation
**So that** configuration values are type-safe and validated at startup

#### Acceptance Criteria

- [ ] **Given** environment variable configuration
      **When** the application starts
      **Then** TypeScript validates environment variable types without using `any`

- [ ] **Given** default values for environment variables
      **When** a variable is missing
      **Then** TypeScript ensures default value matches expected type

- [ ] **Given** environment validation errors
      **When** validation fails
      **Then** error messages are properly typed and descriptive

#### Technical Implementation

**Files to Modify**:

- `packages/shared/src/config/environment-validator.ts`

**Current Issues**:

```typescript
// BEFORE (weak typing)
defaultValue?: any;
```

**Approach**:

```typescript
// Type-safe environment variable types
type EnvVarType = 'string' | 'number' | 'boolean' | 'url' | 'email' | 'port' | 'json';

type EnvVarValue<T extends EnvVarType> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'boolean'
      ? boolean
      : T extends 'url'
        ? URL
        : T extends 'email'
          ? string
          : T extends 'port'
            ? number
            : T extends 'json'
              ? Record<string, unknown>
              : never;

interface EnvVarConfig<T extends EnvVarType> {
  name: string;
  type: T;
  required: boolean;
  defaultValue?: EnvVarValue<T>;
  validation?: (value: EnvVarValue<T>) => boolean;
  errorMessage?: string;
}

// Type guards for environment variable parsing
function isValidUrl(value: string): value is string {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidEmail(value: string): value is string {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPort(value: number): value is number {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

// Type-safe environment validator
class EnvironmentValidator {
  validateVar<T extends EnvVarType>(config: EnvVarConfig<T>): ValidationResult<EnvVarValue<T>> {
    const rawValue = process.env[config.name];

    // Handle required variables
    if (!rawValue && config.required && config.defaultValue === undefined) {
      return {
        valid: false,
        error: `Required environment variable ${config.name} is not set`,
      };
    }

    // Use default value if variable is missing
    if (!rawValue && config.defaultValue !== undefined) {
      return {
        valid: true,
        value: config.defaultValue,
      };
    }

    // Parse and validate
    const parsedValue = this.parseValue(rawValue!, config.type);
    if (parsedValue === null) {
      return {
        valid: false,
        error: config.errorMessage || `Invalid value for ${config.name}: expected ${config.type}`,
      };
    }

    // Run custom validation if provided
    if (config.validation && !config.validation(parsedValue as EnvVarValue<T>)) {
      return {
        valid: false,
        error: config.errorMessage || `Validation failed for ${config.name}`,
      };
    }

    return {
      valid: true,
      value: parsedValue as EnvVarValue<T>,
    };
  }

  private parseValue<T extends EnvVarType>(value: string, type: T): EnvVarValue<T> | null {
    switch (type) {
      case 'string':
        return value as EnvVarValue<T>;

      case 'number': {
        const num = Number(value);
        return isNaN(num) ? null : (num as EnvVarValue<T>);
      }

      case 'boolean':
        return (value.toLowerCase() === 'true') as EnvVarValue<T>;

      case 'url':
        return isValidUrl(value) ? (new URL(value) as EnvVarValue<T>) : null;

      case 'email':
        return isValidEmail(value) ? (value as EnvVarValue<T>) : null;

      case 'port': {
        const port = Number(value);
        return isValidPort(port) ? (port as EnvVarValue<T>) : null;
      }

      case 'json':
        try {
          return JSON.parse(value) as EnvVarValue<T>;
        } catch {
          return null;
        }

      default:
        return null;
    }
  }
}

interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  error?: string;
}

// Example usage
const config: EnvVarConfig<'port'> = {
  name: 'PORT',
  type: 'port',
  required: true,
  defaultValue: 3000,
  validation: (port) => port >= 3000 && port <= 5000,
  errorMessage: 'Port must be between 3000 and 5000',
};
```

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 9 (API routes use environment configuration)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 1-7 (Streams A & B), Stories 9, 10 (Stream C)
**Work stream**: `shared-types` (Stream B)
**Rationale**: Environment validation is independent infrastructure; no shared dependencies

#### Definition of Done

- [ ] EnvVarType union type defined
- [ ] EnvVarValue mapped type created
- [ ] EnvVarConfig interface uses generic constrained type (no `any`)
- [ ] Type guards created for URL, email, port, JSON validation
- [ ] EnvironmentValidator class properly typed
- [ ] ValidationResult interface properly typed
- [ ] TypeScript compiler shows no errors
- [ ] All environment validation tests pass
- [ ] No ESLint explicit-any warnings
- [ ] Code review approved

#### Security Considerations

- Environment variable types prevent injection of malicious configuration
- URL validation prevents SSRF attacks through malformed URLs
- Port validation prevents binding to privileged ports
- JSON parsing validates structure to prevent prototype pollution

#### Testing Requirements

**Unit Tests**:

- Test validateVar with valid values for each type → success
- Test validateVar with invalid values → proper error messages
- Test default values are correctly applied
- Test custom validation functions work correctly
- Test type guards correctly identify valid/invalid values

**Security Tests**:

- Test URL validation rejects `javascript:` and `file:` URLs
- Test JSON parsing rejects prototype pollution attempts
- Test port validation rejects privileged ports (if required)

#### Performance Requirements

- Validation overhead at startup: < 10ms total
- No runtime performance impact (validation happens once)
- Build time increase: < 1 second

#### Estimated Complexity

**Size**: 1 point (1.5 hours)
**Breakdown**:

- 0.5 hour: Define type-safe EnvVarConfig interface
- 0.5 hour: Implement type guards and parsing
- 0.5 hour: Test and verify

**Priority**: Low
**Risk**: Low - Configuration validation is well-understood domain

---

### STORY 9: Type API Route Handlers with Proper Request/Response Types

**ID**: EPIC-001-S09
**Priority**: High
**Size**: 1 point (2-3 hours)
**Work Stream**: Stream C (API & Integration)
**Risk**: Medium (security-critical)

#### User Story

**As a** backend developer
**I want** properly typed API route handlers
**So that** request and response data is validated and type-safe across the API

#### Acceptance Criteria

- [ ] **Given** API route handlers
      **When** TypeScript analyzes the code
      **Then** all handlers use proper Vercel Request/Response types (no `any`)

- [ ] **Given** authentication middleware
      **When** user authentication occurs
      **Then** user object is properly typed (not `any`)

- [ ] **Given** query parameter parsing
      **When** requests include query params
      **Then** TypeScript validates query param types at compile time

#### Technical Implementation

**Files to Modify**:

- `packages/frontend/api/payments/create-payment-intent.ts`
- `packages/frontend/api/payments/webhook.ts`
- `packages/frontend/api/posts/index.ts`
- `packages/frontend/api/auth/register.ts`
- `packages/frontend/api/users/[id].ts`

**Current Issues**:

```typescript
// BEFORE (weak typing)
async function authenticateUser(req: VercelRequest): Promise<{ user: any; error?: string }> { ... }

function parseQueryParams(query: any) { ... }

async function handleGetUser(..., currentUser: any) { ... }
async function handleUpdateUser(..., currentUser: any) { ... }
async function handleDeleteUser(..., currentUser: any) { ... }

const response: any = { ... }
catch (err: any) { ... }
```

**Approach**:

```typescript
// Create shared API types
// packages/frontend/api/types/api-types.ts

import { User } from '@sovren/shared/types';

export interface AuthenticatedRequest extends VercelRequest {
  user: User;
}

export interface AuthResult {
  user: User | null;
  error?: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Query parameter types
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PostsQueryParams extends PaginationParams {
  authorId?: string;
  sortBy?: 'createdAt' | 'likesCount' | 'repliesCount';
  sortOrder?: 'asc' | 'desc';
}

// Update authentication middleware
async function authenticateUser(req: VercelRequest): Promise<AuthResult> {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return { user: null, error: 'No authentication token provided' };
    }

    // Validate token and get user (properly typed)
    const user = await verifyJWT<User>(token);
    return { user, error: undefined };
  } catch (error) {
    return { user: null, error: 'Invalid authentication token' };
  }
}

// Update query parameter parsing
function parseQueryParams(query: VercelRequest['query']): PostsQueryParams {
  const page = parseInt(query.page as string) || 1;
  const limit = Math.min(parseInt(query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
    authorId: query.authorId as string | undefined,
    sortBy: (query.sortBy as PostsQueryParams['sortBy']) || 'createdAt',
    sortOrder: (query.sortOrder as PostsQueryParams['sortOrder']) || 'desc',
  };
}

// Update handler signatures
async function handleGetUser(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  currentUser: User
): Promise<void> {
  // ... implementation
}

async function handleUpdateUser(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  currentUser: User
): Promise<void> {
  // ... implementation
}

async function handleDeleteUser(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  currentUser: User
): Promise<void> {
  // ... implementation
}

// Update response creation
const response: ApiSuccessResponse<User> = {
  success: true,
  data: user,
  message: 'User registered successfully',
};

// Update error handling
} catch (err) {
  const error = err as Error;
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: error.message,
    code: 'REGISTRATION_FAILED',
  };
  return res.status(500).json(errorResponse);
}
```

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 2 (frontend uses these API types), Story 6 (shared types), Story 4 (email service called from API)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 1-8 (Streams A & B), Story 10 (Stream C)
**Work stream**: `api-types` (Stream C)
**Rationale**: API route types are independent; can work in parallel with frontend and shared type improvements

#### Definition of Done

- [ ] API types file created (`api/types/api-types.ts`)
- [ ] AuthResult interface replaces `{ user: any; error?: string }`
- [ ] PostsQueryParams interface created for query parsing
- [ ] All `authenticateUser` functions use User type (not `any`)
- [ ] All handler functions use User type for currentUser parameter
- [ ] parseQueryParams uses proper Vercel query type
- [ ] All API responses use ApiResponse discriminated union
- [ ] Error handling uses Error type (not `any`)
- [ ] TypeScript compiler shows no errors in API routes
- [ ] All API integration tests pass
- [ ] Security review completed
- [ ] No ESLint explicit-any warnings
- [ ] Code review approved

#### Security Considerations

**CRITICAL**: API routes are the security boundary of the application

- User authentication must be properly typed to prevent privilege escalation
- Query parameter parsing must prevent SQL injection and XSS
- Error responses must not leak sensitive information
- Request validation must be type-safe to prevent injection attacks
- Authorization checks must use properly typed user objects

**Security Testing Required**:

- Test authentication with invalid tokens → proper error type
- Test query parameter injection attempts → sanitized
- Test privilege escalation attempts → blocked by type system
- Test error responses don't expose stack traces

#### Testing Requirements

**Unit Tests**:

- Test authenticateUser with valid token → returns User object
- Test authenticateUser with invalid token → returns null user
- Test parseQueryParams with valid params → returns typed object
- Test parseQueryParams with invalid params → uses defaults
- Test handler functions with proper User type

**Integration Tests**:

- Test full API request flow with authentication
- Test API responses conform to ApiResponse type
- Test error handling returns properly typed errors

**Security Tests**:

- Test SQL injection in query params → blocked
- Test XSS in query params → sanitized
- Test privilege escalation → denied

#### Performance Requirements

- No performance impact (compile-time only change)
- Query parsing overhead: < 1ms
- Build time increase: < 1 second

#### Estimated Complexity

**Size**: 1 point (2-3 hours)
**Breakdown**:

- 1 hour: Create API types and update authentication
- 1 hour: Update all route handlers
- 0.5 hour: Update error handling
- 0.5 hour: Security review

**Priority**: High
**Risk**: Medium - Security-critical component requiring thorough testing and review

---

### STORY 10: Type NOSTR Service Event Validation

**ID**: EPIC-001-S10
**Priority**: Medium
**Size**: 1 point (2 hours)
**Work Stream**: Stream C (API & Integration)
**Risk**: Low

#### User Story

**As a** developer integrating NOSTR protocol
**I want** properly typed NOSTR event validation
**So that** NOSTR events are type-safe and validated before signing/publishing

#### Acceptance Criteria

- [ ] **Given** NOSTR events requiring validation
      **When** TypeScript analyzes the code
      **Then** event validation uses proper typed schemas (not `any`)

- [ ] **Given** NOSTR event signing
      **When** events are finalized
      **Then** TypeScript validates event structure before signing

- [ ] **Given** feature flags in NOSTR service
      **When** feature flags are accessed
      **Then** TypeScript properly types feature flag values

#### Technical Implementation

**Files to Modify**:

- `packages/frontend/lib/services/nostrService.ts`

**Current Issues**:

```typescript
// BEFORE (weak typing)
private featureFlags: any;

const signedEvent = finalizeEvent(unsignedEvent as any, privateKeyBytes);

private validateAndNormalizeEvent(event: any): NostrEvent { ... }
```

**Approach**:

```typescript
// Import proper feature flag types
import { FeatureFlags } from '@sovren/shared/types';

// Type feature flags properly
private featureFlags: FeatureFlags;

// Remove unsafe type assertion
const signedEvent = finalizeEvent(unsignedEvent, privateKeyBytes);

// Update event validation with proper types
private validateAndNormalizeEvent(event: Partial<NostrEvent>): NostrEvent {
  // Validate required fields
  if (!event.kind || !event.content || !event.created_at || !event.tags) {
    throw new Error('Invalid NOSTR event: missing required fields');
  }

  // Validate field types
  if (typeof event.kind !== 'number') {
    throw new Error('Invalid NOSTR event: kind must be a number');
  }

  if (typeof event.content !== 'string') {
    throw new Error('Invalid NOSTR event: content must be a string');
  }

  if (typeof event.created_at !== 'number') {
    throw new Error('Invalid NOSTR event: created_at must be a number');
  }

  if (!Array.isArray(event.tags)) {
    throw new Error('Invalid NOSTR event: tags must be an array');
  }

  // Validate tag structure
  for (const tag of event.tags) {
    if (!Array.isArray(tag) || tag.length < 1) {
      throw new Error('Invalid NOSTR event: each tag must be a non-empty array');
    }
    if (typeof tag[0] !== 'string') {
      throw new Error('Invalid NOSTR event: tag identifier must be a string');
    }
  }

  // Return validated event
  return {
    kind: event.kind,
    content: event.content,
    created_at: event.created_at,
    tags: event.tags as string[][],
    pubkey: event.pubkey || '',
    id: event.id || '',
    sig: event.sig || '',
  };
}

// Add type-safe event builder
class NostrEventBuilder {
  private event: Partial<NostrEvent> = {
    tags: [],
    created_at: Math.floor(Date.now() / 1000),
  };

  kind(kind: number): this {
    this.event.kind = kind;
    return this;
  }

  content(content: string): this {
    this.event.content = content;
    return this;
  }

  tag(tag: string[]): this {
    if (!this.event.tags) this.event.tags = [];
    this.event.tags.push(tag);
    return this;
  }

  build(): NostrEvent {
    if (!this.event.kind || !this.event.content) {
      throw new Error('NOSTR event must have kind and content');
    }

    return {
      kind: this.event.kind,
      content: this.event.content,
      created_at: this.event.created_at!,
      tags: this.event.tags as string[][],
      pubkey: '',
      id: '',
      sig: '',
    };
  }
}

// Example usage
const event = new NostrEventBuilder()
  .kind(1)
  .content('Hello, NOSTR!')
  .tag(['p', 'pubkey123'])
  .tag(['e', 'eventId456'])
  .build();
```

#### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story 11 (strict mode depends on this)
**Related to**: Story 7 (NOSTR key management types), Story 6 (shared types)

#### Parallel Work Opportunities

**Can work simultaneously with**: Stories 1-9 (Streams A, B, C)
**Work stream**: `api-types` (Stream C)
**Rationale**: NOSTR service types are independent; safe to work in parallel

#### Definition of Done

- [ ] featureFlags property properly typed with FeatureFlags interface
- [ ] unsafe `as any` cast removed from finalizeEvent call
- [ ] validateAndNormalizeEvent uses proper typed parameter (not `any`)
- [ ] Event validation includes comprehensive field and type checks
- [ ] NostrEventBuilder class created for type-safe event construction
- [ ] TypeScript compiler shows no errors in nostrService.ts
- [ ] All NOSTR service tests pass
- [ ] No ESLint explicit-any warnings
- [ ] Code review approved

#### Security Considerations

- NOSTR event validation prevents malformed events from being signed
- Proper typing prevents signature verification bypasses
- Feature flag typing prevents unauthorized feature access

#### Testing Requirements

**Unit Tests**:

- Test validateAndNormalizeEvent with valid event → returns NostrEvent
- Test validateAndNormalizeEvent with missing fields → throws error
- Test validateAndNormalizeEvent with invalid types → throws error
- Test NostrEventBuilder creates valid events
- Test NostrEventBuilder throws error for incomplete events

**Integration Tests**:

- Test full NOSTR event creation and signing flow
- Test event validation before publishing

#### Performance Requirements

- Event validation overhead: < 1ms per event
- No performance impact on event signing
- Build time increase: < 1 second

#### Estimated Complexity

**Size**: 1 point (2 hours)
**Breakdown**:

- 0.5 hour: Type feature flags properly
- 0.5 hour: Update event validation
- 0.5 hour: Create NostrEventBuilder
- 0.5 hour: Test and verify

**Priority**: Medium
**Risk**: Low - Well-defined NOSTR protocol with clear validation requirements

---

### STORY 11: Enable Stricter TypeScript Compiler Options Incrementally

**ID**: EPIC-001-S11
**Priority**: Critical
**Size**: 1 point (1.5-2 hours)
**Work Stream**: Stream D (Strict Mode)
**Risk**: Medium (may reveal hidden issues)

#### User Story

**As a** team lead enforcing code quality
**I want** stricter TypeScript compiler options enabled
**So that** the type system catches more errors at compile time and prevents runtime bugs

#### Acceptance Criteria

- [ ] **Given** TypeScript configuration files
      **When** stricter compiler options are enabled
      **Then** all existing code continues to compile without errors

- [ ] **Given** strict mode enabled
      **When** developers write new code
      **Then** TypeScript enforces stricter type checking rules

- [ ] **Given** stricter compiler options
      **When** the codebase is compiled
      **Then** build time does not increase by more than 5%

#### Technical Implementation

**Files to Modify**:

- `tsconfig.json` (root)
- `packages/frontend/tsconfig.json`
- `packages/shared/tsconfig.json`
- `packages/backend/tsconfig.json`

**Current State**:
All packages already have `"strict": true` enabled. This story focuses on enabling additional strict options.

**Additional Strict Options to Enable**:

```json
{
  "compilerOptions": {
    "strict": true, // ✅ Already enabled

    // Enable additional strict options incrementally
    "noImplicitAny": true, // ✅ Included in strict, but explicit
    "strictNullChecks": true, // ✅ Included in strict
    "strictFunctionTypes": true, // ✅ Included in strict
    "strictBindCallApply": true, // ✅ Included in strict
    "strictPropertyInitialization": true, // ✅ Included in strict
    "noImplicitThis": true, // ✅ Included in strict
    "alwaysStrict": true, // ✅ Included in strict

    // Additional strictness (not included in "strict")
    "noUncheckedIndexedAccess": true, // ⚠️ Enable this
    "noImplicitOverride": true, // ⚠️ Enable this
    "noPropertyAccessFromIndexSignature": false, // Keep disabled for flexibility

    // Type checking improvements
    "exactOptionalPropertyTypes": false, // Too strict for current codebase

    // Ensure no any types slip through
    "noImplicitAny": true,
    "suppressImplicitAnyIndexErrors": false
  }
}
```

**Incremental Enablement Strategy**:

1. **Phase 1**: Verify all previous stories (1-10) are complete
2. **Phase 2**: Enable `noUncheckedIndexedAccess` (safest)
3. **Phase 3**: Enable `noImplicitOverride` (low impact)
4. **Phase 4**: Fix any new errors revealed by stricter options
5. **Phase 5**: Measure build time impact

**Expected New Errors**:

- `noUncheckedIndexedAccess`: Array/object access returns `T | undefined`
- `noImplicitOverride`: Methods overriding base class methods need `override` keyword

**Example Fixes**:

```typescript
// BEFORE (with noUncheckedIndexedAccess disabled)
const items = ['a', 'b', 'c'];
const first = items[0]; // Type: string
console.log(first.toUpperCase()); // No error, but could crash if array is empty

// AFTER (with noUncheckedIndexedAccess enabled)
const items = ['a', 'b', 'c'];
const first = items[0]; // Type: string | undefined
if (first) {
  console.log(first.toUpperCase()); // Safe
}

// BEFORE (with noImplicitOverride disabled)
class Base {
  doSomething() {}
}
class Derived extends Base {
  doSomething() {} // No error, but might be unintentional override
}

// AFTER (with noImplicitOverride enabled)
class Derived extends Base {
  override doSomething() {} // Explicit override keyword required
}
```

#### Dependencies

**Blocked by**: Stories 1-10 (ALL previous stories MUST be complete)
**Blocks**: Story 12 (validation depends on strict mode being enabled)
**Related to**: All previous stories

#### Parallel Work Opportunities

**Can work simultaneously with**: None - Sequential dependency on stories 1-10
**Work stream**: `strict-mode` (Stream D)
**Rationale**: Must wait for all `any` types to be replaced before enabling stricter checks

#### Definition of Done

- [ ] `noUncheckedIndexedAccess: true` added to all tsconfig.json files
- [ ] `noImplicitOverride: true` added to all tsconfig.json files
- [ ] All new type errors fixed (array access, override keywords)
- [ ] TypeScript compiler shows no errors across all packages
- [ ] All tests pass (unit, integration, E2E)
- [ ] Build time measured and documented (< 5% increase)
- [ ] CI/CD pipeline passes with new strict options
- [ ] Code review approved
- [ ] Documentation updated with new strict mode requirements

#### Security Considerations

- Stricter type checking prevents potential null/undefined bugs that could cause security issues
- `noUncheckedIndexedAccess` prevents accessing undefined array elements that could bypass validation
- `noImplicitOverride` prevents accidentally overriding security-critical base class methods

#### Testing Requirements

**Validation Tests**:

- Run full TypeScript compiler on all packages → no errors
- Run all unit tests → all pass
- Run all integration tests → all pass
- Run all E2E tests → all pass
- Measure build time before and after → < 5% increase

**Regression Tests**:

- Test all critical user flows (login, signup, posting, payments)
- Verify no runtime errors introduced by type fixes
- Test array/object access with edge cases (empty arrays, missing keys)

#### Performance Requirements

- Build time increase: < 5% (measured)
- No runtime performance impact (compile-time only)
- Type checking time: acceptable for developer experience (< 30s for full check)

#### Estimated Complexity

**Size**: 1 point (1.5-2 hours)
**Breakdown**:

- 0.5 hour: Enable stricter options in all tsconfig.json files
- 0.5 hour: Fix new type errors revealed (array access, overrides)
- 0.5 hour: Run full test suite and verify
- 0.5 hour: Measure and document build time impact

**Priority**: Critical
**Risk**: Medium - May reveal hidden bugs, but previous stories have prepared the codebase

---

### STORY 12: Fix Strict Mode Violations and Validate Type Coverage

**ID**: EPIC-001-S12
**Priority**: Critical
**Size**: 1 point (1.5-2 hours)
**Work Stream**: Stream D (Strict Mode)
**Risk**: Low (validation and cleanup)

#### User Story

**As a** team lead ensuring code quality
**I want** all strict mode violations fixed and type coverage validated
**So that** the codebase maintains 100% type safety and elite quality standards

#### Acceptance Criteria

- [ ] **Given** strict TypeScript mode enabled
      **When** the codebase is compiled
      **Then** zero type errors exist across all packages

- [ ] **Given** type coverage tools
      **When** type coverage is measured
      **Then** type coverage is 100% (or 99%+ with documented exceptions)

- [ ] **Given** ESLint configuration
      **When** linting runs
      **Then** no `@typescript-eslint/no-explicit-any` warnings exist

#### Technical Implementation

**Tools to Use**:

- `tsc --noEmit` - TypeScript compiler check
- `type-coverage` - Type coverage measurement tool
- `eslint` - Linting with explicit-any rules

**Tasks**:

1. **Install type-coverage tool**:

```bash
npm install --save-dev type-coverage
```

2. **Add type-coverage scripts to package.json**:

```json
{
  "scripts": {
    "type-check": "tsc --noEmit",
    "type-check:all": "npm run type-check --workspaces",
    "type-coverage": "type-coverage --strict --at-least 99",
    "type-coverage:report": "type-coverage --strict --detail"
  }
}
```

3. **Run comprehensive type checking**:

```bash
# Check each package
cd packages/frontend && npm run type-check
cd packages/shared && npm run type-check
cd packages/backend && npm run type-check

# Check root
tsc --noEmit
```

4. **Measure type coverage**:

```bash
npx type-coverage --detail
```

5. **Fix any remaining issues**:

- Address any type errors revealed by strict mode
- Replace any remaining `any` types discovered by tools
- Add proper type annotations where inferred types are weak

6. **Update ESLint configuration**:

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error", // Upgraded from "warn"
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-return": "warn"
  }
}
```

7. **Create type coverage badge**:

```markdown
<!-- Add to README.md -->

![Type Coverage](https://img.shields.io/badge/type--coverage-100%25-brightgreen)
```

8. **Document any legitimate exceptions**:

```typescript
// Legitimate use of 'any' for external library integration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const externalLibResult: any = externalLib.getData();
```

#### Dependencies

**Blocked by**: Story 11 (strict mode must be enabled first)
**Blocks**: None (final story in Epic)
**Related to**: All previous stories (validates their completion)

#### Parallel Work Opportunities

**Can work simultaneously with**: None - Sequential dependency on story 11
**Work stream**: `strict-mode` (Stream D)
**Rationale**: Must wait for strict mode to be enabled before validating compliance

#### Definition of Done

- [ ] type-coverage tool installed and configured
- [ ] Type coverage script added to package.json
- [ ] `npm run type-check:all` passes with zero errors
- [ ] `npm run type-coverage` reports 100% (or 99%+ with documented exceptions)
- [ ] ESLint shows no `no-explicit-any` errors
- [ ] All remaining type issues fixed or documented
- [ ] Type coverage badge added to README.md
- [ ] CI/CD pipeline includes type coverage check
- [ ] Documentation updated with type safety standards
- [ ] Epic success criteria validated and documented
- [ ] Code review approved
- [ ] Epic marked as complete

#### Security Considerations

- 100% type coverage prevents type-related security vulnerabilities
- Strict null checks prevent null/undefined vulnerabilities
- Proper typing enforces validation of user input

#### Testing Requirements

**Validation Tests**:

- Run `tsc --noEmit` on all packages → 0 errors
- Run `type-coverage` → ≥ 99% coverage
- Run ESLint with strict rules → 0 explicit-any warnings
- Run full test suite → all tests pass
- Verify CI/CD pipeline passes with new checks

**Documentation**:

- Document any remaining `any` types with justification
- Document type coverage measurement process
- Update contributing guide with type safety requirements

#### Performance Requirements

- Type checking time: < 30 seconds for full codebase
- Type coverage measurement: < 10 seconds
- No runtime performance impact

#### Estimated Complexity

**Size**: 1 point (1.5-2 hours)
**Breakdown**:

- 0.5 hour: Install and configure type-coverage tool
- 0.5 hour: Run checks and fix any remaining issues
- 0.5 hour: Update ESLint configuration and verify
- 0.5 hour: Create documentation and validate Epic completion

**Priority**: Critical
**Risk**: Low - Validation and cleanup work, all hard work done in previous stories

---

## Dependency Graph

```
Sprint 0: Foundation (Parallel Work, 6-8 hours)
├─ Stream A: Frontend Types (5 stories, 1 developer)
│  ├─ Story 1: Event Handlers ────┐
│  ├─ Story 2: API Responses ──────┤
│  ├─ Story 3: Validation ─────────┼──> All must complete
│  ├─ Story 4: Email Service ──────┤    before Story 11
│  └─ Story 5: Test Utilities ─────┘
│
├─ Stream B: Shared Types (3 stories, 1 developer)
│  ├─ Story 6: Quality Metrics ────┐
│  ├─ Story 7: NOSTR Keys ─────────┼──> All must complete
│  └─ Story 8: Environment ────────┘    before Story 11
│
└─ Stream C: API & Integration (2 stories, 1 developer)
   ├─ Story 9: API Routes ─────────┐
   └─ Story 10: NOSTR Service ─────┘──> All must complete
                                         before Story 11

Sprint 1: Strict Mode (Sequential, 2-3 hours)
└─ Stream D: Strict Mode (2 stories, 1 developer)
   ├─ Story 11: Enable Strict Mode ──> Depends on Stories 1-10
   └─ Story 12: Validate Coverage ──> Depends on Story 11
```

## Parallel Work Strategy

### Maximum Parallelization (3 Developers)

**Developer 1 (Frontend Specialist) - Stream A**:

- Story 1: Event Handlers (2-3 hours)
- Story 2: API Responses (2-3 hours)
- Story 3: Validation (2-3 hours)
- Story 4: Email Service (2 hours)
- Story 5: Test Utilities (2 hours)
  **Total**: ~12 hours (1.5 days)

**Developer 2 (Shared/Backend Specialist) - Stream B**:

- Story 6: Quality Metrics (2-3 hours)
- Story 7: NOSTR Keys (1.5-2 hours)
- Story 8: Environment (1.5 hours)
  **Total**: ~6 hours (0.75 days)

**Developer 3 (API Specialist) - Stream C**:

- Story 9: API Routes (2-3 hours)
- Story 10: NOSTR Service (2 hours)
  **Total**: ~5 hours (0.6 days)

**After Streams A+B+C Complete (Any Developer) - Stream D**:

- Story 11: Enable Strict Mode (1.5-2 hours)
- Story 12: Validate Coverage (1.5-2 hours)
  **Total**: ~3.5 hours (0.4 days)

**Total Calendar Time**: 2 days with 3 developers working in parallel

### Minimum Parallelization (1 Developer)

**Sequential Execution**:

- Sprint 0: Stories 1-10 (~24 hours = 3 days)
- Sprint 1: Stories 11-12 (~3.5 hours = 0.5 days)
  **Total Calendar Time**: 3.5 days with 1 developer

---

## Risk Assessment

### High-Risk Stories (require extra attention)

**Story 3: Validation Middleware** (Medium Risk)

- Security-critical component handling user input
- Mitigation: Comprehensive security testing, multiple code reviews

**Story 9: API Route Handlers** (Medium Risk)

- Security boundary of the application
- Mitigation: Security review, penetration testing, type-safe request validation

**Story 11: Enable Strict Mode** (Medium Risk)

- May reveal hidden bugs in existing code
- Mitigation: Incremental enablement, comprehensive regression testing

### Low-Risk Stories

All other stories (1, 2, 4, 5, 6, 7, 8, 10, 12) are low risk:

- Well-understood typing patterns
- Comprehensive test coverage
- No security-critical functionality
- Easy to rollback if issues arise

---

## Success Metrics

### Epic Success Criteria Validation

**At completion of Story 12, verify**:

- ✅ All `any` types replaced with proper types (run grep check)
- ✅ TypeScript strict mode enabled in all tsconfig.json files
- ✅ Type coverage reports show 100% (or 99%+ with documented exceptions)
- ✅ All tests passing (unit, integration, E2E)
- ✅ No new type errors introduced
- ✅ Build time not significantly impacted (< 5% increase)

### Additional Success Metrics

- Zero ESLint `no-explicit-any` warnings
- All 12 stories completed and merged
- CI/CD pipeline includes type coverage checks
- Documentation updated with type safety standards
- Team trained on new strict mode requirements

---

## Next Steps

1. **Review and Approve Stories**: Team review of this breakdown
2. **Assign Developers**: Assign developers to work streams (A, B, C)
3. **Create GitHub Issues**: Convert stories to GitHub issues with labels
4. **Begin Sprint 0**: Start parallel work on stories 1-10
5. **Daily Standups**: Coordinate cross-stream dependencies
6. **Sprint 1**: After Sprint 0 completion, enable strict mode (stories 11-12)
7. **Retrospective**: Document lessons learned and update practices

---

## Labels for GitHub Issues

Apply these labels to each story issue:

**Work Stream Labels**:

- `stream-a-frontend` (Stories 1-5)
- `stream-b-shared` (Stories 6-8)
- `stream-c-api` (Stories 9-10)
- `stream-d-strict` (Stories 11-12)

**Priority Labels**:

- `priority-critical` (Stories 11, 12)
- `priority-high` (Stories 1, 2, 3, 6, 9)
- `priority-medium` (Stories 4, 5, 7, 10)
- `priority-low` (Story 8)

**Risk Labels**:

- `risk-medium` (Stories 3, 9, 11)
- `risk-low` (All others)

**Type Labels**:

- `type-refactoring`
- `epic-001-type-safety`
- `1-point-story`

**Sprint Labels**:

- `sprint-0-foundation` (Stories 1-10)
- `sprint-1-strict-mode` (Stories 11-12)

---

**End of Story Breakdown**
