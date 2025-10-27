# Development Workflow Guide

## Overview

This guide explains the **complete development workflow** for Sovren, designed to ensure **consistent quality**, **rapid iteration**, and **zero-production-issues**. Every engineer should follow this workflow to maintain our elite engineering standards.

## 🎯 Workflow Philosophy

### Core Principles

1. **Quality First**: Every change must improve or maintain quality
2. **Test-Driven Development**: Write tests before implementation
3. **Continuous Integration**: Integrate frequently, fail fast
4. **Feature Flag Driven**: All changes behind feature flags
5. **Documentation First**: Document the "why" not just the "how"

## 🚀 Getting Started

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/zone17/sovren.git
cd sovren

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp packages/frontend/.env.example packages/frontend/.env.local
# Edit .env.local with your Supabase configuration

# 4. Start development server
npm run dev

# 5. Verify setup
npm test
npm run lint
npm run type-check
```

### Development Tools Setup

#### Required IDE Extensions

- **ESLint**: Real-time code quality feedback
- **Prettier**: Automatic code formatting
- **TypeScript**: Enhanced type checking
- **Jest**: Test runner integration
- **GitLens**: Git history and blame

#### Recommended IDE Settings (VS Code)

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "jest.autoRun": "watch",
  "git.enableSmartCommit": true
}
```

## 🔄 Development Workflow

### 1. Feature Development Process

#### Step 1: Create Feature Branch

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/[JIRA-123]-add-payment-integration

# Branch naming convention:
# feature/[ticket]-description
# bugfix/[ticket]-description
# hotfix/[ticket]-description
```

#### Step 2: Plan Implementation

1. **Review requirements** and acceptance criteria
2. **Design feature flag** for the change
3. **Plan test strategy** (unit, integration, e2e)
4. **Consider performance impact**
5. **Update documentation** outline

#### Step 3: Test-Driven Development

```bash
# Write failing tests first
npm run test:watch

# Example test structure:
describe('PaymentIntegration', () => {
  describe('when processing payment', () => {
    it('should create invoice successfully', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle payment failures gracefully', () => {
      // Test error scenarios
    });
  });
});
```

#### Step 4: Implement Feature

```bash
# Implement minimal code to pass tests
npm run dev

# Continuous feedback loop:
# 1. Write test (Red)
# 2. Write minimal code (Green)
# 3. Refactor (Blue)
# 4. Repeat
```

#### Step 5: Feature Flag Implementation

```bash
# Add feature flag
npm run feature-flags set enablePaymentIntegration false

# Use in code:
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

const PaymentComponent = () => {
  const { enablePaymentIntegration } = useFeatureFlags();

  if (!enablePaymentIntegration) {
    return <LegacyPaymentComponent />;
  }

  return <NewPaymentComponent />;
};
```

### 2. Quality Assurance Process

#### Continuous Quality Checks

```bash
# Run before each commit
npm run lint:fix        # Fix linting issues
npm run format         # Format code
npm run type-check     # TypeScript validation
npm run test           # All tests
npm run build          # Build verification
```

#### Code Review Checklist

- [ ] **Functionality**: Does it work as expected?
- [ ] **Tests**: Are there comprehensive tests?
- [ ] **Performance**: Any performance impact?
- [ ] **Security**: Are there security considerations?
- [ ] **Accessibility**: Is it accessible?
- [ ] **Documentation**: Is it well documented?
- [ ] **Feature Flags**: Is it behind a feature flag?

### 3. Pull Request Process

#### Creating Pull Request

```bash
# Push feature branch
git push origin feature/[JIRA-123]-add-payment-integration

# Create PR with template
gh pr create --template .github/pull_request_template.md
```

#### PR Template Checklist

```markdown
## 🎯 What does this PR do?

Brief description of changes and motivation.

## 🧪 How to test?

Step-by-step testing instructions.

## 📋 Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Feature flag implemented
- [ ] Performance impact assessed
- [ ] Security review completed
- [ ] Accessibility verified

## 🔗 Related Issues

Closes #123
```

#### Automated PR Checks

The CI pipeline automatically runs:

- ✅ **Linting** and formatting validation
- ✅ **Type checking** across all packages
- ✅ **Test suite** with coverage reporting
- ✅ **Security audit** for vulnerabilities
- ✅ **Bundle size** analysis
- ✅ **Preview deployment** for manual testing

### 4. Review Process

#### For Reviewers

1. **Checkout branch** and test locally
2. **Review code quality** and architecture
3. **Verify tests** cover edge cases
4. **Check documentation** is complete
5. **Test feature flag** functionality
6. **Approve or request changes**

#### For Authors

1. **Address feedback** promptly
2. **Update tests** if needed
3. **Improve documentation**
4. **Re-request review** when ready

### 5. Deployment Process

#### Merge to Develop (Staging)

```bash
# After PR approval
git checkout develop
git pull origin develop
git merge feature/[JIRA-123]-add-payment-integration
git push origin develop

