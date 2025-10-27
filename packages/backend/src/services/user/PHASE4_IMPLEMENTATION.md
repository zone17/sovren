# Phase 4: User Services Implementation Guide

## Overview
6 User Services to be implemented in parallel by specialized agents.

## Service Specifications

### 1. UserAuthenticationService (US-E5-018)
**File**: `UserAuthenticationService.ts`
```typescript
interface IUserAuthenticationService {
  login(credentials: LoginCredentials): Promise<AuthSession>;
  logout(sessionId: string): Promise<void>;
  verifyMFA(userId: string, token: string): Promise<boolean>;
  setupMFA(userId: string, type: MFAType): Promise<MFASetup>;
  refreshSession(refreshToken: string): Promise<AuthSession>;
  validatePassword(password: string): Promise<PasswordValidation>;
  lockAccount(userId: string, reason: string): Promise<void>;
}
```

**Requirements**:
- Multi-factor authentication (TOTP, WebAuthn, backup codes)
- Rate limiting (5 attempts per 15 minutes)
- Session management with Redis
- Password policies (min 12 chars, complexity rules)
- Account lockout after 10 failed attempts
- Secure password hashing (Argon2id)
- Integration: Redis, EventBus, AuditLog, Notification

### 2. UserProfileService (US-E5-019)
**File**: `UserProfileService.ts`
```typescript
interface IUserProfileService {
  getProfile(userId: string): Promise<UserProfile>;
  updateProfile(userId: string, updates: ProfileUpdate): Promise<UserProfile>;
  uploadAvatar(userId: string, file: MediaFile): Promise<string>;
  setPrivacy(userId: string, settings: PrivacySettings): Promise<void>;
  verifyProfile(userId: string): Promise<VerificationStatus>;
  deleteProfile(userId: string): Promise<void>;
  exportData(userId: string): Promise<UserDataExport>;
}
```

**Requirements**:
- CRUD operations with validation
- Avatar upload with CDN integration
- Privacy controls (public/private/friends)
- Profile verification workflow
- GDPR compliance (data export/deletion)
- Integration: Storage, Cache, EventBus, AuditLog

### 3. UserPreferencesService (US-E5-020)
**File**: `UserPreferencesService.ts`
```typescript
interface IUserPreferencesService {
  getPreferences(userId: string): Promise<UserPreferences>;
  updatePreferences(userId: string, prefs: Partial<UserPreferences>): Promise<void>;
  getDefaultPreferences(): Promise<UserPreferences>;
  resetToDefaults(userId: string): Promise<void>;
  migratePreferences(fromVersion: string, toVersion: string): Promise<void>;
}
```

**Requirements**:
- Notification preferences (email, push, SMS, in-app)
- Theme preferences (light/dark/auto)
- Language and locale settings
- Content preferences (NSFW, categories)
- Privacy preferences
- Default value management
- Integration: Cache, EventBus

### 4. UserActivityService (US-E5-021)
**File**: `UserActivityService.ts`
```typescript
interface IUserActivityService {
  trackActivity(userId: string, activity: ActivityEvent): Promise<void>;
  getActivityHistory(userId: string, options: QueryOptions): Promise<Activity[]>;
  getLastSeen(userId: string): Promise<Date>;
  getDevices(userId: string): Promise<Device[]>;
  revokeDevice(userId: string, deviceId: string): Promise<void>;
  exportActivityLog(userId: string): Promise<ActivityExport>;
}
```

**Requirements**:
- Real-time activity tracking
- Session history with device info
- Last seen updates
- Device management (trusted devices)
- GDPR-compliant data export
- Efficient storage with time-series DB
- Integration: TimescaleDB, Redis, EventBus

### 5. UserRelationshipService (US-E5-022)
**File**: `UserRelationshipService.ts`
```typescript
interface IUserRelationshipService {
  follow(followerId: string, followeeId: string): Promise<void>;
  unfollow(followerId: string, followeeId: string): Promise<void>;
  block(blockerId: string, blockedId: string): Promise<void>;
  mute(muterId: string, mutedId: string, duration?: number): Promise<void>;
  getFollowers(userId: string, options: PaginationOptions): Promise<PaginatedResult<User>>;
  getFollowing(userId: string, options: PaginationOptions): Promise<PaginatedResult<User>>;
  getMutualConnections(userId1: string, userId2: string): Promise<User[]>;
  getSuggestedConnections(userId: string): Promise<User[]>;
}
```

**Requirements**:
- Bidirectional relationship tracking
- Privacy setting enforcement
- Efficient graph queries
- Pagination for large datasets
- Connection suggestions algorithm
- Temporary muting with expiry
- Integration: Graph database, Cache, EventBus

