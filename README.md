# Sovren - Creator Monetization Platform

Sovren is a decentralized creator monetization platform built on the NOSTR protocol, enabling creators to monetize their content through direct fan support and Lightning Network payments.

## Features

- NOSTR protocol integration for decentralized content distribution
- Lightning Network payments for instant, low-fee transactions
- AI-powered content recommendations
- Mobile-first responsive design
- Feature flag-driven development for safe deployments
- Comprehensive test coverage
- API-first architecture
- **Strict type safety and runtime validation (TypeScript + Zod)**
- **All code must pass lint and tests before merging**

## Tech Stack

### Frontend

- React with TypeScript
- Redux Toolkit for state management
- Tailwind CSS for styling
- Vite for build tooling
- Storybook for component documentation

### Backend

- Node.js with TypeScript
- Express.js
- PostgreSQL with Prisma ORM
- OpenAI API integration
- NOSTR protocol integration
- Lightning Network integration

### DevOps

- GitHub Actions for CI/CD
- Vercel for deployment
- Sentry for error tracking
- Umami for analytics
- Custom feature flag system (file-based, type-safe, API-driven)

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 10.2.4
- PostgreSQL >= 14
- Lightning Network node (optional for development)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/sovren.git
   cd sovren
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start development servers:
   ```bash
   npm run dev
   ```

## Development

### Project Structure

```
sovren/
├── packages/
│   ├── frontend/        # React frontend application
│   ├── backend/         # Express.js backend server
│   └── shared/          # Shared types and utilities
├── docs/               # Project documentation
└── scripts/            # Build and deployment scripts
```

### Available Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build all packages
- `npm run test` - Run tests
- `npm run lint` - Run linter
- `npm run format` - Format code with Prettier
- `npm run feature-flags` - Run the feature flag CLI tool

## Testing & Linting

All code must pass lint and tests before merging. Run:

```bash
npm run lint
npm run test
```

**Test Infrastructure:**

- Integration tests run against a dedicated test database (`sovren_test`) with automatic seeding and cleanup.
- Defensive error handling is implemented in all route handlers and tests for robust, predictable API responses.
- Failed test responses are logged for easier debugging.
- Environment-specific `.env.test` ensures safe, isolated test runs.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

Please report any security issues to security@sovren.com

## Support

For support, please open an issue in the GitHub repository or contact support@sovren.com

## Feature Flag System

The feature flag system provides a type-safe, file-based solution for managing feature toggles. See [Feature Flag Documentation](docs/feature-flags.md) for detailed information.

Key features:

- Type-safe flag definitions using Zod
- File-based storage with automatic backups
- Admin-only updates with rate limiting
- CLI tool for management
- React hook for frontend integration
- Comprehensive audit logging
- **Strict type safety and runtime validation**
- **All code must pass lint and tests**

Quick start:

```bash
# List current flags
npm run feature-flags list

# Update flags
npm run feature-flags set enablePayments=true

# Cleanup old backups
npm run feature-flags cleanup --days 7
```
