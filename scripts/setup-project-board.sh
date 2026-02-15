#!/bin/bash
# Setup GitHub Projects Board for Sovren Production Launch
# This script creates the project board with all epics and user stories

set -e  # Exit on error

echo "🚀 Setting up Sovren Production Launch Project Board..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v gh &> /dev/null; then
    echo -e "${RED}ERROR: GitHub CLI (gh) is not installed${NC}"
    echo "Install with: brew install gh"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo -e "${RED}ERROR: Not authenticated with GitHub${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites met${NC}"
echo ""

# Get repository info
echo "📍 Detecting repository..."
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || echo "")

if [ -z "$REPO" ]; then
    echo -e "${YELLOW}Could not auto-detect repository${NC}"
    read -p "Enter repository (owner/repo): " REPO
fi

echo "Repository: $REPO"
echo ""

# Create project
echo "📊 Creating GitHub Project..."

PROJECT_TITLE="Sovren Production Launch"
PROJECT_RESPONSE=$(gh project create \
  --title "$PROJECT_TITLE" \
  --format json 2>/dev/null || echo '{"number": 0}')

PROJECT_NUMBER=$(echo $PROJECT_RESPONSE | jq -r '.number')

if [ "$PROJECT_NUMBER" = "0" ] || [ -z "$PROJECT_NUMBER" ]; then
    echo -e "${YELLOW}Could not create project automatically${NC}"
    echo "Please create project manually at: https://github.com/$REPO/projects"
    read -p "Enter project number: " PROJECT_NUMBER
fi

echo -e "${GREEN}✓ Project created: #$PROJECT_NUMBER${NC}"
echo "View at: https://github.com/$REPO/projects/$PROJECT_NUMBER"
echo ""

# Create epics
echo "📁 Creating epics..."