### 6. UserAnalyticsService (US-E5-023)
**File**: `UserAnalyticsService.ts`
```typescript
interface IUserAnalyticsService {
  getUserMetrics(userId: string): Promise<UserMetrics>;
  getCohortAnalysis(cohort: CohortDefinition): Promise<CohortMetrics>;
  getRetentionMetrics(dateRange: DateRange): Promise<RetentionData>;
  getEngagementScore(userId: string): Promise<number>;
  getSegmentation(criteria: SegmentCriteria): Promise<UserSegments>;
  generateUserReport(userId: string, type: ReportType): Promise<Report>;
}
```

**Requirements**:
- User-level metrics (posts, engagement, revenue)
- Cohort analysis (acquisition, behavior)
- Retention tracking (daily, weekly, monthly)
- Engagement scoring algorithm
- User segmentation for targeting
- Custom report generation
- Integration: Analytics DB, Cache, EventBus

## Implementation Standards

### Service Structure
```typescript
@injectable()
export class UserServiceName implements IUserServiceName {
  private readonly logger: Logger;

  constructor(
    @inject(TYPES.Database) private db: IDatabase,
    @inject(TYPES.Cache) private cache: ICacheService,
    @inject(TYPES.EventBus) private eventBus: IEventBusService,
    @inject(TYPES.AuditLog) private auditLog: IAuditLogService,
  ) {
    this.logger = new Logger(UserServiceName.name);
  }

  // Implement all interface methods with:
  // - Input validation
  // - Caching strategy
  // - Event emission
  // - Audit logging
  // - Error handling
  // - Performance monitoring
}
```

### Database Schema

```sql
-- Users table (existing, for reference)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url VARCHAR(500),
  banner_url VARCHAR(500),
  location VARCHAR(100),
  website VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  privacy_level ENUM('public', 'private', 'friends'),
  metadata JSONB
);

-- User preferences
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  notifications JSONB NOT NULL DEFAULT '{}',
  privacy JSONB NOT NULL DEFAULT '{}',
  display JSONB NOT NULL DEFAULT '{}',
  content JSONB NOT NULL DEFAULT '{}',
  version INTEGER DEFAULT 1
);

-- User activities
CREATE TABLE user_activities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  activity_type VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  device_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_activities_user_id (user_id),
  INDEX idx_user_activities_created_at (created_at)
);

-- User relationships
CREATE TABLE user_relationships (
  follower_id UUID REFERENCES users(id),
  following_id UUID REFERENCES users(id),
  relationship_type ENUM('follow', 'block', 'mute'),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  PRIMARY KEY (follower_id, following_id, relationship_type),
  INDEX idx_relationships_following (following_id)
);

-- MFA settings
CREATE TABLE user_mfa (
  user_id UUID REFERENCES users(id),
  mfa_type ENUM('totp', 'webauthn', 'backup'),
  secret TEXT,
  backup_codes TEXT[],
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, mfa_type)
);
```

## Testing Requirements

Each service requires:

1. **Unit Tests** (95%+ coverage)
   - All public methods
   - Edge cases and error paths
   - Mock external dependencies
   - Validate event emissions

2. **Integration Tests**
   - Database operations
   - Cache interactions
   - Event bus communication
   - Service interdependencies

3. **Security Tests**
   - Authentication flows
   - Authorization checks
   - Rate limiting
   - Input validation

Example test structure:
```typescript
describe('UserAuthenticationService', () => {
  describe('login', () => {
    it('should authenticate valid credentials');
    it('should enforce rate limiting');
    it('should lock account after failed attempts');
    it('should require MFA when enabled');
    it('should emit login event');
    it('should log authentication attempt');
  });

  describe('security', () => {
    it('should prevent timing attacks');
    it('should hash passwords with Argon2id');
    it('should invalidate sessions on logout');
    it('should rotate refresh tokens');
  });
});
```

## Quality Gates

- [ ] 95%+ test coverage
- [ ] Zero security vulnerabilities
- [ ] All TypeScript strict checks pass
- [ ] Performance benchmarks met:
  - Auth operations < 200ms
  - Profile queries < 50ms
  - Preference updates < 30ms
- [ ] Documentation complete
- [ ] Integration tests passing
- [ ] Audit logging verified
- [ ] Event emissions confirmed

## Parallel Execution Plan

### Agent Assignments:
- **Agent 1**: UserAuthenticationService (complex, security-critical)
- **Agent 2**: UserProfileService + UserPreferencesService
- **Agent 3**: UserActivityService + UserRelationshipService
- **Agent 4**: UserAnalyticsService

### Dependencies:
- All services depend on shared interfaces
- UserAnalyticsService depends on activity data
- Coordinate on shared database schema

### Timeline:
- Start: All agents simultaneously
- Duration: 2-3 hours per service
- Total: 3-4 hours with parallelization

## Success Criteria

- All 6 services fully implemented
- 95%+ average test coverage
- Security audit passed
- Performance benchmarks met
- GDPR compliance verified
- Documentation complete
- Container registration updated
- Integration with Epic 005 services

---

**Phase Start**: ${new Date().toISOString()}
**Target Completion**: 3-4 hours
**Quality Standard**: Sovren Elite (99/100)