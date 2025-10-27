# Sovren Naming Conventions

## Overview

This document establishes consistent naming conventions across the Sovren codebase to ensure readability, maintainability, and developer productivity. All team members must follow these conventions.

## File and Directory Naming

### Directory Names

**Rule:** Use kebab-case for all directory names

```
✅ Good Examples:
user-management/
content-editor/
lightning-payments/
auth-components/

❌ Bad Examples:
userManagement/
contentEditor/
UserManagement/
content_editor/
```

### File Names by Type

#### React Components

**Rule:** Use PascalCase for component files

```
✅ Good Examples:
UserProfile.tsx
ContentEditor.tsx
PaymentModal.tsx
LightningOnboarding.tsx

❌ Bad Examples:
userProfile.tsx
contenteditor.tsx
payment-modal.tsx
```

#### Utilities and Services

**Rule:** Use camelCase for utility and service files

```
✅ Good Examples:
userService.ts
authUtils.ts
paymentHelpers.ts
nostrService.ts

❌ Bad Examples:
UserService.ts
auth-utils.ts
payment_helpers.ts
```

#### Constants and Configuration

**Rule:** Use kebab-case or camelCase based on content type

```
✅ Good Examples:
api-endpoints.ts (configuration)
userConstants.ts (code constants)
environment.ts (configuration)

❌ Bad Examples:
API_ENDPOINTS.ts
user_constants.ts
Environment.ts
```

#### Test Files

**Rule:** Match the file being tested with .test or .spec suffix

```
✅ Good Examples:
UserProfile.test.tsx
userService.test.ts
authUtils.spec.ts
UserProfile.stories.tsx

❌ Bad Examples:
test-user-profile.tsx
userServiceTests.ts
auth-utils-spec.ts
```

### Special File Types

#### Page Components

**Rule:** Use PascalCase, descriptive names

```
✅ Good Examples:
Home.tsx
CreatorDashboard.tsx
UserProfile.tsx
PaymentSettings.tsx

❌ Bad Examples:
index.tsx (unless truly generic)
page.tsx
dashboard.tsx
```

#### Hook Files

**Rule:** Start with 'use' prefix, camelCase

```
✅ Good Examples:
useAuth.ts
usePayments.ts
useFeatureFlags.ts
useLocalStorage.ts

❌ Bad Examples:
authHook.ts
payments.ts
FeatureFlags.ts
```

#### Type Definition Files

**Rule:** Use camelCase with descriptive names

```
✅ Good Examples:
userTypes.ts
paymentTypes.ts
nostrTypes.ts
apiTypes.ts

❌ Bad Examples:
types.ts (too generic)
UserTypes.ts
user-types.ts
```

## Code Naming Conventions

### Variables and Functions

#### Variables

**Rule:** Use camelCase for variables

```typescript
✅ Good Examples:
const userName = 'john_doe';
const paymentAmount = 1000;
const isAuthenticated = true;
const userPreferences = {};

❌ Bad Examples:
const user_name = 'john_doe';
const UserName = 'john_doe';
const payment-amount = 1000;
```

#### Functions

**Rule:** Use camelCase, start with verb

```typescript
✅ Good Examples:
function getUserProfile() {}
function validatePayment() {}
function createLightningInvoice() {}
function handleAuthCallback() {}

❌ Bad Examples:
function UserProfile() {} // PascalCase for non-components
function user_profile() {} // snake_case
function profile() {} // missing verb
```

#### Boolean Variables

**Rule:** Use is/has/can/should prefix

```typescript
✅ Good Examples:
const isLoggedIn = true;
const hasPermission = false;
const canEdit = true;
const shouldRedirect = false;

❌ Bad Examples:
const loggedIn = true;
const permission = false;
const edit = true;
```

### React Components

#### Component Names

**Rule:** Use PascalCase, descriptive and specific

