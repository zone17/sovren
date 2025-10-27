# Code Quality Standards

This document establishes the comprehensive code quality standards for the Sovren platform. These standards ensure maintainable, secure, and scalable code that meets elite engineering requirements while following industry best practices.

## 📋 Table of Contents

- [Core Principles](#core-principles)
- [Code Style Standards](#code-style-standards)
- [Testing Requirements](#testing-requirements)
- [Security Standards](#security-standards)
- [Performance Standards](#performance-standards)
- [Documentation Standards](#documentation-standards)
- [Quality Gates](#quality-gates)
- [Automated Enforcement](#automated-enforcement)

## 🎯 Core Principles

### Clean Code Fundamentals

Based on industry-leading clean code principles, our standards emphasize:

1. **Functions Should Do One Thing**: Single responsibility principle at the function level
2. **Clear Naming**: Intention-revealing names for variables, functions, and classes
3. **Short Functions**: Functions should be small and focused (max 20 lines)
4. **Cohesive Files**: Each file should represent a single module with a clear purpose
5. **No Duplication**: DRY (Don't Repeat Yourself) principle throughout the codebase

### Elite Engineering Standards

- **Zero Tolerance for Technical Debt**: Address issues immediately, don't accumulate debt
- **Security by Design**: Security considerations in every line of code
- **Performance First**: Write efficient code from the start
- **Test-Driven Development**: Tests before implementation
- **Documentation as Code**: Code should be self-documenting with appropriate comments

## 📝 Code Style Standards

### TypeScript/JavaScript Standards

#### Naming Conventions

```typescript
// ✅ Good: Clear, intention-revealing names
function calculateMonthlyRecurringRevenue(subscriptions: Subscription[]): number {
  return subscriptions
    .filter((subscription) => subscription.isActive)
    .reduce((total, subscription) => total + subscription.monthlyAmount, 0);
}

// ❌ Bad: Unclear, abbreviated names
function calcMRR(subs: any[]): number {
  return subs.filter((s) => s.active).reduce((t, s) => t + s.amt, 0);
}
```

#### Function Standards

```typescript
// ✅ Good: Single responsibility, clear purpose
function validateEmailAddress(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sendWelcomeEmail(userEmail: string): Promise<void> {
  if (!validateEmailAddress(userEmail)) {
    throw new Error('Invalid email address');
  }
  return emailService.send({
    to: userEmail,
    template: 'welcome',
  });
}

// ❌ Bad: Multiple responsibilities
function validateAndSendEmail(email: string): Promise<void> {
  // Validation logic
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email');
  }

  // Email sending logic
  return emailService.send({
    to: email,
    template: 'welcome',
  });
}
```

#### Class Standards

```typescript
// ✅ Good: Clear responsibility, proper encapsulation
class LightningPaymentProcessor {
  private readonly lnbitsClient: LNbitsClient;
  private readonly webhookSecret: string;

  constructor(config: LightningConfig) {
    this.lnbitsClient = new LNbitsClient(config);
    this.webhookSecret = config.webhookSecret;
  }

  async createInvoice(amount: number, description: string): Promise<Invoice> {
    this.validateAmount(amount);
    return this.lnbitsClient.createInvoice({ amount, description });
  }

  private validateAmount(amount: number): void {
    if (amount < 1000 || amount > 100000000) {
      throw new Error('Amount must be between 1,000 and 100,000,000 satoshis');
    }
  }
}
```

### React Component Standards

```typescript
// ✅ Good: Clear props interface, single responsibility
interface PaymentButtonProps {
  amount: number;
  description: string;
  onPaymentComplete: (invoice: Invoice) => void;
  onPaymentError: (error: Error) => void;
  disabled?: boolean;
}

export function PaymentButton({
  amount,
  description,
  onPaymentComplete,
  onPaymentError,
  disabled = false,
}: PaymentButtonProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = useCallback(async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      const invoice = await lightningService.createInvoice(amount, description);
      onPaymentComplete(invoice);
    } catch (error) {
      onPaymentError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [amount, description, disabled, isLoading, onPaymentComplete, onPaymentError]);

  return (
    <button
      onClick={handlePayment}
      disabled={disabled || isLoading}
      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
    >
      {isLoading ? 'Processing...' : `Pay ${amount} sats`}
    </button>
  );
}
```

## 🧪 Testing Requirements

### Test Coverage Standards

- **Minimum Coverage**: 95% line coverage for all code
- **Branch Coverage**: 90% branch coverage minimum
- **Function Coverage**: 100% function coverage
- **Critical Path Coverage**: 100% coverage for payment, authentication, and security functions

### Testing Hierarchy

#### Unit Tests (Foundation)

```typescript
// ✅ Good: Comprehensive unit test with edge cases
describe('LightningPaymentProcessor', () => {
  let processor: LightningPaymentProcessor;
  let mockLNbitsClient: jest.Mocked<LNbitsClient>;

  beforeEach(() => {
    mockLNbitsClient = createMockLNbitsClient();
    processor = new LightningPaymentProcessor({
      client: mockLNbitsClient,
      webhookSecret: 'test-secret',
    });
  });

  describe('createInvoice', () => {
    it('should create invoice with valid amount', async () => {
      const amount = 5000;
      const description = 'Test payment';
      const expectedInvoice = { id: 'inv123', amount, description };

      mockLNbitsClient.createInvoice.mockResolvedValue(expectedInvoice);

      const result = await processor.createInvoice(amount, description);

      expect(result).toEqual(expectedInvoice);
      expect(mockLNbitsClient.createInvoice).toHaveBeenCalledWith({
        amount,
        description,
      });
    });

    it('should throw error for amount below minimum', async () => {
      const amount = 500; // Below 1000 minimum

      await expect(processor.createInvoice(amount, 'test')).rejects.toThrow(
        'Amount must be between 1,000 and 100,000,000 satoshis'
      );
    });

    it('should throw error for amount above maximum', async () => {
      const amount = 200000000; // Above 100M maximum

      await expect(processor.createInvoice(amount, 'test')).rejects.toThrow(
        'Amount must be between 1,000 and 100,000,000 satoshis'
      );
    });

    it('should handle LNbits client errors gracefully', async () => {
      const amount = 5000;
      const clientError = new Error('LNbits API error');

      mockLNbitsClient.createInvoice.mockRejectedValue(clientError);

      await expect(processor.createInvoice(amount, 'test')).rejects.toThrow(clientError);
    });
  });
});
```

## 🔒 Security Standards

### Input Validation

```typescript
// ✅ Good: Comprehensive input validation
function validateUserInput(input: unknown): UserInput {
  const schema = z.object({
    name: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9\s-_]+$/),
    email: z.string().email(),
    bio: z.string().max(500).optional(),
    lightningAddress: z.string().regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  });

  try {
    return schema.parse(input);
  } catch (error) {
    throw new ValidationError('Invalid user input', { cause: error });
  }
}
```

### Authentication & Authorization

```typescript
// ✅ Good: Secure authentication middleware
export function requireAuthentication(requiredRole?: UserRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const payload = await verifyJWT(token);
      const user = await userService.findById(payload.userId);

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid or inactive user' });
      }

      if (requiredRole && !user.hasRole(requiredRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.user = user;
      next();
    } catch (error) {
      logger.warn('Authentication failed', { error: error.message });
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };
}
```

## ⚡ Performance Standards

### Database Query Optimization

```typescript
// ✅ Good: Optimized database queries
class ContentService {
  async getCreatorContent(
    creatorId: string,
    options: PaginationOptions
  ): Promise<PaginatedContent> {
    // Use indexed fields for efficient querying
    const query = this.db
      .select('id', 'title', 'excerpt', 'created_at', 'view_count')
      .from('content')
      .where('creator_id', creatorId)
      .where('status', 'published')
      .orderBy('created_at', 'desc')
      .limit(options.limit)
      .offset(options.offset);

    const [content, totalCount] = await Promise.all([
      query,
      this.db
        .count('*')
        .from('content')
        .where('creator_id', creatorId)
        .where('status', 'published')
        .first(),
    ]);

    return {
      items: content,
      total: totalCount.count,
      hasMore: options.offset + options.limit < totalCount.count,
    };
  }
}
```

## 📚 Documentation Standards

### Code Documentation

````typescript
/**
 * Processes Lightning Network payments for content creators
 *
 * This service handles the complete payment flow including:
 * - Invoice creation and validation
 * - Payment verification
 * - Webhook processing
 * - Revenue distribution
 *
 * @example
 * ```typescript
 * const processor = new LightningPaymentProcessor(config);
 * const invoice = await processor.createInvoice(1000, 'Content payment');
 * ```
 */
export class LightningPaymentProcessor {
  /**
   * Creates a Lightning invoice for content payment
   *
   * @param amount - Amount in satoshis (1000-100000000)
   * @param description - Human-readable payment description
   * @param metadata - Optional payment metadata
   * @returns Promise resolving to created invoice
   *
   * @throws {ValidationError} When amount is outside valid range
   * @throws {LightningError} When LNbits API call fails
   *
   * @example
   * ```typescript
   * const invoice = await processor.createInvoice(5000, 'Article: "Bitcoin Basics"');
   * console.log(`Payment request: ${invoice.paymentRequest}`);
   * ```
   */
  async createInvoice(
    amount: number,
    description: string,
    metadata?: PaymentMetadata
  ): Promise<Invoice> {
    // Implementation...
  }
}
````

## 🚪 Quality Gates

### Pre-Commit Checks

1. **Linting**: ESLint with TypeScript rules
2. **Formatting**: Prettier with consistent configuration
3. **Type Checking**: TypeScript strict mode validation
4. **Unit Tests**: All tests must pass
5. **Security Scan**: No high/critical vulnerabilities

### Pre-Push Checks

1. **Integration Tests**: All integration tests pass
2. **Build Verification**: Successful build for all environments
3. **Coverage Check**: Minimum coverage thresholds met
4. **Performance Tests**: No performance regressions

### Pre-Merge Checks

1. **Code Review**: At least one approved review
2. **E2E Tests**: Critical user journeys pass
3. **Security Review**: Security team approval for sensitive changes
4. **Documentation**: All changes documented

## 🤖 Automated Enforcement

### ESLint Configuration

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:security/recommended"
  ],
  "rules": {
    "max-lines-per-function": ["error", 20],
    "max-params": ["error", 3],
    "complexity": ["error", 5],
    "no-console": "error",
    "prefer-const": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "security/detect-object-injection": "error"
  }
}
```

### Jest Configuration

```json
{
  "collectCoverageFrom": [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{ts,tsx}",
    "!src/**/__tests__/**"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 90,
      "functions": 100,
      "lines": 95,
      "statements": 95
    }
  }
}
```

---

**Remember**: These standards are living guidelines that evolve with our platform. Quality is not a destination but a continuous journey toward excellence.