# This triggers:
# ✅ Full CI pipeline
# 🚀 Staging deployment
# 📊 Integration testing
```

#### Testing in Staging

1. **Verify deployment** at `https://staging.sovren.dev`
2. **Test feature flag** toggle
3. **Run manual tests** on actual environment
4. **Performance validation**
5. **Cross-browser testing**

#### Production Deployment

```bash
# Create production PR
git checkout main
git pull origin main
git checkout -b release/[version]
git merge develop
git push origin release/[version]

# Create PR to main
gh pr create --title "Release [version]" --body "Production deployment"

# After approval and merge:
# ✅ Production CI pipeline
# 🚀 Production deployment
# 📊 Health checks
# 🔍 Performance monitoring
```

## 🛠️ Development Commands

### Daily Development

```bash
# Start development environment
npm run dev              # Frontend + Backend
npm run dev:frontend     # Frontend only
npm run dev:backend      # Backend only

# Testing
npm run test             # All tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:ci          # CI mode

# Code Quality
npm run lint             # Check linting
npm run lint:fix         # Fix linting issues
npm run format           # Format code
npm run type-check       # TypeScript validation
```

### Advanced Commands

```bash
# Feature Flags
npm run feature-flags list               # List all flags
npm run feature-flags set [flag] [value] # Update flag
npm run feature-flags backup            # Backup flags

# Database
cd packages/backend
npx prisma migrate dev      # Run migrations
npx prisma migrate reset    # Reset database
npx prisma studio          # Database UI

# Performance
npm run build              # Production build
npm run bundle-analyzer    # Bundle analysis
npm run lighthouse         # Performance audit
```

## 🧪 Testing Strategy

### Test Pyramid

```
           🔺 E2E Tests (Few)
         🔻🔻 Integration Tests (Some)
       🔻🔻🔻🔻 Unit Tests (Many)
```

#### Unit Tests (80% of tests)

- **Purpose**: Test individual functions/components
- **Tools**: Jest, React Testing Library
- **Location**: `*.test.ts` files next to source
- **Coverage**: 80%+ required

```typescript
// Example unit test
describe('calculatePaymentAmount', () => {
  it('should calculate correct amount with tax', () => {
    const result = calculatePaymentAmount(100, 0.1);
    expect(result).toBe(110);
  });

  it('should handle zero tax rate', () => {
    const result = calculatePaymentAmount(100, 0);
    expect(result).toBe(100);
  });
});
```

#### Integration Tests (15% of tests)

- **Purpose**: Test component interactions
- **Tools**: Jest, Supertest
- **Location**: `*.integration.test.ts`
- **Coverage**: Critical user flows

```typescript
// Example integration test
describe('Payment API', () => {
  it('should create payment invoice', async () => {
    const response = await request(app)
      .post('/api/v1/payments/invoice')
      .send({ amount: 100, currency: 'USD' })
      .expect(201);

    expect(response.body.data.amount).toBe(100);
  });
});
```

#### E2E Tests (5% of tests)

- **Purpose**: Test complete user journeys
- **Tools**: Playwright (future implementation)
- **Location**: `e2e/` directory
- **Coverage**: Critical business flows

### Testing Best Practices

1. **Arrange-Act-Assert** pattern
2. **Test behavior, not implementation**
3. **Use descriptive test names**
4. **Mock external dependencies**
5. **Test error scenarios**
6. **Keep tests fast and isolated**

## 🔧 Debugging Guide

### Local Development Issues

#### Common Problems & Solutions

**Tests Failing Locally**

```bash
# Clear Jest cache
npm run test -- --clearCache

# Check test database
cd packages/backend
npx prisma migrate reset
npm run test
```

**TypeScript Errors**

```bash
# Restart TypeScript server in IDE
# Check tsconfig.json paths
npm run type-check
```

**Build Failures**

```bash
# Clear build cache
npm run clean
npm install
npm run build
```

**Database Issues**

```bash
cd packages/backend
npx prisma migrate reset
npx prisma migrate dev
npx prisma db seed
```

### CI/CD Debugging

#### Build Pipeline Failures

1. **Check GitHub Actions** logs
2. **Review changed files** for issues
3. **Run locally** with same Node version
4. **Check environment variables**

#### Deployment Issues

1. **Verify Vercel** configuration
2. **Check feature flags** status
3. **Review environment** differences
4. **Check health endpoints**

### Performance Debugging

```bash
# Profile bundle size
npm run build
npm run bundle-analyzer

# Run performance audit
npm run lighthouse

# Check for memory leaks
npm run dev
# Use browser DevTools > Memory tab
```

## 📊 Monitoring & Observability

### Local Monitoring

```bash
# Check application health
curl http://localhost:3001/api/v1/health

# Monitor feature flags
npm run feature-flags list

# View test coverage
npm run test:coverage
open coverage/lcov-report/index.html
```

