# Sovren Packages

This directory contains all the packages that make up the Sovren monorepo application.

## Package Overview

### `frontend/`

React-based web application providing the user interface for creators and supporters.

**Key Technologies:**

- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Redux Toolkit for state management
- React Router for navigation

**Main Features:**

- Creator dashboard and content management
- Supporter interface and subscription management
- NOSTR authentication integration
- Lightning Network payment interfaces
- Real-time notifications and updates

### `backend/`

Node.js API server handling business logic, authentication, and data operations.

**Key Technologies:**

- Node.js with Express and TypeScript
- Supabase for database operations
- JWT for authentication
- WebSocket for real-time communication

**Main Features:**

- RESTful API endpoints
- NOSTR protocol integration
- Lightning Network payment processing
- User authentication and authorization
- Content management and publishing

### `shared/`

Common utilities, types, and constants shared between frontend and backend packages.

**Key Technologies:**

- TypeScript for type definitions
- Zod for runtime validation
- Utility functions and constants

**Main Features:**

- Shared TypeScript interfaces
- Validation schemas
- API contract definitions
- Common utility functions
- Error handling utilities

## Development Workflow

### Getting Started

1. Install dependencies: `yarn install` (from root)
2. Start development servers: `yarn dev`
3. Frontend: http://localhost:5173
4. Backend: http://localhost:3001

### Package Commands

- `yarn workspace @sovren/frontend [command]` - Run command in frontend package
- `yarn workspace @sovren/backend [command]` - Run command in backend package
- `yarn workspace @sovren/shared [command]` - Run command in shared package

### Common Tasks

- Build all packages: `yarn build`
- Test all packages: `yarn test`
- Lint all packages: `yarn lint`
- Type check all packages: `yarn type-check`

## Package Dependencies

```
Frontend → Shared ← Backend
```

- Frontend and Backend can depend on Shared
- Frontend and Backend cannot depend on each other
- Shared cannot depend on Frontend or Backend

## Package Structure Standards

Each package follows a consistent structure:

- `src/` - Source code
- `dist/` - Build output (gitignored)
- `coverage/` - Test coverage reports (gitignored)
- `package.json` - Package configuration
- `tsconfig.json` - TypeScript configuration
- `README.md` - Package-specific documentation

## Adding New Packages

When adding a new package:

1. Create directory under `packages/`
2. Follow naming convention: `@sovren/[package-name]`
3. Include in root workspace configuration
4. Follow established structure standards
5. Update this README with package description

For detailed package organization guidelines, see [docs/monorepo-organization.md](../docs/monorepo-organization.md).
