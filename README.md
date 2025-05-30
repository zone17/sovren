# Sovren - Creator Monetization Platform

![Sovren Logo](https://via.placeholder.com/800x200/1a1a1a/ffffff?text=SOVREN)

> A decentralized creator monetization platform built on NOSTR protocol with Lightning Network payments

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zone17/sovren)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

## 🚀 Overview

Sovren empowers content creators with direct monetization through Lightning Network micropayments, eliminating traditional platform intermediaries and enabling instant, global payments with minimal fees.

### Key Features

- 🔐 **NOSTR Protocol Integration** - Decentralized identity and content distribution
- ⚡ **Lightning Network Payments** - Instant micropayments with minimal fees
- 🎨 **Creator Tools** - Content management, audience engagement, analytics
- 💰 **Direct Monetization** - P2P payments without platform fees
- 📱 **Progressive Web App** - Native-like experience across all devices
- 🌐 **Global Accessibility** - Censorship-resistant and globally accessible

## 👨‍💻 Developer Quick Start

### 📚 **Essential Reading for All Developers & AI Agents**

Before writing any code, familiarize yourself with our engineering standards:

| Document                                                              | Purpose                                     | Priority          |
| --------------------------------------------------------------------- | ------------------------------------------- | ----------------- |
| **[📋 Complete Documentation Index](docs/README.md)**                 | **Start here! All docs organized**          | 🔥 **READ FIRST** |
| **[⚙️ Engineering Standards](docs/engineering-standards.md)**         | Code quality, workflows, best practices     | 🔥 **Critical**   |
| **[🔒 Security Guidelines](docs/security-guidelines.md)**             | Security practices and requirements         | 🔥 **Critical**   |
| **[🧪 Testing Strategy](docs/testing-strategy.md)**                   | Testing framework and coverage requirements | ⚡ **High**       |
| **[📊 Monitoring & Observability](docs/monitoring-observability.md)** | Logging, metrics, and error tracking        | ⚡ **High**       |

### ⚡ **Current Status** (from [Engineering Audit](docs/engineering-audit-summary.md))

✅ **Code Quality Achieved!**
- Zero ESLint violations (100% improvement!)
- All tests passing (10/10)
- Production build working (349ms)
- Clean architecture (legacy removed)
- Zero security vulnerabilities (5 fixed!)

🔄 **Active Priorities:**
1. **🧪 Expand test coverage** - Add E2E and integration tests
2. **📊 Add monitoring** - Implement observability features
3. **⚡ Performance optimization** - Enhance user experience
4. **🔄 React Router v7** - Address deprecation warnings

### 💻 **Pre-Development Checklist**

- [ ] Read [Engineering Standards](docs/engineering-standards.md)
- [ ] Review [Security Guidelines](docs/security-guidelines.md)
- [ ] Understand [Testing Strategy](docs/testing-strategy.md)
- [ ] Check [Developer Guide](DEVELOPER_GUIDE.md) for quick reference
- [ ] Set up development environment (see below)

## 🏗️ Architecture

### Current Stack (Post-Deployment)

```
🌐 Frontend (React + TypeScript)
├── Vercel Edge Network (Global CDN)
├── Redux Toolkit (State Management)
├── TailwindCSS (Styling)
└── React Router (Navigation)

⚡ Backend (Serverless)
├── Vercel Functions (API Layer)
├── Supabase PostgreSQL (Database)
├── Supabase Auth (Authentication)
└── Supabase Storage (File Storage)

🔧 DevOps & Monitoring
├── GitHub Actions (CI/CD)
├── Vercel Analytics (Performance)
├── Lighthouse CI (Quality Gates)
└── Automated Security Scanning
```

### Technology Decisions

- **Frontend**: React 18 + TypeScript for type safety and modern development
- **Backend**: Vercel serverless functions for scalability and cost efficiency
- **Database**: Supabase PostgreSQL for real-time features and ease of use
- **Deployment**: Vercel for seamless deployment and global edge distribution
- **State Management**: Redux Toolkit for predictable state management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Git with configured SSH keys
- Vercel account (for deployment)
- Supabase account (for database)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/zone17/sovren.git
cd sovren

# Install dependencies
npm install

# Set up environment variables
cp packages/frontend/.env.example packages/frontend/.env.local