### Production Monitoring

- **Application Performance**: Response times, error rates
- **Infrastructure**: Server resources, database performance
- **User Experience**: Core Web Vitals, conversion rates
- **Security**: Vulnerability scans, audit logs

### Alerting

- **Critical**: Production failures, security issues
- **Warning**: Performance degradation, test failures
- **Info**: Deployments, feature flag changes

## 🎓 Best Practices

### Code Quality

```typescript
// ✅ Good: Descriptive names, single responsibility
const calculateTotalWithTax = (subtotal: number, taxRate: number): number => {
  return subtotal * (1 + taxRate);
};

// ❌ Bad: Unclear naming, multiple responsibilities
const calc = (a: any, b: any): any => {
  // Does too many things
  return a * b + someOtherCalculation();
};
```

### Git Workflow

```bash
# ✅ Good: Descriptive commit messages
git commit -m "feat(payments): add Lightning Network invoice generation

- Implement invoice creation API endpoint
- Add payment validation logic
- Include comprehensive error handling
- Update API documentation

Closes #123"

# ❌ Bad: Unclear commit message
git commit -m "fix stuff"
```

### Feature Flags

```typescript
// ✅ Good: Graceful degradation
const PaymentForm = () => {
  const { enableLightningPayments } = useFeatureFlags();

  return (
    <form>
      {/* Existing payment methods */}
      <CreditCardForm />

      {/* New payment method behind flag */}
      {enableLightningPayments && <LightningPaymentForm />}
    </form>
  );
};

// ❌ Bad: Breaking changes without fallback
const PaymentForm = () => {
  const { enableLightningPayments } = useFeatureFlags();

  if (enableLightningPayments) {
    return <LightningPaymentForm />;
  }

  throw new Error('Payment method not available'); // Breaks user experience
};
```

### Performance

```typescript
// ✅ Good: Optimized React components
const UserList = React.memo(({ users }: { users: User[] }) => {
  const sortedUsers = useMemo(
    () => users.sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  return (
    <ul>
      {sortedUsers.map(user => (
        <UserItem key={user.id} user={user} />
      ))}
    </ul>
  );
});

// ❌ Bad: Unnecessary re-renders
const UserList = ({ users }: { users: User[] }) => {
  const sortedUsers = users.sort((a, b) => a.name.localeCompare(b.name)); // Runs every render

  return (
    <ul>
      {sortedUsers.map(user => (
        <div key={Math.random()}> {/* Wrong key */}
          {user.name}
        </div>
      ))}
    </ul>
  );
};
```

## 🚨 Emergency Procedures

### Hotfix Process

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# 2. Make minimal fix
# 3. Test thoroughly
npm run test
npm run lint
npm run build

# 4. Create emergency PR
gh pr create --title "HOTFIX: Critical security vulnerability" \
             --body "Emergency fix for CVE-XXXX" \
             --label "emergency"

# 5. Fast-track review and merge
# 6. Deploy immediately
```

### Rollback Process

```bash
# Option 1: Revert commit
git revert [commit-hash]
git push origin main

# Option 2: Feature flag toggle
npm run feature-flags set [problematic-flag] false

# Option 3: Manual Vercel rollback
vercel rollback [deployment-url]
```

## 📞 Getting Help

### Internal Resources

- **Documentation**: Check `/docs` directory first
- **Team Chat**: #engineering Slack channel
- **Code Review**: Create draft PR for early feedback
- **Pair Programming**: Schedule with team members

### External Resources

- **React**: [Official Documentation](https://react.dev/)
- **TypeScript**: [Handbook](https://www.typescriptlang.org/docs/)
- **Jest**: [Testing Framework](https://jestjs.io/docs/getting-started)
- **Prisma**: [Database Toolkit](https://www.prisma.io/docs/)

### Escalation Path

1. **Level 1**: Check documentation and search issues
2. **Level 2**: Ask in team Slack channel
3. **Level 3**: Create GitHub issue with detailed description
4. **Level 4**: Schedule pair programming session
5. **Level 5**: Escalate to tech lead

---

## 📈 Continuous Improvement

### Team Retrospectives

- **Weekly**: Process improvements
- **Monthly**: Tool and workflow optimization
- **Quarterly**: Architecture and strategy review

### Metrics Tracking

- **Code Quality**: Test coverage, linting scores
- **Performance**: Build times, deployment frequency
- **Developer Experience**: Time to first PR, debugging time

### Knowledge Sharing

- **Tech Talks**: Weekly internal presentations
- **Documentation**: Keep docs updated with learnings
- **Code Reviews**: Teaching moments and best practices

---

_This workflow guide is a living document. Please suggest improvements through PRs or GitHub issues._

**Last Updated**: $(date)
**Next Review**: Monthly team retrospective
