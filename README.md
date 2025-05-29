# Sovren - Creator Monetization Platform

> **Elite Software Engineering Standards Applied** 🏆  
> A NOSTR-based creator monetization platform built with modern web technologies, comprehensive testing, feature flags, and production-ready infrastructure.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/zone17/sovren.git
cd sovren

# Install dependencies
npm install

# Start development server
npm run dev          # Frontend on http://localhost:5173

# Run tests
npm test

# Run linting
npm run lint
```

## 📊 Project Status

- ✅ **Deployed on Vercel** with Supabase backend
- ✅ **Full-Stack Serverless** architecture
- ✅ **TypeScript** throughout
- ✅ **CI/CD Pipeline** with GitHub Actions
- ✅ **Feature Flags** system
- ✅ **Mobile-First Design** responsive UI
- ✅ **Production Ready** with monitoring

## 🏗️ Architecture

### Deployment Structure
```
Sovren (Vercel Full-Stack)
├── Frontend (React + Vite)      → Static hosting
├── API Routes (/api/*)          → Serverless functions  
├── Database (Supabase)          → PostgreSQL + Auth
└── CI/CD (GitHub Actions)       → Automated testing & deployment
```

### Technology Stack

- **Frontend**: React 18, TypeScript, Redux Toolkit, Vite, TailwindCSS
- **Backend**: Vercel Serverless Functions, Supabase Client
- **Database**: Supabase PostgreSQL with built-in Auth
- **Testing**: Jest, React Testing Library
- **Code Quality**: ESLint, Prettier, Husky, lint-staged
- **Deployment**: Vercel with GitHub integration
- **Monitoring**: Vercel Analytics, Supabase Metrics

## 🎯 Features

### ✅ Implemented
- **Full-Stack Serverless**: Vercel + Supabase architecture
- **Database**: PostgreSQL with real-time subscriptions
- **Authentication**: Ready for NOSTR integration
- **API Layer**: RESTful serverless functions
- **Testing Framework**: Comprehensive test suite
- **Mobile-First Design**: Responsive, touch-optimized UI
- **Type Safety**: TypeScript throughout
- **CI/CD**: Automated testing and deployment

### 🚧 In Development  
- NOSTR protocol integration
- Lightning Network payments
- Content creation tools
- AI-powered recommendations
- Real-time notifications

## 🛠️ Development

### Prerequisites
- Node.js 18+
- Git
- Vercel account (for deployment)
- Supabase account (for database)

### Environment Setup

1. **Clone and install:**
```bash
git clone https://github.com/zone17/sovren.git
cd sovren
npm install
```

2. **Set up Supabase** (if needed):
   - Create account at https://supabase.com
   - Create new project
   - Note your project URL and service role key

3. **Start development:**
```bash
npm run dev  # Starts on http://localhost:5173
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

### Automatic Deployment (Current Setup)

**Already configured and deployed** ✅

- **GitHub Repository**: https://github.com/zone17/sovren
- **Live URL**: Your Vercel deployment URL
- **Auto-deploy**: Pushes to `main` trigger deployments

### Manual Deployment Setup

If you need to redeploy or create a new instance:

1. **Vercel Setup:**
   ```bash
   # Install Vercel CLI (optional)
   npm install -g vercel
   
   # Deploy
   vercel --prod
   ```

2. **Environment Variables:**
   Add in Vercel Dashboard → Settings → Environment Variables:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Custom Domain** (optional):
   - Vercel Dashboard → Settings → Domains
   - Add your domain and configure DNS

## 📁 Project Structure

```
sovren/
├── packages/
│   └── frontend/           # Main application
│       ├── src/           # React application
│       ├── api/           # Serverless API functions
│       ├── lib/           # Utilities (database, etc.)
│       └── public/        # Static assets
├── docs/                  # Documentation
├── .github/               # CI/CD workflows
├── vercel.json           # Deployment configuration
└── package.json          # Root workspace configuration
```

## 🔧 API Routes

Current serverless endpoints:

- **Health Check**: `GET /api/health` - System status
- **Database**: Supabase client integration
- **Authentication**: Ready for implementation  
- **Feature Flags**: Type-safe configuration

## 📚 Documentation

- [Vercel Setup Guide](./docs/vercel-setup.md) - Deployment instructions
- [Development Workflow](./docs/development-workflow.md) - Development process
- [CI/CD Architecture](./docs/ci-cd-architecture.md) - Pipeline details
- [Feature Flags](./docs/feature-flags.md) - Feature management
- [API Architecture](./docs/api-architecture.md) - API documentation

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🔗 Links

- **Live Demo**: [Your Vercel URL]
- **GitHub**: https://github.com/zone17/sovren
- **Documentation**: [./docs/](./docs/)
- **Issues**: https://github.com/zone17/sovren/issues
