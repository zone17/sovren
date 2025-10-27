# Sovren Monorepo Directory Structure Standards

## Overview

This document establishes the official directory structure standards for the Sovren monorepo. All packages and components must follow these conventions to ensure consistency, maintainability, and ease of navigation.

## Root Directory Structure

```
Sovren/
├── packages/                    # All application packages
│   ├── frontend/               # React frontend application
│   ├── backend/                # Node.js backend API
│   └── shared/                 # Shared utilities and types
├── docs/                       # All project documentation
│   ├── api/                    # API documentation
│   ├── architecture/           # Architecture decisions and diagrams
│   ├── deployment/             # Deployment guides and configs
│   └── development/            # Development guides and standards
├── docker/                     # Docker configurations and scripts
├── scripts/                    # Build, deployment, and utility scripts
├── .github/                    # GitHub workflows and templates
├── .vscode/                    # VS Code workspace settings
├── package.json                # Root package.json for workspace
├── yarn.lock                   # Single lock file (yarn preferred)
├── docker-compose.yml          # Local development composition
├── docker-compose.prod.yml     # Production composition
├── .gitignore                  # Git ignore rules
├── README.md                   # Main project README
├── CHANGELOG.md                # Project-wide changelog
├── CONTRIBUTING.md             # Contribution guidelines
└── CODE_OF_CRAFT.md           # Development standards
```

## Package Structure Standards

### Frontend Package (`packages/frontend/`)

```
packages/frontend/
├── src/                        # Source code
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # Base UI components (shadcn/ui)
│   │   ├── auth/               # Authentication components
│   │   ├── content/            # Content management components
│   │   └── dashboard/          # Dashboard components
│   ├── pages/                  # Page components
│   ├── features/               # Feature-based modules
│   │   ├── auth/               # Authentication feature
│   │   ├── content/            # Content management feature
│   │   ├── analytics/          # Analytics feature
│   │   └── dashboard/          # Dashboard feature
│   ├── hooks/                  # Custom React hooks
│   ├── contexts/               # React contexts
│   ├── store/                  # State management (Redux/Zustand)
│   ├── lib/                    # Utility libraries
│   ├── types/                  # TypeScript type definitions
│   ├── assets/                 # Static assets
│   │   ├── images/             # Image files
│   │   ├── icons/              # Icon files
│   │   └── fonts/              # Font files
│   ├── styles/                 # Global styles and themes
│   └── test-utils/             # Testing utilities and mocks
├── public/                     # Public static files
├── dist/                       # Build output (gitignored)
├── coverage/                   # Test coverage reports (gitignored)
├── e2e/                        # End-to-end tests
├── .storybook/                 # Storybook configuration
├── api/                        # API route handlers (if using Next.js)
├── package.json                # Package dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── jest.config.js              # Jest testing configuration
├── playwright.config.ts        # Playwright E2E configuration
├── .eslintrc.json              # ESLint configuration
├── Dockerfile                  # Docker build configuration
├── .dockerignore               # Docker ignore rules
├── nginx.conf                  # Nginx configuration for production
├── vercel.json                 # Vercel deployment configuration
└── README.md                   # Package-specific documentation
```

### Backend Package (`packages/backend/`)

```
packages/backend/
├── src/                        # Source code
│   ├── routes/                 # API route handlers
│   │   ├── auth/               # Authentication routes
│   │   ├── users/              # User management routes
│   │   ├── content/            # Content management routes
│   │   ├── payments/           # Payment processing routes
│   │   └── lightning/          # Lightning Network routes
│   ├── middleware/             # Express middleware
│   │   ├── auth.ts             # Authentication middleware
│   │   ├── validation.ts       # Request validation
│   │   ├── rateLimit.ts        # Rate limiting
│   │   └── errorHandler.ts     # Error handling
│   ├── services/               # Business logic services
│   │   ├── auth/               # Authentication services
│   │   ├── nostr/              # NOSTR protocol services
│   │   ├── lightning/          # Lightning Network services
│   │   └── content/            # Content management services
│   ├── repositories/           # Data access layer
│   │   ├── user-repository.ts  # User data operations
│   │   ├── content-repository.ts # Content data operations
│   │   └── payment-repository.ts # Payment data operations
│   ├── database/               # Database configurations
│   │   ├── migrations/         # Database migrations
│   │   ├── seeds/              # Database seed data
│   │   └── schema.sql          # Database schema
│   ├── config/                 # Configuration files
│   │   ├── database.ts         # Database configuration
│   │   ├── environment.ts      # Environment variables
│   │   └── constants.ts        # Application constants
│   ├── types/                  # TypeScript type definitions
│   ├── utils/                  # Utility functions
│   ├── __tests__/              # Test files
│   ├── app.ts                  # Express app configuration
│   └── server.ts               # Server entry point
├── dist/                       # Build output (gitignored)
├── coverage/                   # Test coverage reports (gitignored)
├── docs/                       # Package-specific documentation
├── package.json                # Package dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── jest.config.js              # Jest testing configuration
├── .eslintrc.json              # ESLint configuration
├── Dockerfile                  # Docker build configuration
├── .dockerignore               # Docker ignore rules
├── env.example                 # Environment variables template
└── README.md                   # Package-specific documentation
```

### Shared Package (`packages/shared/`)

