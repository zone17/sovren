# Database Guide

**Epic 005 Backend Service Refactoring - Database Development**

---

## Schema Design

### Entity Relationships

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nostr_pubkey VARCHAR(64) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Content table
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'post',
  status VARCHAR(20) DEFAULT 'draft',
  nostr_event_id VARCHAR(64) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_created_at ON content(created_at DESC);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount BIGINT NOT NULL,
  currency VARCHAR(10) DEFAULT 'BTC',
  status VARCHAR(20) DEFAULT 'pending',
  invoice TEXT NOT NULL,
  preimage VARCHAR(64),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
```

---

## Migrations

### Creating Migrations

```bash
# Install migration tool
npm install -g node-pg-migrate

# Create new migration
npx node-pg-migrate create add-subscriptions-table

# Generated file: migrations/1234567890_add-subscriptions-table.js
```

### Migration Template

```javascript
// migrations/1234567890_add-subscriptions-table.js
exports.up = (pgm) => {
  pgm.createTable('subscriptions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users' },
    creator_id: { type: 'uuid', notNull: true, references: 'users' },
    tier: { type: 'varchar(50)', notNull: true },
    amount: { type: 'bigint', notNull: true },
    status: { type: 'varchar(20)', default: 'active' },
    expires_at: { type: 'timestamp', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamp', default: pgm.func('NOW()') }
  });

  pgm.createIndex('subscriptions', 'user_id');
  pgm.createIndex('subscriptions', 'creator_id');
  pgm.createIndex('subscriptions', ['status', 'expires_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('subscriptions');
};
```

### Running Migrations

```bash
# Run migrations
DATABASE_URL=postgresql://user:pass@localhost/db npx node-pg-migrate up

# Rollback last migration
npx node-pg-migrate down

# Rollback to specific migration
npx node-pg-migrate down --to 1234567890
```

---

## Query Optimization

### Use Prepared Statements

```typescript
// ✅ GOOD: Parameterized query
await db.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// ❌ BAD: String interpolation (SQL injection risk!)
await db.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

### Index Usage

```sql
-- Check query plan
EXPLAIN ANALYZE SELECT * FROM payments
WHERE user_id = 'abc' AND status = 'completed';

-- Should show "Index Scan" not "Seq Scan"
```

### Batch Operations

```typescript
// ✅ GOOD: Single query with batch insert
await db.query(
  `INSERT INTO payments (user_id, amount)
   SELECT * FROM UNNEST($1::uuid[], $2::bigint[])`,
  [userIds, amounts]
);

// ❌ BAD: Loop with individual inserts
for (const payment of payments) {
  await db.query('INSERT INTO payments ...');  // N queries!
}
```

---

## Transactions

### ACID Compliance

```typescript
export class PaymentRepository {
  async processPaymentWithRefund(
    paymentId: string,
    refundAmount: number
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update payment
      await client.query(
        'UPDATE payments SET status = $1 WHERE id = $2',
        ['refunded', paymentId]
      );

      // Create refund record
      await client.query(
        'INSERT INTO refunds (payment_id, amount) VALUES ($1, $2)',
        [paymentId, refundAmount]
      );

      await client.query('COMMIT');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;

    } finally {
      client.release();
    }
  }
}
```

---

## Connection Pooling

### Pool Configuration

```typescript
// packages/backend/src/config/database.ts
import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  min: 2,          // Minimum connections
  max: 10,         // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on('error', (err) => {
  console.error('Unexpected pool error', err);
  process.exit(-1);
});
```

---

**Next**: [Event Bus Guide](/docs/development/event-bus-guide.md)

**Last Updated**: 2025-10-27
