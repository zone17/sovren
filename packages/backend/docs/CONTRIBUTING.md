# 🤝 Contributing to Sovren Backend

**Development guidelines and standards for contributing to the Sovren Backend**

## 🎯 Welcome, Elite Engineers!

Thank you for contributing to Sovren Backend! This guide outlines our **elite engineering standards** and development practices. We maintain **world-class code quality** and follow industry best practices to ensure scalable, secure, and maintainable software.

### 🎪 Our Engineering Culture

- **Test-Driven Development (TDD)**: Write tests before implementation
- **Behavior-Driven Development (BDD)**: Focus on user scenarios and outcomes
- **Security-First**: Consider security implications in every decision
- **Performance-Conscious**: Optimize for scale and responsiveness
- **Documentation-Driven**: Explain the "why" behind every decision
- **Clean Architecture**: SOLID principles and separation of concerns

---

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 18+** and npm
- **Git** for version control
- **VS Code** (recommended) with suggested extensions
- **Supabase Account** for database access
- **Understanding of TypeScript, Express.js, and NOSTR**

### 🔧 Development Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/your-username/sovren.git
cd sovren/packages/backend

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your development configuration

# 4. Run tests to verify setup
npm test

# 5. Start development server
npm run dev
```

### 🔑 Environment Configuration

```env
# Development Environment Variables
NODE_ENV=development
PORT=3001

# Database (Supabase)
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-anon-key

# Security
JWT_SECRET=your-development-secret-key

# Testing (Optional)
TEST_SUPABASE_URL=http://localhost:54321
TEST_SUPABASE_KEY=test-key
```

---

## 📋 Development Workflow

### 🌿 Git Workflow

We follow **GitHub Flow** with strict quality controls:

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 2. Make changes following our standards
# - Write tests first (TDD)
# - Implement functionality
# - Update documentation

# 3. Commit with conventional commits
git add .
git commit -m "feat: add user profile search functionality

- Implement search endpoint with pagination
- Add search index for performance
- Include comprehensive test coverage
- Update API documentation

Closes #123"

# 4. Push and create pull request
git push origin feature/your-feature-name
# Create PR via GitHub interface
```

### 📝 Conventional Commits

We use **Conventional Commits** for clear, automated changelog generation:

```bash
# Commit types:
feat:     # New features
fix:      # Bug fixes
docs:     # Documentation changes
style:    # Code formatting (no logic changes)
refactor: # Code refactoring
test:     # Adding or updating tests
chore:    # Build process or auxiliary tool changes
perf:     # Performance improvements
ci:       # CI/CD changes
```

#### Commit Message Format

```
<type>(<scope>): <description>

<body>

<footer>
```

#### Examples

```bash
# Feature addition
git commit -m "feat(auth): implement NOSTR challenge generation

- Add cryptographically secure challenge creation
- Include expiration timestamp validation
- Add comprehensive test coverage for edge cases

Closes #45"

# Bug fix
git commit -m "fix(db): resolve connection pool timeout issue

- Increase connection timeout to 30 seconds
- Add retry logic for transient failures
- Update error handling for better diagnostics

Fixes #67"

# Breaking change
git commit -m "feat(api)!: redesign user authentication API

BREAKING CHANGE: Authentication endpoints now require
different request format. See migration guide in CHANGELOG.md

- Simplify authentication flow
- Improve security with updated challenge format
- Add backwards compatibility layer

Closes #89"
```

---

## 🧪 Testing Standards

### Test-Driven Development (TDD)

**Always write tests before implementation:**

```typescript
// 1. Write failing test
describe('User Repository', () => {
  it('should create user with valid NOSTR pubkey', async () => {
    // Given
    const userData = {
      nostr_pubkey: 'valid64characterhexstring...',
      username: 'testuser'
    };

    // When
    const result = await userRepository.create(userData);

    // Then
    expect(result.success).toBe(true);
    expect(result.user?.username).toBe('testuser');
  });
});

// 2. Implement minimal functionality to pass
// 3. Refactor while keeping tests green
```

### Test Categories

