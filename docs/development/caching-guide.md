# Caching Guide

**Epic 005 Backend Service Refactoring - Multi-Layer Caching Strategy**

---

## Cache Layers

### 1. Memory Cache (L1)
- **Speed**: Fastest (< 1ms)
- **Size**: Small (64-256MB)
- **Use**: Frequently accessed hot data

### 2. Redis Cache (L2)
- **Speed**: Fast (1-5ms)
- **Size**: Large (GB scale)
- **Use**: Shared cache across instances

### 3. Database (L3)
- **Speed**: Slower (10-100ms)
- **Size**: Unlimited
- **Use**: Source of truth

---

## TTL Configuration

```typescript
export const CACHE_TTL = {
  // Short-lived (5 minutes)
  TRENDING_CONTENT: 300,
  SEARCH_RESULTS: 300,

  // Medium-lived (1 hour)
  USER_PROFILE: 3600,
  CONTENT_DETAIL: 3600,

  // Long-lived (24 hours)
  CREATOR_LIST: 86400,
  STATIC_CONFIG: 86400
};
```

---

## Cache Keys

### Naming Convention

```typescript
// Pattern: entity:id:sub-resource
'user:123:profile'
'content:456:details'
'payment:789:status'

// Pattern with filters: entity:filter1:filter2
'content:trending:last24h'
'users:search:query=john'
```

---

## Cache Invalidation

### Pattern-Based Invalidation

```typescript
export class ContentService {
  async updateContent(id: string, updates: Partial<Content>): Promise<Content> {
    const updated = await this.repository.update(id, updates);

    // Invalidate specific content
    await this.cache.delete(`content:${id}:details`);

    // Invalidate user's content list
    await this.cache.deletePattern(`user:${updated.userId}:content:*`);

    // Invalidate trending (if needed)
    if (updates.trending) {
      await this.cache.delete('content:trending:*');
    }

    return updated;
  }
}
```

---

**Next**: [Payment System Guide](/docs/development/payment-system-guide.md)

**Last Updated**: 2025-10-27