```typescript
✅ Good Examples:
const UserProfileCard = () => {};
const PaymentMethodSelector = () => {};
const LightningInvoiceModal = () => {};

❌ Bad Examples:
const userprofile = () => {}; // camelCase
const Card = () => {}; // too generic
const component1 = () => {}; // meaningless
```

#### Props and State

**Rule:** Use camelCase, descriptive names

```typescript
✅ Good Examples:
interface UserProfileProps {
  userId: string;
  showAvatar: boolean;
  onProfileUpdate: (data: UserData) => void;
}

const [isLoading, setIsLoading] = useState(false);
const [userPreferences, setUserPreferences] = useState({});

❌ Bad Examples:
interface Props { // too generic
  id: string; // ambiguous
  show: boolean; // ambiguous
}

const [loading, setLoading] = useState(false); // missing 'is'
```

#### Event Handlers

**Rule:** Use 'handle' prefix followed by action

```typescript
✅ Good Examples:
const handleUserLogin = () => {};
const handlePaymentSubmit = () => {};
const handleModalClose = () => {};

❌ Bad Examples:
const onLogin = () => {}; // use 'handle' for handlers
const loginUser = () => {}; // unclear if it's a handler
const click = () => {}; // too generic
```

### Constants and Enums

#### Constants

**Rule:** Use UPPER_SNAKE_CASE for module-level constants

```typescript
✅ Good Examples:
const API_BASE_URL = 'https://api.sovren.app';
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;

❌ Bad Examples:
const apiBaseUrl = 'https://api.sovren.app';
const maxRetryAttempts = 3;
const default-timeout = 5000;
```

#### Enums

**Rule:** Use PascalCase for enum names, UPPER_SNAKE_CASE for values

```typescript
✅ Good Examples:
enum UserRole {
  CREATOR = 'CREATOR',
  SUPPORTER = 'SUPPORTER',
  ADMIN = 'ADMIN'
}

enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

❌ Bad Examples:
enum userRole { // camelCase
  creator = 'creator', // lowercase
  Supporter = 'Supporter' // mixed case
}
```

### Classes and Interfaces

#### Classes

**Rule:** Use PascalCase, descriptive names

```typescript
✅ Good Examples:
class UserService {}
class PaymentProcessor {}
class NostrEventHandler {}

❌ Bad Examples:
class userService {} // camelCase
class payment_processor {} // snake_case
class Handler {} // too generic
```

#### Interfaces

**Rule:** Use PascalCase, optionally prefix with 'I'

```typescript
✅ Good Examples:
interface User {
  id: string;
  name: string;
}

interface IPaymentProvider {
  processPayment(): Promise<void>;
}

❌ Bad Examples:
interface user {} // camelCase
interface iUser {} // incorrect prefix
interface UserInterface {} // redundant suffix
```

#### Type Aliases

**Rule:** Use PascalCase, descriptive names

```typescript
✅ Good Examples:
type UserId = string;
type PaymentCallback = (result: PaymentResult) => void;
type UserPreferences = Record<string, any>;

❌ Bad Examples:
type userId = string; // camelCase
type callback = () => void; // too generic
type UserType = User; // redundant
```

## API and Database Naming

### API Endpoints

**Rule:** Use kebab-case, RESTful conventions

```
✅ Good Examples:
GET /api/users/{id}
POST /api/payment-intents
GET /api/lightning-invoices
PUT /api/user-preferences

❌ Bad Examples:
GET /api/getUser/{id}
POST /api/paymentIntents
GET /api/lightning_invoices
PUT /api/userPrefs
```

### Database Tables and Columns

**Rule:** Use snake_case for database identifiers

```sql
✅ Good Examples:
users
user_profiles
payment_transactions
lightning_invoices

user_id
created_at
payment_amount
invoice_hash

❌ Bad Examples:
Users (PascalCase)
userProfiles (camelCase)
payment-transactions (kebab-case)

userId (camelCase)
createdAt (camelCase)
```

## Package and Module Naming

### NPM Package Names