#### 1. Unit Tests (`*.test.ts`)

```typescript
// Test individual functions/methods
describe('validateNostrPubkey', () => {
  it('should validate correct 64-character hex string', () => {
    const validKey = '1234567890abcdef'.repeat(4);
    expect(validateNostrPubkey(validKey)).toBe(true);
  });

  it('should reject invalid format', () => {
    expect(validateNostrPubkey('invalid')).toBe(false);
  });
});
```

#### 2. Integration Tests (`__tests__/integration/*.test.ts`)

```typescript
// Test component interactions
describe('Database Integration', () => {
  it('should create and retrieve user profile', async () => {
    // Test repository + service + database interaction
    const user = await userService.createProfile(userData);
    const retrieved = await userService.findByNostrPubkey(user.nostr_pubkey);

    expect(retrieved.success).toBe(true);
  });
});
```

#### 3. API Tests (`routes/__tests__/*.test.ts`)

```typescript
// Test HTTP endpoints
describe('Authentication API', () => {
  it('POST /api/auth/challenge should generate challenge', async () => {
    const response = await request(app)
      .post('/api/auth/challenge')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.challenge).toHaveLength(64);
  });
});
```

### Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- user-repository.test.ts

# Run tests in watch mode
npm run test:watch

# Run tests with verbose output
npm test -- --verbose
```

### Testing Best Practices

1. **BDD Format**: Use Given/When/Then structure
2. **Descriptive Names**: Test names should explain the scenario
3. **Isolated Tests**: Each test should be independent
4. **Clean Setup**: Use beforeEach/afterEach for test isolation
5. **Mock External Dependencies**: Don't test external services
6. **Edge Cases**: Test boundary conditions and error scenarios

---

## 🏗️ Code Standards

### TypeScript Configuration

**Strict mode is mandatory:**

```typescript
// tsconfig.json enforces:
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noImplicitReturns": true,
"noUncheckedIndexedAccess": true
```

### Code Style Guidelines

#### 1. Naming Conventions

```typescript
// Classes: PascalCase
class UserService {}
class NostrAuthService {}

// Functions/Variables: camelCase
const validateNostrPubkey = () => {};
const userRepository = new UserRepository();

// Constants: SCREAMING_SNAKE_CASE
const JWT_EXPIRATION_TIME = '24h';
const DEFAULT_PAGE_SIZE = 20;

// Types/Interfaces: PascalCase
interface UserProfile {}
type CreateUserRequest = {};

// Files: kebab-case
user-repository.ts
nostr-auth.service.ts
```

#### 2. Function Structure

```typescript
/**
 * 🔍 Find User by NOSTR Public Key
 *
 * WHY: Primary authentication lookup method that combines
 * cache checking with database fallback for optimal performance
 *
 * @param nostrPubkey - 64-character hex NOSTR public key
 * @returns Promise with user data or error information
 */