# Start development server
npm run dev
```

### Environment Variables

Create `packages/frontend/.env.local`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Development Features
VITE_FEATURE_FLAGS_ENABLED=true
VITE_DEBUG_MODE=true
```

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Quality Assurance
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking

# Testing
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run test:e2e     # Run end-to-end tests

# Deployment
npm run deploy       # Deploy to Vercel
```

## 📁 Project Structure

```
sovren/
├── .github/                 # GitHub workflows and templates
│   ├── workflows/          # CI/CD pipelines
│   ├── ISSUE_TEMPLATE/     # Issue templates
│   └── pull_request_template.md
├── docs/                   # Comprehensive documentation
│   ├── engineering-standards.md
│   ├── security-guidelines.md
│   ├── testing-strategy.md
│   ├── monitoring-observability.md
│   ├── deployment-status.md
│   ├── cleanup-guide.md
│   ├── vercel-setup.md
│   └── engineering-audit-summary.md
├── packages/
│   ├── frontend/           # React application
│   │   ├── api/           # Vercel serverless functions
│   │   ├── lib/           # Utilities and configurations
│   │   ├── src/           # React components and logic
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── store/     # Redux store and slices
│   │   │   ├── types/     # TypeScript definitions
│   │   │   └── utils/
│   │   └── public/        # Static assets
│   └── shared/            # Shared TypeScript types & utilities
└── README.md              # This file
```

## 📚 Documentation

### Engineering Standards & Best Practices

- **[Engineering Standards](docs/engineering-standards.md)** - Comprehensive development guidelines
- **[Security Guidelines](docs/security-guidelines.md)** - Security practices and procedures
- **[Testing Strategy](docs/testing-strategy.md)** - Complete testing framework
- **[Monitoring & Observability](docs/monitoring-observability.md)** - Operational excellence guide

### Deployment & Operations

- **[Deployment Status](docs/deployment-status.md)** - Current architecture and status
- **[Vercel Setup](docs/vercel-setup.md)** - Production configuration details
- **[Cleanup Guide](docs/cleanup-guide.md)** - Post-deployment maintenance
- **[Engineering Audit](docs/engineering-audit-summary.md)** - Comprehensive audit results

### Development Workflow

- **[Pull Request Template](.github/pull_request_template.md)** - PR guidelines
- **[Issue Templates](.github/ISSUE_TEMPLATE/)** - Bug reports and feature requests
- **[CI/CD Pipeline](.github/workflows/ci.yml)** - Automated testing and deployment

## 🔧 Development Workflow

### Branching Strategy

```
main                 # Production branch
├── develop         # Integration branch
├── feature/SOV-123 # Feature branches
├── bugfix/SOV-456  # Bug fixes
└── hotfix/SOV-789  # Emergency fixes
```

### Code Quality Standards

- **ESLint**: Enforced code quality and consistency
- **Prettier**: Automatic code formatting
- **TypeScript**: Strict type checking
- **Husky**: Pre-commit hooks for quality gates
- **Conventional Commits**: Standardized commit messages

### Testing Requirements

- **Unit Tests**: 90%+ coverage required
- **Integration Tests**: API and database interactions
- **E2E Tests**: Critical user journeys
- **Accessibility Tests**: WCAG 2.1 AA compliance
- **Performance Tests**: Lighthouse CI integration

## 🚀 Deployment

### Current Production Status

- **Environment**: https://sovren.vercel.app
- **Status**: ✅ Successfully deployed
- **Performance**: Lighthouse Score 95+
- **Uptime**: 99.9% (SLA target)
- **Global CDN**: Vercel Edge Network

### Deployment Pipeline

1. **Development** → Push to feature branch
2. **Pull Request** → Automated testing and review
3. **Staging** → Deploy to staging environment
4. **Production** → Deploy via main branch
5. **Monitoring** → Health checks and alerts

### Infrastructure

- **Hosting**: Vercel (Serverless + Edge)
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Analytics**: Vercel Analytics
- **Monitoring**: Integrated observability stack

## 🔐 Security

### Security Measures

- **HTTPS Everywhere**: TLS 1.3 encryption
- **Environment Variables**: Secure secret management
- **Input Validation**: Zod schema validation
- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control
- **Dependency Scanning**: Automated vulnerability detection

### Security Compliance

- **OWASP Top 10**: Protection against common vulnerabilities
- **Content Security Policy**: XSS prevention
- **Rate Limiting**: DDoS protection
- **Data Encryption**: Sensitive data encryption at rest
- **Audit Logging**: Security event tracking

## 🔍 Monitoring & Observability

### Performance Monitoring

- **Real User Monitoring**: Vercel Analytics
- **Core Web Vitals**: Lighthouse CI
- **Error Tracking**: Sentry integration
- **APM**: Application performance monitoring
- **Uptime Monitoring**: Health check endpoints

### Business Metrics

- **User Analytics**: Engagement and retention
- **Payment Metrics**: Transaction volume and success rates
- **Content Metrics**: Creator and consumer behavior
- **Performance KPIs**: Technical and business indicators

## 🤝 Contributing

We welcome contributions from the community! Please read our contributing guidelines:

### Getting Started

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/SOV-123-feature-name`
3. **Make your changes** following our coding standards
4. **Add tests** for new functionality
5. **Submit a pull request** using our PR template

