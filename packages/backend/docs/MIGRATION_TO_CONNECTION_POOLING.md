# Migration Guide: Supabase Client → PostgreSQL Connection Pool

## Overview

This guide walks you through migrating from Supabase client usage to the new PostgreSQL connection pool implementation.

**Why migrate?**
- ✅ Scale to 1,000+ concurrent users
- ✅ Prevent connection exhaustion
- ✅ Better performance monitoring
- ✅ Automatic connection management
- ✅ Production-ready with health checks

---

## Migration Steps

### Step 1: Update Environment Variables

**Add to `.env`**:
```bash
# Database Connection Pool Settings
DB_HOST=localhost                    # Or your Supabase host
DB_PORT=5432
DB_NAME=sovren_dev                   # Your database name
DB_USER=sovren                       # Your database user
DB_PASSWORD=your_password_here       # Your database password
DB_SSL=true                          # Enable for production

# Pool Configuration
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

**For Supabase users**:
```bash
# Get these from Supabase dashboard → Settings → Database
DB_HOST=db.your-project-ref.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-supabase-db-password
DB_SSL=true
```

### Step 2: Update Repository Pattern

**Before (Supabase Client)**:
```typescript
import { SupabaseDatabase } from '../config/database';

export class UserRepository {
  private db: SupabaseDatabase;

  constructor(database?: SupabaseDatabase) {
    this.db = database || require('../config/database').getDatabase();
  }

  async findById(id: string) {
    const { data, error } = await this.db.client
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }
}
```

**After (Connection Pool)**:
```typescript
import { getPool } from '../config/database.config';
import { Pool } from 'pg';

export class UserRepository {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || getPool();
  }

  async findById(id: string) {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }
}
```

### Step 3: Convert Supabase Queries to SQL

#### SELECT Queries

**Before**:
```typescript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('role', 'creator')
  .gte('created_at', '2025-01-01')
  .order('created_at', { ascending: false })
  .limit(10);
```

**After**:
```typescript
const result = await pool.query(`
  SELECT *
  FROM users
  WHERE role = $1
    AND created_at >= $2
  ORDER BY created_at DESC
  LIMIT 10
`, ['creator', '2025-01-01']);

const data = result.rows;
```

#### INSERT Queries

**Before**:
```typescript
const { data, error } = await supabase
  .from('users')
  .insert({
    email: 'user@example.com',
    username: 'newuser',
  })
  .select()
  .single();
```

**After**:
```typescript
const result = await pool.query(`
  INSERT INTO users (email, username)
  VALUES ($1, $2)
  RETURNING *
`, ['user@example.com', 'newuser']);

const data = result.rows[0];
```

#### UPDATE Queries

**Before**:
```typescript
const { data, error } = await supabase
  .from('users')
  .update({ last_login_at: new Date() })
  .eq('id', userId)
  .select()
  .single();
```

**After**:
```typescript
const result = await pool.query(`
  UPDATE users
  SET last_login_at = $1, updated_at = NOW()
  WHERE id = $2
  RETURNING *
`, [new Date(), userId]);

const data = result.rows[0];
```

#### DELETE Queries

**Before**:
```typescript
const { error } = await supabase
  .from('users')
  .delete()
  .eq('id', userId);
```

**After**:
```typescript
await pool.query(
  'DELETE FROM users WHERE id = $1',
  [userId]
);
```

### Step 4: Update Error Handling

**Before**:
```typescript
const { data, error } = await supabase
  .from('users')
  .select('*');

if (error) {
  console.error('Supabase error:', error.message);
  return null;
}
```

**After**:
```typescript
try {
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
} catch (error) {
  console.error('Database error:', error);
  throw error; // Or handle appropriately
}
```

### Step 5: Update Tests

**Before**:
```typescript
import { createTestDatabase } from '../config/database';

describe('UserRepository', () => {
  let db: SupabaseDatabase;

  beforeAll(() => {
    db = createTestDatabase();
  });

  it('should find user by id', async () => {
    const repo = new UserRepository(db);
    // Test code
  });
});
```

**After**:
```typescript
import { getPool, shutdownPool } from '../config/database.config';
import { Pool } from 'pg';

describe('UserRepository', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = getPool();
  });

  afterAll(async () => {
    await shutdownPool(); // Clean shutdown
  });

  it('should find user by id', async () => {
    const repo = new UserRepository(pool);
    // Test code
  });
});
```

---

## Common Patterns

### Pattern 1: Single Query

**Before**:
```typescript
const { data, error } = await supabase
  .from('users')
  .select('count')
  .single();
```

**After**:
```typescript
const result = await pool.query(
  'SELECT COUNT(*) as count FROM users'
);
const count = parseInt(result.rows[0].count, 10);
```

### Pattern 2: Multiple Queries (Transaction)

**Before**:
```typescript
// Supabase doesn't support transactions easily
```

**After**:
```typescript
const client = await pool.connect();

