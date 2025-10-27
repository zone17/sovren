# Sovren NOSTR Implementation Possibilities (NIPs) Specification

**Document Version:** 1.0.0
**Last Updated:** 2025-10-26
**Epic:** 003 Wave 5 - NOSTR Consolidation
**User Stories:** US-320, US-323

## Table of Contents

1. [Overview](#overview)
2. [Event Kind Ranges](#event-kind-ranges)
3. [Kind 30078: Creator Profile Extended](#kind-30078-creator-profile-extended)
4. [Kind 30079: Content Monetization](#kind-30079-content-monetization)
5. [Kind 30080: Analytics Event](#kind-30080-analytics-event)
6. [Kind 30081: Subscription Management](#kind-30081-subscription-management)
7. [Kind 30082: Content Recommendations](#kind-30082-content-recommendations)
8. [Implementation Examples](#implementation-examples)
9. [Migration Path](#migration-path)
10. [Security Considerations](#security-considerations)

---

## Overview

This specification defines Sovren-specific NOSTR event kinds (30078-30082) that extend the standard NOSTR protocol to support creator monetization, analytics, subscriptions, and AI-powered features.

### Design Principles

- **Backward Compatible**: All events follow NIP-01 event structure
- **Parameterized Replaceable**: Uses NIP-33 (kinds 30000-39999) for updateable data
- **Self-Contained**: Events include all necessary metadata
- **Privacy-Focused**: Sensitive data encrypted or omitted
- **Interoperable**: Compatible with standard NOSTR clients

### Why Custom NIPs?

Standard NIPs (1-57) don't cover:
- Creator-specific monetization settings
- Detailed analytics and engagement tracking
- Subscription tier management
- AI-powered recommendations
- Lightning payment integration metadata

---

## Event Kind Ranges

| Kind Range | Purpose | NIP Reference |
|-----------|---------|---------------|
| 30078-30082 | Sovren creator features | This spec |
| 30000-39999 | Parameterized replaceable | NIP-33 |

**Reserved Kinds:**
- **30078**: Creator Profile Extended
- **30079**: Content Monetization Settings
- **30080**: Analytics Event
- **30081**: Subscription Management
- **30082**: Content Recommendations

---

## Kind 30078: Creator Profile Extended

### Purpose
Extended creator metadata beyond NIP-01 kind 0 (basic metadata).

### Event Structure

```typescript
{
  kind: 30078,
  pubkey: "<creator-pubkey>",
  created_at: <unix-timestamp>,
  content: "<JSON-stringified-profile>",
  tags: [
    ["d", "<profile-identifier>"],  // Usually pubkey
    ["name", "<display-name>"],
    ["category", "<creator-category>"],
    ["lightning", "<lightning-address>"],
    ["website", "<url>"],
    ["l", "<language-code>", "ISO 639-1"]
  ],
  id: "<event-id>",
  sig: "<signature>"
}
```

### Content JSON Schema

```json
{
  "displayName": "Alice Creator",
  "bio": "Tech educator and Bitcoin maximalist",
  "avatar": "https://example.com/avatar.jpg",
  "banner": "https://example.com/banner.jpg",
  "categories": ["technology", "education"],
  "lightningAddress": "alice@getalby.com",
  "website": "https://alice.com",
  "links": [
    {
      "platform": "twitter",
      "url": "https://twitter.com/alice",
      "username": "alice",
      "verified": true
    }
  ],
  "paymentMethods": [
    {
      "type": "lightning",
      "address": "alice@getalby.com",
      "preferred": true,
      "enabled": true
    }
  ],
  "acceptsDonations": true,
  "defaultCurrency": "sats",
  "nip05Verified": true,
  "nip05Identifier": "alice@example.com",
  "createdAt": 1698432000,
  "updatedAt": 1698518400,
  "version": "1.0.0"
}
```

### Categories

```typescript
enum CreatorCategory {
  TECHNOLOGY = 'technology',
  EDUCATION = 'education',
  ENTERTAINMENT = 'entertainment',
  GAMING = 'gaming',
  MUSIC = 'music',
  ART = 'art',
  FITNESS = 'fitness',
  FINANCE = 'finance',
  LIFESTYLE = 'lifestyle',
  NEWS = 'news',
  COMEDY = 'comedy',
  FOOD = 'food',
  TRAVEL = 'travel',
  SCIENCE = 'science',
  OTHER = 'other'
}
```

### Use Cases

1. **Creator Discovery**: Search/filter by category
2. **Payment Setup**: Lightning address verification
3. **Social Verification**: Link all creator platforms
4. **Trust Building**: NIP-05 verification badge

---

## Kind 30079: Content Monetization

### Purpose
Paywall configuration, pricing tiers, and Lightning payment settings for specific content.

### Event Structure

```typescript
{
  kind: 30079,
  pubkey: "<creator-pubkey>",
  created_at: <unix-timestamp>,
  content: "<JSON-stringified-settings>",
  tags: [
    ["d", "<content-id>"],
    ["title", "<content-title>"],
    ["type", "<content-type>"],
    ["price", "<default-price>"],
    ["currency", "<default-currency>"],
    ["e", "<related-content-event-id>"],
    ["p", "<creator-pubkey>"]
  ],
  id: "<event-id>",
  sig: "<signature>"
}
```

### Content JSON Schema

```json
{
  "contentId": "article-123",
  "contentType": "article",
  "title": "Advanced Bitcoin Scripting",
  "monetizationModel": "pay-per-view",
  "paywall": {
    "enabled": true,
    "type": "partial",
    "previewLength": 500,
    "gracePeriod": 0
  },
  "pricingTiers": [
    {
      "id": "tier-basic",
      "name": "Basic Access",
      "description": "One-time access to this article",
      "price": 1000,
      "currency": "sats",
      "interval": "one-time",
      "benefits": ["Read article", "Download PDF"],
      "enabled": true
    }
  ],
  "defaultTierId": "tier-basic",
  "revenueShare": [
    {
      "pubkey": "<collaborator-pubkey>",
      "percentage": 20,
      "role": "Co-author"
    }
  ],
  "requiresVerification": false,
  "createdAt": 1698432000,
  "updatedAt": 1698518400,
  "version": "1.0.0"
}
```

### Monetization Models

- **pay-per-view**: One-time payment per content
- **subscription**: Recurring access
- **donation**: Optional contribution
- **hybrid**: Combination of methods

### Use Cases

1. **Paywall Implementation**: Show preview, require payment
2. **Flexible Pricing**: Multiple tiers per content
3. **Revenue Sharing**: Automatic split payments
4. **Time-Limited Access**: Rental/temporary access

---

## Kind 30080: Analytics Event

### Purpose
Track views, engagement, revenue, and performance metrics for content.

### Event Structure

```typescript
{
  kind: 30080,
  pubkey: "<creator-pubkey>",
  created_at: <unix-timestamp>,
  content: "<JSON-stringified-analytics>",
  tags: [
    ["d", "<analytics-event-id>"],
    ["content", "<content-id>"],
    ["type", "<analytics-type>"],
    ["period", "<ISO-8601-period>"],
    ["p", "<creator-pubkey>"]
  ],
  id: "<event-id>",
  sig: "<signature>"
}
```

### Content JSON Schema

```json
{
  "eventType": "view",
  "contentId": "article-123",
  "contentType": "article",
  "viewCount": 1543,
  "uniqueViewers": 892,
  "engagement": {
    "likes": 234,
    "comments": 56,
    "shares": 89,
    "zaps": 123,
    "zapAmount": 45000
  },
  "revenue": {
    "totalRevenue": 89000,
    "currency": "sats",
    "transactionCount": 45,
    "averageTransactionValue": 1978
  },
  "timeOnContent": 456,
  "completionRate": 78.5,
  "regions": {
    "US": 543,
    "EU": 423,
    "ASIA": 234
  },
  "periodStart": 1698432000,
  "periodEnd": 1698518400,
  "granularity": "daily",
  "version": "1.0.0"
}
```

### Analytics Event Types

```typescript
enum AnalyticsEventType {
  VIEW = 'view',
  ENGAGEMENT = 'engagement',
  CONVERSION = 'conversion',
  REVENUE = 'revenue',
  SUBSCRIPTION = 'subscription',
  INTERACTION = 'interaction'
}
```

### Privacy Considerations

- **Anonymized**: No user-level tracking
- **Aggregated**: Regional/device data only
- **Optional**: Creators opt-in to analytics

---

## Kind 30081: Subscription Management

### Purpose
Define subscription tiers, benefits, and manage subscriber counts.

### Event Structure

```typescript
{
  kind: 30081,
  pubkey: "<creator-pubkey>",
  created_at: <unix-timestamp>,
  content: "<JSON-stringified-subscription-data>",
  tags: [
    ["d", "subscription-<creator-pubkey>"],
    ["p", "<creator-pubkey>"],
    ["tier", "<tier-id>"],
    ["currency", "<currency>"]
  ],
  id: "<event-id>",
  sig: "<signature>"
}
```

### Content JSON Schema

```json
{
  "creatorId": "<creator-pubkey>",
  "creatorName": "Alice Creator",
  "tiers": [
    {
      "id": "tier-premium",
      "name": "Premium",
      "description": "Full access to all content",
      "price": 21000,
      "currency": "sats",
      "interval": "monthly",
      "benefits": {
        "accessLevel": "premium",
        "features": ["All content", "Early access", "Exclusive chat"],
        "exclusiveContent": true,
        "earlyAccess": true,
        "adFree": true
      },
      "subscriberCount": 234,
      "maxSubscribers": 500,
      "enabled": true
    }
  ],
  "stats": {
    "totalSubscribers": 456,
    "activeSubscribers": 423,
    "monthlyRecurringRevenue": 8883000,
    "churnRate": 5.2,
    "growthRate": 12.3
  },
  "allowGifting": true,
  "allowTrial": true,
  "trialDuration": 7,
  "autoRenew": true,
  "createdAt": 1698432000,
  "updatedAt": 1698518400,
  "version": "1.0.0"
}
```

### Use Cases

1. **Tier Management**: Create/update subscription offerings
2. **Subscriber Metrics**: Track growth and churn
3. **Benefit Definitions**: Clear value proposition
4. **Capacity Limits**: Exclusive/limited tiers

---

## Kind 30082: Content Recommendations

### Purpose
AI-generated personalized content feeds for users.

### Event Structure

```typescript
{
  kind: 30082,
  pubkey: "<recommender-pubkey>",
  created_at: <unix-timestamp>,
  content: "<JSON-stringified-recommendations>",
  tags: [
    ["d", "recommendations-<target-pubkey>-<timestamp>"],
    ["p", "<target-user-pubkey>"],
    ["feed", "<feed-type>"],
    ["algo", "<algorithm-name>"],
    ["expiration", "<expiration-timestamp>"]
  ],
  id: "<event-id>",
  sig: "<signature>"
}
```

### Content JSON Schema

```json
{
  "targetPubkey": "<user-pubkey>",
  "recommendations": [
    {
      "contentId": "article-456",
      "eventId": "<content-event-id>",
      "creatorPubkey": "<creator-pubkey>",
      "title": "Bitcoin Script Deep Dive",
      "contentType": "article",
      "score": {
        "confidence": 0.92,
        "relevance": 0.88,
        "quality": 0.95,
        "engagement": 0.76,
        "overall": 0.87
      },
      "source": "ai_collaborative",
      "reason": "Based on your reading history",
      "publishedAt": 1698432000
    }
  ],
  "feedType": "personalized",
  "algorithm": "hybrid-ml-v1",
  "algorithmVersion": "1.2.3",
  "generatedAt": 1698518400,
  "expiresAt": 1698604800,
  "refreshInterval": 3600,
  "version": "1.0.0"
}
```

### Recommendation Sources

```typescript
enum RecommendationSource {
  AI_COLLABORATIVE = 'ai_collaborative',
  AI_CONTENT_BASED = 'ai_content_based',
  AI_HYBRID = 'ai_hybrid',
  TRENDING = 'trending',
  FOLLOWING = 'following',
  SIMILAR_USERS = 'similar_users',
  MANUAL = 'manual'
}
```

### Privacy & Transparency

- **Explainable**: Reason for each recommendation
- **Ephemeral**: Recommendations expire
- **Opt-out**: Users can disable
- **No Tracking**: No personal data stored

---

## Implementation Examples

### Publishing Creator Profile

```typescript
import { SovrenNIPService } from '@/services/nostr/SovrenNIPService';

const sovrenNIP = new SovrenNIPService(/* ... */);

const profile = {
  displayName: 'Alice Creator',
  bio: 'Bitcoin educator',
  categories: [CreatorCategory.TECHNOLOGY],
  lightningAddress: 'alice@getalby.com',
  links: [],
  paymentMethods: [{
    type: 'lightning',
    address: 'alice@getalby.com',
    preferred: true,
    enabled: true
  }],
  createdAt: Math.floor(Date.now() / 1000),
  updatedAt: Math.floor(Date.now() / 1000),
  version: '1.0.0'
};

const result = await sovrenNIP.publishCreatorProfile(profile);
```

### Fetching Content Monetization

```typescript
const contentId = 'article-123';
const result = await sovrenNIP.fetchMonetizationSettings(contentId);

if (result.success) {
  const { pricingTiers, paywall } = result.data;
  // Show paywall or pricing options
}
```

### Tracking Analytics

```typescript
const analyticsData = {
  eventType: AnalyticsEventType.VIEW,
  contentId: 'article-123',
  viewCount: 1,
  uniqueViewers: 1,
  periodStart: Math.floor(Date.now() / 1000),
  periodEnd: Math.floor(Date.now() / 1000),
  granularity: 'hourly',
  version: '1.0.0'
};

await sovrenNIP.trackAnalyticsEvent('analytics-123', analyticsData);
```

---

## Migration Path

### From Legacy Systems

1. **Backup**: Create full backup of existing data
2. **Dry Run**: Test migration with `--dry-run` flag
3. **Migrate**: Run migration scripts
4. **Validate**: Verify data integrity
5. **Rollback**: Available if issues detected

### Migration Scripts

```bash
# Dry run (test only)
npm run migrate:all:dry-run

# Actual migration
npm run migrate:all

# Validate migration
npm run migrate:validate

# Rollback if needed
npm run migrate:rollback
```

See [Migration Guide](./migration-guide.md) for detailed instructions.

---

## Security Considerations

### Private Key Protection

- **Never** include private keys in events
- Use encrypted storage (AES-256-GCM)
- Password-protected key encryption
- Browser extension support

### Payment Security

- Validate Lightning addresses
- Verify payment receipts
- Use HTTPS for all external links
- Rate limit payment requests

### Data Privacy

- No personally identifiable information
- Aggregated analytics only
- User consent required
- GDPR/privacy compliance

### Event Validation

All events must:
- Have valid signatures (NIP-01)
- Pass schema validation (Zod)
- Include version metadata
- Use proper event kinds

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-26 | Initial specification |

---

## References

- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-33: Parameterized Replaceable Events](https://github.com/nostr-protocol/nips/blob/master/33.md)
- [Sovren PRD](../../SOVREN_PRD.md)
- [Migration Guide](./migration-guide.md)

---

**Maintained by**: Sovren Development Team
**Questions**: See [GitHub Issues](https://github.com/sovren/sovren/issues)