EPIC_IMMEDIATE=$(gh issue create \
  --repo $REPO \
  --title "EPIC-IMMEDIATE: Fix Immediate Blockers" \
  --label "epic,priority:critical" \
  --body "## Epic: Immediate Blockers (Week 1)

**Goal**: Unblock testing, commit staged work, secure platform

**Duration**: 1 week (Nov 4-8)

**User Stories**:
- Fix test suite (Jest config, pool.test.ts)
- Security remediation (rotate secrets, update deps)
- Commit staged US-007 work

**Success Criteria**:
- All tests passing (85%+ coverage)
- Security score 90+/100
- US-007 merged to main

**Agent Assignment**: security-engineer, code-review-specialist" \
  --json number --jq '.number')

echo -e "${GREEN}✓ Created EPIC-IMMEDIATE: #$EPIC_IMMEDIATE${NC}"

EPIC_FRONTEND=$(gh issue create \
  --repo $REPO \
  --title "EPIC-FRONTEND: Critical Frontend User Stories" \
  --label "epic,priority:critical" \
  --body "## Epic: Critical Frontend Implementation (Weeks 2-4)

**Goal**: Implement US-001, US-002, US-003, US-007 frontend

**Duration**: 3 weeks (Nov 11 - Dec 1)

**User Stories**:
- US-001/005: NOSTR Authentication UI
- US-002: Content Creation & Publishing
- US-007: Lightning Payment UI
- US-003: Subscription Tier Management

**Success Criteria**:
- All UIs functional
- 95%+ test coverage
- Code reviews approved

**Agent Assignment**: design-ux-specialist, elite-frontend-dev, test-automation-engineer, code-review-specialist, nostr-protocol-specialist, lightning-network-specialist" \
  --json number --jq '.number')

echo -e "${GREEN}✓ Created EPIC-FRONTEND: #$EPIC_FRONTEND${NC}"

EPIC_INTEGRATION=$(gh issue create \
  --repo $REPO \
  --title "EPIC-INTEGRATION: Integration & Testing" \
  --label "epic,priority:high" \
  --body "## Epic: Integration & Testing (Week 5)

**Goal**: E2E testing and integration validation

**Duration**: 1 week (Dec 2-6)

**Tasks**:
- E2E critical user flows (Playwright)
- NOSTR protocol validation
- Accessibility audit (WCAG 2.1 AA)

**Success Criteria**:
- E2E tests passing (5 flows)
- NOSTR compliant
- WCAG AA compliant (90+ Lighthouse)

**Agent Assignment**: e2e-testing-specialist, nostr-protocol-specialist, accessibility-specialist" \
  --json number --jq '.number')

echo -e "${GREEN}✓ Created EPIC-INTEGRATION: #$EPIC_INTEGRATION${NC}"

EPIC_PRODUCTION=$(gh issue create \
  --repo $REPO \
  --title "EPIC-PRODUCTION: Production Readiness" \
  --label "epic,priority:high" \
  --body "## Epic: Production Readiness (Week 6)

**Goal**: Final validations and production deployment

**Duration**: 1 week (Dec 9-13)

**Tasks**:
- Security final audit
- Performance optimization
- Monitoring & observability
- API documentation
- Final code review

**Success Criteria**:
- Security score 95/100
- Core Web Vitals met
- Monitoring live
- Production certified

**Agent Assignment**: security-engineer, performance-optimization-engineer, monitoring-observability-architect, api-documentation-engineer, code-review-specialist" \
  --json number --jq '.number')

echo -e "${GREEN}✓ Created EPIC-PRODUCTION: #$EPIC_PRODUCTION${NC}"
echo ""

# Create user stories
echo "📝 Creating user stories..."

US_001=$(gh issue create \
  --repo $REPO \
  --title "US-001/005: NOSTR Authentication UI" \
  --label "user-story,frontend,priority:critical" \
  --body "## User Story: NOSTR Authentication UI

**Epic**: EPIC-FRONTEND (#$EPIC_FRONTEND)
**Priority**: Critical
**Estimated Days**: 5 days

### Description
As a creator/supporter, I want to authenticate using my NOSTR keys so that I can maintain sovereignty over my identity.

### Acceptance Criteria
- [ ] Support browser extensions (Alby, nos2x)
- [ ] Manual public/private key input option
- [ ] Secure session management with JWT
- [ ] Profile creation during first login
- [ ] Clear error messages for authentication issues
- [ ] Role selection (Creator vs Supporter)

### Agent Workflow
1. **design-ux-specialist**: Create UX design (2 days)
2. **elite-frontend-dev**: Implement components (2 days)
3. **test-automation-engineer**: Create tests (1 day)
4. **code-review-specialist**: Review implementation (0.5 days)

### Deliverables
- [ ] Design mockups (docs/design/us-001-nostr-auth/)
- [ ] Components (packages/frontend/src/features/auth/)
- [ ] Tests with 95%+ coverage
- [ ] Code review approval

### Backend API
- Endpoint: /api/auth/authenticate
- Status: ✅ Complete

### Reference
- PRD: SOVREN_PRD.md - US-001 (line 323) and US-005 (line 370)
- Implementation Plan: AGENT_DRIVEN_IMPLEMENTATION_PLAN.md - Epic 2.1" \
  --json number --jq '.number')

echo -e "${GREEN}✓ Created US-001: #$US_001${NC}"

US_002=$(gh issue create \
  --repo $REPO \
  --title "US-002: Content Creation & Publishing" \
  --label "user-story,frontend,priority:critical" \
  --body "## User Story: Content Creation & Publishing

**Epic**: EPIC-FRONTEND (#$EPIC_FRONTEND)
**Priority**: Critical
**Estimated Days**: 5 days

### Description
As a creator, I want to create and publish content with the option to designate it as premium or free, so I can monetize my work effectively.

### Acceptance Criteria
- [ ] Rich text editor with markdown support
- [ ] Media embedding capabilities (images, videos, audio)
- [ ] Premium/free designation option
- [ ] Content preview before publishing
- [ ] Successful synchronization with NOSTR network
- [ ] Draft saving functionality (auto-save every 30s)

### Agent Workflow
1. **design-ux-specialist**: Create UX design (2 days)
2. **elite-frontend-dev**: Implement editor (3 days)
3. **test-automation-engineer**: Create tests (1 day)
4. **code-review-specialist**: Review implementation (1 day)

### Deliverables
- [ ] Design mockups
- [ ] Content editor component
- [ ] Media uploader
- [ ] NOSTR publishing integration
- [ ] Tests with 95%+ coverage

### Backend API
- Service: ContentCreationService, ContentPublishingService
- Status: ✅ Complete

### Reference
- PRD: SOVREN_PRD.md - US-002 (line 334)
- Implementation Plan: AGENT_DRIVEN_IMPLEMENTATION_PLAN.md - Epic 2.2" \
  --json number --jq '.number')

echo -e "${GREEN}✓ Created US-002: #$US_002${NC}"

US_007=$(gh issue create \
  --repo $REPO \
  --title "US-007: Lightning Payment UI" \
  --label "user-story,frontend,priority:critical" \
  --body "## User Story: Lightning Payment UI

**Epic**: EPIC-FRONTEND (#$EPIC_FRONTEND)
**Priority**: Critical
**Estimated Days**: 5 days

### Description
As a supporter, I want to pay for subscriptions using Lightning Network so I can support creators directly with minimal fees.

### Acceptance Criteria
- [ ] Lightning wallet connection options
- [ ] BOLT11 invoice generation
- [ ] Clear payment status indicators
- [ ] Payment confirmation notification
- [ ] Receipt/transaction history
- [ ] Error handling for failed payments with retry options

### Agent Workflow
1. **design-ux-specialist**: Create payment UX (2 days)
2. **elite-frontend-dev**: Implement payment flow (3 days)
3. **lightning-network-specialist**: Validate Lightning integration (0.5 days)
4. **test-automation-engineer**: Create tests with 100% coverage (1 day)
5. **code-review-specialist**: Security-focused review (1 day)

### Deliverables
- [ ] Payment modal with QR code
- [ ] WebLN integration
- [ ] Payment status tracking
- [ ] Transaction history
- [ ] Tests with 100% coverage (financial critical)

### Backend API
- Service: InvoiceService, PaymentProcessingService, SubscriptionService
- Status: ✅ Complete

### Reference
- PRD: SOVREN_PRD.md - US-007 (line 393)
- Implementation Plan: AGENT_DRIVEN_IMPLEMENTATION_PLAN.md - Epic 2.3" \
  --json number --jq '.number')

echo -e "${GREEN}✓ Created US-007: #$US_007${NC}"

US_003=$(gh issue create \
  --repo $REPO \
  --title "US-003: Subscription Tier Management UI" \
  --label "user-story,frontend,priority:high" \
  --body "## User Story: Subscription Tier Management

**Epic**: EPIC-FRONTEND (#$EPIC_FRONTEND)
**Priority**: High
**Estimated Days**: 2 days

### Description
As a creator, I want to set up multiple subscription tiers with different benefits so I can offer various options to my audience.

### Acceptance Criteria
- [ ] Interface to create, edit, and delete subscription tiers
- [ ] Price setting in sats
- [ ] Description field for benefits
- [ ] Option to set recurring billing period
- [ ] Ability to limit content access by tier
- [ ] Preview of how tiers appear to supporters

### Agent Workflow
1. **design-ux-specialist**: Create tier management UX (1 day)
2. **elite-frontend-dev**: Implement UI (1 day)
3. **test-automation-engineer**: Create tests (0.5 days)
4. **code-review-specialist**: Review (0.5 days)

### Backend API
- Endpoint: /api/subscriptions/tiers
- Status: ✅ Complete

### Reference
- PRD: SOVREN_PRD.md - US-003 (line 346)
- Implementation Plan: AGENT_DRIVEN_IMPLEMENTATION_PLAN.md - Epic 2.4" \
  --json number --jq '.number')

echo -e "${GREEN}✓ Created US-003: #$US_003${NC}"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✨ Project board setup complete!${NC}"
echo ""
echo "📊 Project: #$PROJECT_NUMBER"
echo "   https://github.com/$REPO/projects/$PROJECT_NUMBER"
echo ""
echo "📁 Epics Created:"
echo "   • EPIC-IMMEDIATE: #$EPIC_IMMEDIATE"
echo "   • EPIC-FRONTEND: #$EPIC_FRONTEND"
echo "   • EPIC-INTEGRATION: #$EPIC_INTEGRATION"
echo "   • EPIC-PRODUCTION: #$EPIC_PRODUCTION"
echo ""
echo "📝 User Stories Created:"
echo "   • US-001/005: #$US_001"
echo "   • US-002: #$US_002"
echo "   • US-007: #$US_007"
echo "   • US-003: #$US_003"
echo ""
echo "📚 Next Steps:"
echo "   1. View project board (web interface)"
echo "   2. Add custom fields manually:"
echo "      - Status, Priority, Epic, Agent, Completion, Phase"
echo "   3. Link issues to project"
echo "   4. Start agent invocations"
echo ""
echo "   Run: gh project view $PROJECT_NUMBER --web"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
