# Sovren Monorepo Package Organization

## Overview

This document defines the package organization strategy for the Sovren monorepo, establishing clear boundaries, dependencies, and responsibilities for each package.

## Package Architecture

### Core Packages

#### 1. `@sovren/frontend`

**Purpose:** React-based web application for creators and supporters
**Technology Stack:** React 18, TypeScript, Vite, Tailwind CSS
**Responsibilities:**

- User interface and user experience
- Client-side routing and navigation
- State management (Redux Toolkit/Zustand)
- Authentication UI and flows
- Content creation and management interfaces
- Payment and subscription interfaces
- Real-time updates and notifications

**Dependencies:**

- `@sovren/shared` - Shared types and utilities
- External: React ecosystem, UI libraries, payment SDKs

#### 2. `@sovren/backend`

**Purpose:** Node.js API server handling business logic and data operations
**Technology Stack:** Node.js, Express, TypeScript, Supabase
**Responsibilities:**

- RESTful API endpoints
- Authentication and authorization
- Business logic implementation
- Database operations and migrations
- NOSTR protocol integration
- Lightning Network payment processing
- Real-time WebSocket connections
- Background job processing

**Dependencies:**

- `@sovren/shared` - Shared types and utilities
- External: Express, Supabase client, NOSTR libraries, Lightning libraries

#### 3. `@sovren/shared`

**Purpose:** Common utilities, types, and constants shared across packages
**Technology Stack:** TypeScript, Zod validation
**Responsibilities:**

- TypeScript type definitions
- Validation schemas
- Utility functions
- Constants and enums
- API contract definitions
- Error handling utilities
- Cryptographic utilities

**Dependencies:**

- External: Minimal (Zod, crypto libraries)

### Package Dependency Rules

#### Dependency Flow

```
Frontend → Shared ← Backend
```

**Allowed Dependencies:**

- ✅ Frontend can depend on Shared
- ✅ Backend can depend on Shared
- ❌ Frontend cannot depend on Backend
- ❌ Backend cannot depend on Frontend
- ❌ Shared cannot depend on Frontend or Backend

#### Circular Dependency Prevention

- No package may import from a package that depends on it
- All shared code must be placed in the `@sovren/shared` package
- Feature-specific shared code should be abstracted to shared utilities

### Package Communication

#### API Communication

- Frontend communicates with Backend via REST API
- Real-time communication via WebSocket connections
- All API contracts defined in `@sovren/shared`

#### Shared Code Access

- Type definitions shared via `@sovren/shared/types`
- Utility functions shared via `@sovren/shared/utils`
- Validation schemas shared via `@sovren/shared/schemas`

## Workspace Configuration

### Root Package.json

```json
{
  "name": "sovren-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "yarn workspaces run build",
    "dev": "concurrently \"yarn workspace @sovren/backend dev\" \"yarn workspace @sovren/frontend dev\"",
    "test": "yarn workspaces run test",
    "lint": "yarn workspaces run lint",
    "type-check": "yarn workspaces run type-check"
  },
  "devDependencies": {
    "concurrently": "^7.6.0",
    "lerna": "^6.4.1"
  }
}
```

### Package Naming Convention

- Scope: `@sovren/`
- Format: `@sovren/[package-name]`
- Examples:
  - `@sovren/frontend`
  - `@sovren/backend`
  - `@sovren/shared`

### Version Management

- All packages maintain semantic versioning
- Shared package versions are synchronized
- Independent versioning for frontend and backend
- Use Lerna for coordinated releases

## Development Workflow

### Local Development

1. Install dependencies: `yarn install`
2. Start development servers: `yarn dev`
3. Frontend runs on http://localhost:5173
4. Backend runs on http://localhost:3001

### Building

- Individual package builds: `yarn workspace @sovren/[package] build`
- All packages: `yarn build`
- Build order: shared → backend → frontend

### Testing

- Individual package tests: `yarn workspace @sovren/[package] test`
- All packages: `yarn test`
- Integration tests run after all unit tests

## Package-Specific Guidelines

### Frontend Package Guidelines

#### State Management

- Use Redux Toolkit for global state
- Use React Context for feature-specific state
- Implement proper state normalization
- Use RTK Query for API state management

#### Component Organization

- Shared UI components in `src/components/ui/`
- Feature components in `src/features/[feature]/components/`
- Page components in `src/pages/`
- Follow atomic design principles

#### Routing

- Use React Router v6
- Implement route-based code splitting
- Protected routes for authenticated users
- Error boundaries for route error handling

### Backend Package Guidelines

#### API Design

- RESTful endpoints with proper HTTP methods
- Consistent error response format
- API versioning strategy
- OpenAPI documentation

#### Database Operations

- Repository pattern for data access
- Database migrations for schema changes
- Connection pooling and optimization
- Proper transaction handling

#### Security

- JWT-based authentication
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS configuration
- Security headers

### Shared Package Guidelines

#### Type Definitions

- Comprehensive TypeScript interfaces
- Proper generic type usage
- Utility types for common patterns
- API response and request types

#### Validation Schemas

- Zod schemas for runtime validation
- Consistent validation error messages
- Schema composition and reuse
- Frontend and backend validation alignment

#### Utilities

- Pure functions only
- Comprehensive unit test coverage
- Proper error handling
- Performance optimization

## Build and Deployment

### Build Process

1. Clean previous builds
2. Build shared package
3. Build backend package
4. Build frontend package
5. Run integration tests
6. Generate deployment artifacts

### Docker Strategy

- Multi-stage builds for each package
- Shared base images for consistency
- Optimized layer caching
- Security scanning in CI/CD

### Environment Management

- Environment-specific configurations
- Secrets management via environment variables
- Configuration validation on startup
- Feature flag support

## Quality Assurance

### Code Quality

- ESLint configuration shared across packages
- Prettier for consistent formatting
- TypeScript strict mode enabled
- Pre-commit hooks for quality checks

### Testing Strategy

- Unit tests for all packages (95% coverage minimum)
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Performance testing for API endpoints

### Documentation

- README files for each package
- API documentation (OpenAPI)
- Architecture decision records
- Code comments for complex logic

## Migration and Maintenance

### Package Refactoring

- Gradual migration strategy
- Maintain backward compatibility
- Update dependencies incrementally
- Document breaking changes

### Dependency Management

- Regular dependency updates
- Security vulnerability scanning
- License compliance checking
- Bundle size monitoring

### Performance Monitoring

- Build time optimization
- Bundle size tracking
- Runtime performance monitoring
- Memory usage analysis

---

**Last Updated:** December 2024
**Version:** 1.0
**Next Review:** March 2025