**Rule:** Use kebab-case with @sovren scope

```json
✅ Good Examples:
"@sovren/frontend"
"@sovren/backend"
"@sovren/shared"
"@sovren/lightning-utils"

❌ Bad Examples:
"@sovren/Frontend"
"@sovren/backEnd"
"@sovren/shared_utils"
```

### Import/Export Names

**Rule:** Use descriptive, consistent naming

```typescript
✅ Good Examples:
import { UserService } from './services/userService';
import { validatePayment } from './utils/paymentUtils';
import { PAYMENT_STATUSES } from './constants/paymentConstants';

export { UserProfileCard } from './UserProfileCard';
export { useAuth } from './hooks/useAuth';

❌ Bad Examples:
import { Service } from './userService'; // too generic
import { validate } from './paymentUtils'; // ambiguous
import { STATUSES } from './constants'; // unclear

export { Component } from './UserProfileCard'; // generic
```

## Environment and Configuration

### Environment Variables

**Rule:** Use UPPER_SNAKE_CASE with descriptive prefixes

```
✅ Good Examples:
SOVREN_API_BASE_URL
SOVREN_DATABASE_URL
SOVREN_LIGHTNING_NETWORK_URL
SOVREN_JWT_SECRET

❌ Bad Examples:
apiUrl
database-url
lightningUrl
secret
```

### Configuration Keys

**Rule:** Use camelCase for code, kebab-case for files

```typescript
✅ Good Examples (in code):
const config = {
  apiBaseUrl: process.env.SOVREN_API_BASE_URL,
  databaseUrl: process.env.SOVREN_DATABASE_URL
};

✅ Good Examples (in files):
// docker-compose.yml
services:
  backend-api:
    environment:
      - API_BASE_URL=...
```

## Git and Version Control

### Branch Names

**Rule:** Use kebab-case with type prefix

```
✅ Good Examples:
feature/user-authentication
bugfix/payment-modal-crash
hotfix/security-vulnerability
chore/update-dependencies

❌ Bad Examples:
userAuthentication
bug_payment_modal
Fix/Security/Vulnerability
UpdateDeps
```

### Commit Messages

**Rule:** Use conventional commits format

```
✅ Good Examples:
feat: add user authentication system
fix: resolve payment modal crash on mobile
docs: update API documentation
chore: upgrade React to v18

❌ Bad Examples:
Added user auth
Fixed bug
Updated docs
Upgrade
```

## Documentation Naming

### Markdown Files

**Rule:** Use kebab-case for file names

```
✅ Good Examples:
getting-started.md
api-documentation.md
deployment-guide.md
naming-conventions.md

❌ Bad Examples:
GettingStarted.md
API_Documentation.md
deployment_guide.md
```

### Section Headings

**Rule:** Use Title Case for main headings, Sentence case for subheadings

```markdown
✅ Good Examples:

# API Documentation

## Authentication endpoints

### User login process

❌ Bad Examples:

# api documentation

## Authentication Endpoints

### USER LOGIN PROCESS
```

## Enforcement and Tools

### Automated Enforcement

- ESLint rules for naming conventions
- TypeScript strict naming rules
- Pre-commit hooks for file naming validation
- CI/CD pipeline checks for naming compliance

### Manual Review Checklist

- [ ] File names follow established conventions
- [ ] Variable and function names are descriptive
- [ ] Component names use PascalCase
- [ ] Constants use UPPER_SNAKE_CASE
- [ ] API endpoints follow RESTful conventions
- [ ] Database identifiers use snake_case

### Tools and Configurations

```json
// .eslintrc.json
{
  "rules": {
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "variableLike",
        "format": ["camelCase"]
      },
      {
        "selector": "typeLike",
        "format": ["PascalCase"]
      }
    ]
  }
}
```

---

**Last Updated:** December 2024
**Version:** 1.0
**Next Review:** March 2025

**Note:** These conventions are living standards and may be updated based on team feedback and industry best practices.
