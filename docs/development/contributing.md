# Contributing Guide

**Epic 005 Backend Service Refactoring - Contribution Standards**

---

## Code Style

### TypeScript Conventions

```typescript
// ✅ GOOD: Clear naming, types, documentation
/**
 * Creates a new payment invoice
 * @param amount - Amount in satoshis
 * @param description - Payment description
 * @returns Promise resolving to payment invoice
 */
export async function createPaymentInvoice(
  amount: number,
  description: string
): Promise<PaymentInvoice> {
  // Implementation
}

// ❌ BAD: Unclear, no types, no docs
export async function createInv(amt: any, desc: any): Promise<any> {
  // Implementation
}
```

### Naming Conventions

| Type           | Convention            | Example              |
| -------------- | --------------------- | -------------------- |
| **Classes**    | PascalCase            | `PaymentService`     |
| **Interfaces** | PascalCase + I prefix | `IPaymentService`    |
| **Functions**  | camelCase             | `createPayment`      |
| **Constants**  | UPPER_SNAKE_CASE      | `MAX_RETRIES`        |
| **Files**      | kebab-case            | `payment-service.ts` |

---

## Pull Request Process

### 1. Branch Strategy

```bash
# Create feature branch
git checkout -b feature/US-123-add-refund-service

# Branch naming:
# - feature/[ticket]-description
# - bugfix/[ticket]-description
# - hotfix/[ticket]-description
```

### 2. Commit Standards

```bash
# Conventional Commits format
git commit -m "feat(payments): add refund processing

- Implement RefundService with state machine
- Add fraud detection for refunds
- Include comprehensive test coverage

Closes #123"

# Types: feat, fix, docs, refactor, test, chore, ci
```

### 3. PR Template

```markdown
## Description

Brief summary of changes and motivation

## Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation update

## Checklist

- [ ] Tests added/updated (95%+ coverage)
- [ ] Documentation updated
- [ ] Mermaid diagrams included (if architectural change)
- [ ] CHANGELOG.md updated
- [ ] Code passes linting
- [ ] All tests passing
- [ ] Reviewed by at least 1 team member

## How to Test

1. Run `npm test`
2. Manually test feature X
3. Verify Y works

## Screenshots (if UI changes)

[Add screenshots]

## Related Issues

Closes #123
```

### 4. Code Review Checklist

**For Reviewers**:

- [ ] Code follows style guidelines
- [ ] Tests cover edge cases
- [ ] No security vulnerabilities
- [ ] Performance impact acceptable
- [ ] Documentation is clear
- [ ] Error handling is comprehensive

---

## Testing Requirements

### Coverage Requirements

```bash
# Services/Repositories: 95%+ coverage
npm run test:coverage -- --testPathPattern=services

# Global: 85%+ coverage
npm run test:coverage
```

### Test Quality

```typescript
// ✅ GOOD: Descriptive, covers edge cases
describe('RefundService.createRefund', () => {
  it('should create full refund for completed payment', async () => {
    // Test implementation
  });

  it('should create partial refund within available amount', async () => {
    // Test implementation
  });

  it('should throw error for already refunded payment', async () => {
    // Test implementation
  });

  it('should throw error for expired payment', async () => {
    // Test implementation
  });
});

// ❌ BAD: Vague, incomplete
describe('Refunds', () => {
  it('works', async () => {
    // Incomplete test
  });
});
```

---

## Documentation Requirements

### Every PR Must Include

1. **Code Comments**: Complex logic explained
2. **API Documentation**: OpenAPI spec updated
3. **CHANGELOG.md**: Entry added
4. **Mermaid Diagrams**: For architectural changes

### Mermaid Diagram Requirements

````markdown
# All diagrams must include:

1. **GitHub Visual Link**:
   ![Diagram](https://github.com/user/repo/blob/main/path/diagram.mmd)

2. **Interactive Editor Link**:
   [Edit in Mermaid Live](https://mermaid.live/edit#...)

3. **Source Code**:
   ```mermaid
   graph TD
     A[Start] --> B[Process]
   ```
````

````

---

## Issue Reporting

### Bug Report Template

```markdown
**Environment**: Development / Staging / Production
**Version**: 2.0.0

**Description**:
Clear description of the bug

**Steps to Reproduce**:
1. Action 1
2. Action 2
3. Observe error

**Expected Behavior**:
What should happen

**Actual Behavior**:
What actually happens

**Logs/Screenshots**:
[Paste relevant logs]
````

### Feature Request Template

```markdown
**Feature Name**: Automated Subscription Renewals

**Problem Statement**:
What problem does this solve?

**Proposed Solution**:
How should it work?

**Alternatives Considered**:
Other approaches evaluated

**Additional Context**:
Any other relevant information
```

---

## Code Review

### Review Standards

**Approval Criteria**:

- ✅ Code quality meets standards
- ✅ Tests comprehensive (95%+ for critical paths)
- ✅ Documentation complete
- ✅ No security vulnerabilities
- ✅ Performance acceptable

**Rejection Criteria**:

- ❌ Missing tests
- ❌ Incomplete documentation
- ❌ Code style violations
- ❌ Security issues
- ❌ Breaking changes without migration path

---

## Commit Standards

### Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code restructuring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

**Examples**:

```bash
feat(payments): add Lightning invoice generation

- Implement LightningService.createInvoice()
- Add BOLT11 invoice parsing
- Include comprehensive error handling

Closes #123

---

fix(auth): resolve JWT expiration check

Fixes edge case where expired tokens were accepted
due to timezone mismatch.

Fixes #456

---

docs(api): update payment endpoint documentation

Add examples for multi-currency payments and
webhook verification.
```

---

## Testing Requirements

### Pre-Commit Checks

```bash
# Automatically run via husky
npm run lint:fix
npm run format
npm run type-check
npm run test:unit
```

### Pre-Push Checks

```bash
npm run quality:check
npm run test:integration
```

---

## Recognition

### Contribution Levels

| Level        | Criteria         |
| ------------ | ---------------- |
| **Bronze**   | 1-5 merged PRs   |
| **Silver**   | 6-20 merged PRs  |
| **Gold**     | 21-50 merged PRs |
| **Platinum** | 50+ merged PRs   |

### Hall of Fame

Top contributors recognized in:

- Project README.md
- Monthly team meetings
- Annual engineering awards

---

## Getting Help

1. **Documentation**: Check `/docs` first
2. **Slack**: #engineering channel
3. **GitHub Issues**: Search existing issues
4. **Pair Programming**: Schedule with team
5. **Tech Lead**: Escalate if needed

---

**Thank you for contributing to Sovren!** 🚀

---

**Last Updated**: 2025-10-27
**Epic**: Epic 005 - Backend Service Refactoring
**Story**: US-E5-039 - Developer Documentation