async function findByNostrPubkey(nostrPubkey: string): Promise<{
  success: boolean;
  user?: UserProfile;
  error?: string;
}> {
  // Input validation
  if (!validateNostrPubkey(nostrPubkey)) {
    return {
      success: false,
      error: 'Invalid NOSTR public key format'
    };
  }

  try {
    // Business logic with clear comments
    const cachedUser = this.cache.get(nostrPubkey);
    if (cachedUser) {
      return { success: true, user: cachedUser };
    }

    // Database fallback
    const dbUser = await this.repository.findByNostrPubkey(nostrPubkey);
    if (dbUser.success) {
      this.cache.set(nostrPubkey, dbUser.user);
    }

    return dbUser;
  } catch (error) {
    // Comprehensive error handling
    return {
      success: false,
      error: `User lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
```

#### 3. Error Handling Patterns

```typescript
// Consistent error response format
interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Error handling with proper typing
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  if (error instanceof ValidationError) {
    return {
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR'
    };
  }

  if (error instanceof DatabaseError) {
    return {
      success: false,
      error: 'Database operation failed',
      code: 'DATABASE_ERROR'
    };
  }

  // Generic error fallback
  return {
    success: false,
    error: 'Operation failed',
    code: 'UNKNOWN_ERROR'
  };
}
```

### 📚 Documentation Standards

#### 1. Code Comments

```typescript
/**
 * 🗄️ Elite User Repository
 *
 * Production-ready database operations with:
 * - **Security**: SQL injection protection, input validation
 * - **Performance**: Optimized queries, proper indexing
 * - **Reliability**: Error handling, transaction management
 * - **Scalability**: Efficient data access patterns
 *
 * WHY: Repository pattern separates business logic from data access,
 * making the code more testable, maintainable, and scalable.
 */
export class UserRepository {
  /**
   * 🏗️ Create New User Profile
   * WHY: Centralized user creation with validation and conflict detection
   */
  async create(userData: CreateUserProfile): Promise<ServiceResult<UserProfile>> {
    // Implementation with inline comments explaining complex logic
  }
}
```

#### 2. README Updates

When adding features, update relevant documentation:

```markdown
## New Feature Documentation

### 🎯 Feature Name
Brief description of what it does and why it's important.

### 📋 Usage
```typescript
// Code examples showing how to use the feature
const result = await newFeature.performAction();
```

### ⚙️ Configuration
Any environment variables or configuration options.

### 🧪 Testing
How to test the feature and what test cases exist.
```

---

## 🔒 Security Guidelines

### Security Review Checklist

Before submitting code, ensure:

- [ ] **Input Validation**: All inputs validated with Zod schemas
- [ ] **SQL Injection Protection**: Only parameterized queries used
- [ ] **Authentication**: Proper NOSTR signature verification
- [ ] **Authorization**: Role-based access control implemented
- [ ] **Error Handling**: No sensitive information in error messages
- [ ] **Rate Limiting**: API endpoints have appropriate limits
- [ ] **Logging**: No sensitive data logged (tokens, keys, passwords)

### Secure Coding Practices

```typescript
// ✅ Good: Parameterized query
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('nostr_pubkey', pubkey);

// ❌ Bad: String interpolation (vulnerable to injection)
const query = `SELECT * FROM users WHERE nostr_pubkey = '${pubkey}'`;

// ✅ Good: Input validation
const UserSchema = z.object({
  nostr_pubkey: z.string().regex(/^[0-9a-fA-F]{64}$/),
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/)
});

// ✅ Good: Proper error handling (no information leakage)
catch (error) {
  logger.error('Database error', { error, nostrPubkey });
  return {
    success: false,
    error: 'User creation failed' // Generic message
  };
}
```

---

## 🚀 Performance Guidelines

### Performance Standards

- **Response Time**: <200ms for standard operations
- **Database Queries**: Optimized with proper indexing
- **Memory Usage**: Efficient object creation and cleanup
- **Caching**: Intelligent use of in-memory caching

### Performance Best Practices

```typescript
// ✅ Efficient database query with selective fields
const { data } = await supabase
  .from('users')
  .select('id, username, role')
  .eq('nostr_pubkey', pubkey)
  .single();

// ✅ Intelligent caching
const getCachedUser = (pubkey: string) => {
  const cached = cache.get(pubkey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }
  return null;
};

// ✅ Batch operations when possible
const users = await Promise.all(
  pubkeys.map(pubkey => userService.findByNostrPubkey(pubkey))
);
```

---

## 📦 Architecture Patterns

### Repository Pattern

```typescript
// Interface defining contract
interface IUserRepository {
  create(userData: CreateUserProfile): Promise<ServiceResult<UserProfile>>;
  findByNostrPubkey(pubkey: string): Promise<ServiceResult<UserProfile>>;
  update(id: string, updates: UpdateUserProfile): Promise<ServiceResult<UserProfile>>;
}

// Implementation with dependency injection
class UserRepository implements IUserRepository {
  constructor(private database: DatabaseClient) {}

  // Implementation...
}
```

### Service Layer Pattern

```typescript
// Service orchestrates business logic
class UserService {
  constructor(
    private repository: IUserRepository,
    private cache: ICacheService
  ) {}

  async createProfile(userData: CreateUserProfile) {
    // 1. Validate input
    // 2. Check business rules
    // 3. Call repository
    // 4. Update cache
    // 5. Return result
  }
}
```

### Dependency Injection

```typescript
// Factory pattern for testability
export function createUserService(
  repository?: IUserRepository,
  cache?: ICacheService
): UserService {
  return new UserService(
    repository || new UserRepository(getDatabase()),
    cache || new InMemoryCache()
  );
}

// Testing with mocks
const mockRepository = createMockRepository();
const userService = createUserService(mockRepository);
```

---

## 🔄 Pull Request Process

### PR Requirements

Every pull request must include:

1. **Clear Description**: What changes and why
2. **Test Coverage**: New tests for new functionality
3. **Documentation Updates**: README, API docs, etc.
4. **Breaking Changes**: Migration guide if applicable
5. **Performance Impact**: Assessment of performance changes

### PR Template

```markdown
## 🎯 Description
Brief description of changes and motivation.

## 🔧 Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## 🧪 Testing
- [ ] Tests pass locally with my changes
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## 📚 Documentation
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation

## 🔒 Security
- [ ] My changes don't introduce security vulnerabilities
- [ ] I have considered the security implications of my changes
- [ ] Input validation is properly implemented

## ⚡ Performance
- [ ] My changes don't negatively impact performance
- [ ] I have considered the performance implications
- [ ] Added appropriate caching where beneficial
```

### Review Process

1. **Automated Checks**: CI must pass (tests, linting, security)
2. **Code Review**: At least one senior engineer approval
3. **Security Review**: For security-sensitive changes
4. **Documentation Review**: Ensure docs are updated
5. **Final Approval**: Tech lead or senior engineer approval

---

## 🐛 Debugging Guidelines

### Debugging Tools

```bash
# Development debugging
npm run dev:debug  # Starts with debugging enabled

# Test debugging
npm test -- --inspect-brk user-repository.test.ts

# Production debugging
NODE_OPTIONS="--inspect" npm start
```

### Logging Standards

```typescript
// Structured logging with appropriate levels
logger.info('User created successfully', {
  userId: user.id,
  nostrPubkey: user.nostr_pubkey,
  role: user.role
});

logger.warn('Unusual authentication pattern detected', {
  nostrPubkey: pubkey,
  attempts: attemptCount,
  timeWindow: '15min'
});

logger.error('Database connection failed', {
  error: error.message,
  connectionString: 'redacted',
  retryAttempt: retryCount
});

// ❌ Never log sensitive information
logger.debug('JWT token: ' + token);  // BAD!
logger.debug('Processing authentication for user');  // GOOD!
```

---

## 📊 Metrics and Monitoring

### Performance Monitoring

```typescript
// Add performance timing to critical operations
const startTime = Date.now();
const result = await criticalOperation();
const duration = Date.now() - startTime;

if (duration > PERFORMANCE_THRESHOLD) {
  logger.warn('Slow operation detected', {
    operation: 'criticalOperation',
    duration,
    threshold: PERFORMANCE_THRESHOLD
  });
}
```

### Business Metrics

```typescript
// Track important business events
metrics.increment('user.created', {
  role: user.role,
  source: 'api'
});

metrics.timing('auth.challenge.generation', duration);

metrics.gauge('database.connections.active', activeConnections);
```

---

## 🎓 Learning Resources

### Required Reading

- **Clean Code** by Robert C. Martin
- **Clean Architecture** by Robert C. Martin
- **Test-Driven Development** by Kent Beck
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **NOSTR Protocol**: https://github.com/nostr-protocol/nostr

### Recommended Tools

- **VS Code Extensions**:
  - TypeScript Importer
  - Jest Runner
  - GitLens
  - Thunder Client (API testing)
  - Error Lens

### Training Checklist

New contributors should complete:

- [ ] Read this contributing guide completely
- [ ] Set up development environment successfully
- [ ] Run all tests and understand test structure
- [ ] Complete a small feature or bug fix
- [ ] Participate in code review process
- [ ] Understand deployment procedures
- [ ] Review security guidelines and best practices

---

## 🤝 Code Review Guidelines

### For Authors

Before requesting review:

1. **Self-Review**: Review your own code first
2. **Test Coverage**: Ensure comprehensive test coverage
3. **Documentation**: Update relevant documentation
4. **Clean Commits**: Squash/reorder commits if needed
5. **Description**: Write clear PR description

### For Reviewers

Focus areas during review:

1. **Functionality**: Does the code do what it's supposed to?
2. **Test Coverage**: Are there adequate tests?
3. **Security**: Any security implications?
4. **Performance**: Could this impact performance?
5. **Maintainability**: Is the code readable and maintainable?
6. **Architecture**: Does it follow our patterns?

### Review Comments

```markdown
# Constructive feedback examples

## 🎯 Suggestion
Consider extracting this logic into a separate function for better testability:
```typescript
// Extract this complex validation logic
const isValidUserData = (userData) => {
  // validation logic here
};
```

## 🔒 Security Concern
This endpoint should require authentication. Consider adding the `requireAuth` middleware.

## ⚡ Performance Note
This N+1 query could be optimized with a batch operation or eager loading.

## 📚 Documentation
Consider adding a comment explaining why we use this specific algorithm here.
```

---

## 🚨 Issue Reporting

### Bug Reports

```markdown
## 🐛 Bug Report

### Description
Clear description of what the bug is.

### To Reproduce
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

### Expected Behavior
What you expected to happen.

### Environment
- OS: [e.g. macOS, Ubuntu]
- Node.js version: [e.g. 18.17.0]
- npm version: [e.g. 9.8.1]

### Additional Context
Add any other context about the problem here.
```

### Feature Requests

```markdown
## 🚀 Feature Request

### Is your feature request related to a problem?
A clear description of what the problem is.

### Describe the solution you'd like
A clear description of what you want to happen.

### Describe alternatives you've considered
Alternative solutions or features you've considered.

### Additional Context
Any other context or screenshots about the feature request.
```

---

## 🎉 Recognition

### Contributor Levels

- **Contributor**: Successfully merged PRs
- **Core Contributor**: Regular contributor with domain expertise
- **Maintainer**: Trusted with reviewing and merging PRs
- **Lead**: Architectural decisions and project direction

### Hall of Fame

Outstanding contributors who have significantly advanced the project:

- **Security Champions**: Contributors who identified security issues
- **Performance Heroes**: Contributors who significantly improved performance
- **Documentation Masters**: Contributors who improved documentation quality
- **Testing Advocates**: Contributors who improved test coverage

---

## 📞 Getting Help

### Communication Channels

- **Technical Questions**: Create GitHub Discussion
- **Bug Reports**: Create GitHub Issue
- **Security Issues**: Email security@sovren.com
- **General Questions**: Engineering team chat

### Office Hours

- **Technical Architecture**: Weekly Thursdays 2-3 PM UTC
- **Code Review Sessions**: Daily 10-11 AM UTC
- **Open Questions**: Fridays 3-4 PM UTC

---

## 📋 Contributor Checklist

### First-Time Contributors

- [ ] Read and understand this contributing guide
- [ ] Set up development environment
- [ ] Run tests successfully
- [ ] Find a "good first issue" to work on
- [ ] Submit your first PR following our guidelines

### Regular Contributors

- [ ] Stay updated with project architecture decisions
- [ ] Participate in code reviews
- [ ] Help mentor new contributors
- [ ] Contribute to documentation improvements
- [ ] Identify and report performance/security issues

---

## 🙏 Thank You!

Thank you for contributing to Sovren Backend! Your efforts help build a **world-class platform** that empowers creators and supports the growth of the decentralized web.

Every contribution, whether it's code, documentation, bug reports, or feedback, makes Sovren better for our users and the broader NOSTR ecosystem.

**Together, we're building the future of creator monetization! 🚀**

---

*Contributing Guide v1.0.0 - Last Updated: Phase 1 Completion*