```
packages/shared/
├── src/                        # Source code
│   ├── types/                  # Shared TypeScript types
│   │   ├── user.ts             # User-related types
│   │   ├── content.ts          # Content-related types
│   │   ├── payment.ts          # Payment-related types
│   │   ├── nostr.ts            # NOSTR protocol types
│   │   └── index.ts            # Type exports
│   ├── utils/                  # Shared utility functions
│   │   ├── validation.ts       # Validation utilities
│   │   ├── crypto.ts           # Cryptographic utilities
│   │   ├── formatting.ts       # Data formatting utilities
│   │   └── index.ts            # Utility exports
│   ├── constants/              # Shared constants
│   │   ├── api.ts              # API-related constants
│   │   ├── validation.ts       # Validation constants
│   │   └── index.ts            # Constant exports
│   ├── schemas/                # Validation schemas (Zod/Yup)
│   │   ├── user.ts             # User validation schemas
│   │   ├── content.ts          # Content validation schemas
│   │   └── index.ts            # Schema exports
│   └── __tests__/              # Test files
├── dist/                       # Build output (gitignored)
├── coverage/                   # Test coverage reports (gitignored)
├── package.json                # Package dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── jest.config.js              # Jest testing configuration
├── .eslintrc.json              # ESLint configuration
└── README.md                   # Package-specific documentation
```

## Feature-Based Organization

Each feature should follow this structure within the frontend package:

```
src/features/[feature-name]/
├── components/                 # Feature-specific components
├── hooks/                      # Feature-specific hooks
├── services/                   # Feature-specific services
├── stores/                     # Feature-specific state management
├── types/                      # Feature-specific types
├── utils/                      # Feature-specific utilities
├── __tests__/                  # Feature-specific tests
└── index.ts                    # Feature exports
```

## File Naming Conventions

### General Rules

- Use kebab-case for directories: `user-management/`
- Use PascalCase for React components: `UserProfile.tsx`
- Use camelCase for utilities and services: `userService.ts`
- Use UPPER_SNAKE_CASE for constants: `API_ENDPOINTS.ts`

### File Extensions

- `.tsx` for React components
- `.ts` for TypeScript files
- `.test.ts` or `.test.tsx` for test files
- `.spec.ts` or `.spec.tsx` for specification tests
- `.stories.ts` or `.stories.tsx` for Storybook stories

### Component Files

```
ComponentName.tsx           # Main component file
ComponentName.test.tsx      # Component tests
ComponentName.stories.tsx   # Storybook stories
ComponentName.module.css    # Component-specific styles (if needed)
index.ts                   # Component exports
```

## Documentation Organization

### Main Documentation (`docs/`)

```
docs/
├── api/                       # API documentation
│   ├── authentication.md     # Auth API docs
│   ├── content.md            # Content API docs
│   └── payments.md           # Payment API docs
├── architecture/             # Architecture documentation
│   ├── decisions/            # Architecture Decision Records (ADRs)
│   ├── diagrams/             # System diagrams
│   └── patterns.md           # Architectural patterns
├── deployment/               # Deployment documentation
│   ├── docker.md             # Docker deployment
│   ├── vercel.md             # Vercel deployment
│   └── environment-setup.md  # Environment configuration
├── development/              # Development documentation
│   ├── getting-started.md    # Quick start guide
│   ├── testing.md            # Testing guidelines
│   ├── code-style.md         # Code style guide
│   └── contributing.md       # Contribution guidelines
├── features/                 # Feature documentation
│   ├── authentication.md     # Authentication feature
│   ├── content-management.md # Content management
│   └── lightning-payments.md # Lightning payments
└── user-guides/              # End-user documentation
    ├── creator-guide.md      # Creator user guide
    └── supporter-guide.md    # Supporter user guide
```

## Configuration File Standards

### Package.json Structure

Each package should have a consistent package.json structure:

```json
{
  "name": "@sovren/[package-name]",
  "version": "1.0.0",
  "description": "Package description",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "Build command",
    "dev": "Development server",
    "test": "Test command",
    "test:watch": "Test watch mode",
    "test:coverage": "Test with coverage",
    "lint": "ESLint command",
    "lint:fix": "ESLint fix command",
    "type-check": "TypeScript check"
  },
  "dependencies": {},
  "devDependencies": {},
  "keywords": ["sovren", "nostr", "lightning"],
  "author": "Sovren Team",
  "license": "MIT"
}
```

## Build Output Standards

### Gitignore Requirements

All packages must ignore build outputs and temporary files:

```gitignore
# Build outputs
dist/
build/
coverage/

# Dependencies
node_modules/

# Environment files
.env
.env.local
.env.production

# Logs
*.log
server.pid

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/settings.json
.idea/
```

## Enforcement

### Automated Checks

- ESLint rules for file naming conventions
- Pre-commit hooks for structure validation
- CI/CD pipeline checks for standard compliance

### Manual Reviews

- Code review checklist includes structure compliance
- Architecture review for new packages or major restructuring

## Migration Guidelines

When restructuring existing code:

1. Create new structure alongside existing code
2. Migrate files incrementally
3. Update imports and references
4. Remove old structure after validation
5. Update documentation and README files

## Exceptions

Any deviation from these standards must be:

1. Documented with clear reasoning
2. Approved by the architecture team
3. Added to this document as an exception
4. Reviewed quarterly for continued relevance

---

**Last Updated:** December 2024
**Version:** 1.0
**Next Review:** March 2025