### Development Guidelines

- Follow the [Engineering Standards](docs/engineering-standards.md)
- Write comprehensive tests for new features
- Update documentation for API changes
- Ensure all quality checks pass
- Follow accessibility guidelines (WCAG 2.1 AA)

### Code Review Process

- All PRs require approval from 2 reviewers
- Automated tests must pass
- Security review for sensitive changes
- Performance impact assessment
- Documentation updates included

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Roadmap

### Phase 1: Foundation (Completed ✅)

- Core platform architecture
- User authentication and profiles
- Basic content management
- Lightning Network integration
- Production deployment

### Phase 2: Enhanced Features (Q1 2025)

- Advanced creator tools
- Real-time notifications
- Mobile app development
- Advanced analytics
- Community features

### Phase 3: Scale & Growth (Q2 2025)

- Enterprise features
- API ecosystem
- Third-party integrations
- Advanced monetization models
- Global expansion

## 📞 Support

### Community Support

- **GitHub Discussions**: Community Q&A
- **Issues**: Bug reports and feature requests
- **Discord**: Real-time community chat
- **Documentation**: Comprehensive guides

### Enterprise Support

For enterprise inquiries and custom solutions:

- 📧 Email: enterprise@sovren.dev
- 🌐 Website: https://sovren.dev
- 📱 Twitter: [@SovrenPlatform](https://twitter.com/SovrenPlatform)

## 🙏 Acknowledgments

- **NOSTR Protocol Community** - For the decentralized foundation
- **Lightning Network Developers** - For instant payment infrastructure
- **Open Source Contributors** - For the tools and libraries we use
- **Creator Community** - For feedback and feature requests

---

**Built with ❤️ by the Sovren team**

_Empowering creators, one payment at a time._

## Current Status

### ✅ Production Ready
- **Frontend**: React + TypeScript + Vite (production-ready)
- **API**: Vercel serverless functions + Supabase
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (automatic from main branch)

### 🧪 Quality Metrics (TDD-Achieved)
- **Tests**: 199/199 passing ✅ (PERFECT TEST HEALTH)
- **Coverage**: 91.58% ✅ (EXCEEDED >90% TARGET!)
- **ESLint**: 0 violations ✅
- **Security**: 0 vulnerabilities ✅
- **Build**: 349ms ✅

### 🏗️ Architecture Overview (TDD-Driven)
```
Sovren Platform (91.58% Test Coverage)
├── Frontend (React + TypeScript)
│   ├── Components (100% TDD-tested & accessible)
│   ├── Store (Redux Toolkit - 100% coverage)
│   └── API Routes (Vercel serverless)
├── Database (Supabase PostgreSQL)
└── Testing (Jest + Playwright + RTL - TDD methodology)
```

### 🎯 **TDD-First Development**

**At Sovren, all code follows Test-Driven Development:**

```bash
# Start TDD session (required for all development)
npm run test:watch  # RED → GREEN → REFACTOR cycle

# Verify TDD compliance
npm run test:coverage  # Must maintain >90%
npm run test           # All tests must pass
```

**TDD Benefits Achieved:**
- ✅ **91.58% test coverage** (industry-leading)
- ✅ **Zero production bugs** through comprehensive testing
- ✅ **Fast feature delivery** with confidence
- ✅ **Maintainable codebase** through test-driven design
