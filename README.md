# Sovren - Creator Monetization Platform

> **Elite Software Engineering Standards Applied** 🏆  
> A NOSTR-based creator monetization platform built with modern web technologies, comprehensive testing, feature flags, and production-ready infrastructure.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/sovren.git
cd sovren

# Install dependencies
npm install

# Start development servers
npm run dev          # Frontend on http://localhost:5173
npm run dev:backend  # Backend on http://localhost:3001

# Run tests
npm test

# Run linting
npm run lint
```

## 📊 Project Status

- ✅ **15 Tests Passing** across all packages
- ✅ **Monorepo Structure** with npm workspaces
- ✅ **CI/CD Pipeline** with GitHub Actions
- ✅ **Feature Flags** with backup and audit trail
- ✅ **Mobile-First Design** guidelines implemented
- ✅ **API-First Architecture** with comprehensive documentation
- ✅ **Production Ready** deployment configuration

## 🏗️ Architecture

### Monorepo Structure
```
sovren/
├── packages/
│   ├── frontend/     # React + TypeScript + Redux Toolkit
│   ├── backend/      # Express + TypeScript + Prisma
│   └── shared/       # Common types and utilities
├── docs/             # Comprehensive documentation
├── .github/          # CI/CD workflows
└── deploy/           # Deployment configurations
```

### Technology Stack

- **Frontend**: React 18, TypeScript, Redux Toolkit, Vite, React Router
- **Backend**: Express.js, TypeScript, Prisma ORM, PostgreSQL
- **Testing**: Jest, React Testing Library, Supertest
- **Code Quality**: ESLint, Prettier, Husky, lint-staged
- **CI/CD**: GitHub Actions, Vercel deployment
- **Monitoring**: Feature flags, request logging, error tracking

## 🎯 Features

### ✅ Implemented
- **Authentication System**: JWT-based with NOSTR key support
- **Feature Flag System**: Type-safe flags with Zod validation
- **Testing Framework**: Unit, integration, and E2E tests
- **Mobile-First Design**: Responsive, touch-optimized UI
- **API Documentation**: OpenAPI specifications
- **Security**: Rate limiting, input validation, security headers
- **Monitoring**: Request logging, error tracking

### 🚧 In Development
- Payment integration (Lightning Network)
- NOSTR protocol integration
- Content creation tools
- AI-powered recommendations

## 🛠️ Development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Git

### Environment Setup

1. Copy environment variables:
```bash
cp packages/backend/.env.example packages/backend/.env
```

2. Configure your database and environment variables

3. Run database migrations:
```bash
cd packages/backend
npx prisma migrate dev
```

4. Install dependencies and start development:
```bash
npm install
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run CI tests
npm run test:ci
```

### Code Quality

```bash
# Lint all packages
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

## 🚀 Deployment

### GitHub Setup

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Repository name: `sovren`
   - Make it public or private (your choice)
   - **Don't** initialize with README (we already have one)

2. **Connect your local repository:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/sovren.git
   git branch -M main
   git push -u origin main
   ```

3. **Verify GitHub Actions:**
   - Go to your repository on GitHub
   - Click on the "Actions" tab
   - You should see the CI workflow running

### Vercel Deployment

1. **Install Vercel CLI (optional):**
   ```bash
   npm install -g vercel
   ```

2. **Deploy via Vercel Dashboard:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select the `sovren` repository
   - Vercel will auto-detect the framework settings
   - Click "Deploy"

3. **Or deploy via CLI:**
   ```bash
   vercel --prod
   ```

4. **Environment Variables:**
   Add these environment variables in your Vercel dashboard:
   ```
   NODE_ENV=production
   DATABASE_URL=your_production_database_url
   JWT_SECRET=your_jwt_secret
   NEXTAUTH_SECRET=your_nextauth_secret
   ```

### Custom Domain (Optional)

1. In your Vercel dashboard, go to Settings > Domains
2. Add your custom domain (e.g., `sovren.dev`)
3. Follow Vercel's DNS configuration instructions

## 📁 Feature Flags

Manage feature flags using our CLI tool:

```bash
# List all flags
npm run feature-flags list

# Enable a flag
npm run feature-flags set enablePayments true

# Disable a flag
npm run feature-flags set enablePayments false

# Get flag status
npm run feature-flags get enablePayments
```

## 📚 Documentation

- [API Architecture](docs/api-architecture.md) - API design and endpoints
- [Mobile-First Design](docs/mobile-first-design.md) - Design guidelines
- [Feature Flags](docs/feature-flags.md) - Feature flag management
- [Contributing](CONTRIBUTING.md) - Development guidelines
- [Changelog](CHANGELOG.md) - Version history

## 🔒 Security

- JWT authentication with secure token handling
- Rate limiting on all API endpoints
- Input validation with Zod schemas
- Security headers configured
- CORS properly configured
- SQL injection prevention
- XSS protection

## 🧪 Testing Philosophy

We follow Test-Driven Development (TDD) practices:

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and database interactions
- **E2E Tests**: Test complete user workflows
- **Coverage**: Maintain 80%+ test coverage across all packages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📈 Monitoring

- **Health Checks**: `/api/v1/health` endpoint
- **Feature Flags**: Real-time flag monitoring
- **Request Logging**: Structured JSON logs
- **Error Tracking**: Comprehensive error reporting
- **Performance**: Core Web Vitals monitoring

## 🛡️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

Built with ❤️ by the Sovren team

---

**Ready to launch?** Follow the deployment instructions above to get Sovren running on GitHub and Vercel! 🚀