try {
  await client.query('BEGIN');

  await client.query(
    'INSERT INTO users (email) VALUES ($1)',
    ['user@example.com']
  );

  await client.query(
    'INSERT INTO profiles (user_id, bio) VALUES ($1, $2)',
    [userId, 'My bio']
  );

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release(); // CRITICAL: Always release!
}
```

### Pattern 3: Conditional Queries

**Before**:
```typescript
let query = supabase.from('users').select('*');

if (role) {
  query = query.eq('role', role);
}

if (search) {
  query = query.ilike('username', `%${search}%`);
}

const { data, error } = await query;
```

**After**:
```typescript
const conditions: string[] = [];
const values: any[] = [];
let paramCount = 0;

if (role) {
  paramCount++;
  conditions.push(`role = $${paramCount}`);
  values.push(role);
}

if (search) {
  paramCount++;
  conditions.push(`username ILIKE $${paramCount}`);
  values.push(`%${search}%`);
}

const whereClause = conditions.length > 0
  ? `WHERE ${conditions.join(' AND ')}`
  : '';

const result = await pool.query(
  `SELECT * FROM users ${whereClause}`,
  values
);

const data = result.rows;
```

### Pattern 4: Realtime Subscriptions

**Note**: Connection pool doesn't support realtime subscriptions. Keep using Supabase client for this:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Use Supabase for realtime
supabase
  .channel('users')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, (payload) => {
    console.log('New user:', payload.new);
  })
  .subscribe();

// Use connection pool for queries
import { getPool } from './config/database.config';
const pool = getPool();
const result = await pool.query('SELECT * FROM users');
```

---

## Dual-Mode Strategy (Gradual Migration)

You can migrate gradually by supporting both Supabase and connection pool:

```typescript
export class UserRepository {
  private pool?: Pool;
  private supabase?: SupabaseDatabase;

  constructor(options?: { pool?: Pool; supabase?: SupabaseDatabase }) {
    this.pool = options?.pool;
    this.supabase = options?.supabase;

    // Default to pool if neither provided
    if (!this.pool && !this.supabase) {
      this.pool = getPool();
    }
  }

  async findById(id: string) {
    if (this.pool) {
      // New: Use connection pool
      const result = await this.pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    } else {
      // Legacy: Use Supabase
      const { data, error } = await this.supabase!.client
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    }
  }
}
```

---

## Verification Checklist

After migration, verify:

- [ ] All queries converted to SQL
- [ ] Parameterized queries used (no string concatenation)
- [ ] Error handling updated (try-catch)
- [ ] Tests passing
- [ ] Health endpoints accessible
- [ ] Pool metrics showing healthy status
- [ ] No connection leaks (monitor idle connections)
- [ ] Performance equal or better than before

---

## Rollback Plan

If you need to rollback:

1. **Keep Supabase client imports**:
   ```typescript
   import { SupabaseDatabase } from '../config/database';
   ```

2. **Switch back in repositories**:
   ```typescript
   // Change this
   private pool = getPool();

   // Back to this
   private db = getDatabase();
   ```

3. **Revert environment variables** (remove DB_HOST, DB_PORT, etc.)

4. **Deploy previous version** with `git revert`

---

## Performance Comparison

### Before (Supabase Client)
- Connection limit: ~100 concurrent
- Each request creates new connection
- No connection reuse
- Limited monitoring

### After (Connection Pool)
- Connection limit: 1,000+ concurrent
- Connections reused from pool
- Automatic connection management
- Real-time monitoring and health checks

---

## FAQ

**Q: Do I have to migrate all at once?**
A: No! Use the dual-mode strategy to migrate gradually.

**Q: Will this break my existing Supabase features?**
A: No. You can still use Supabase for auth, storage, and realtime. Only database queries change.

**Q: What about Row Level Security (RLS)?**
A: RLS still works! Make sure your connection string has proper permissions.

**Q: How do I migrate complex Supabase queries?**
A: Break them down into SQL components. Check [PostgreSQL documentation](https://www.postgresql.org/docs/).

**Q: Can I use both Supabase and connection pool?**
A: Yes! Use connection pool for high-performance queries and Supabase for auth/realtime.

---

## Need Help?

1. Review the [Connection Pooling Guide](./CONNECTION_POOLING_GUIDE.md)
2. Check [Troubleshooting section](./CONNECTION_POOLING_GUIDE.md#troubleshooting)
3. Run health checks: `curl http://localhost:3001/health/db-pool`
4. Open an issue with logs and error messages

---

**Last Updated**: 2025-10-29
**Story**: US-004 - Implement Database Connection Pooling
