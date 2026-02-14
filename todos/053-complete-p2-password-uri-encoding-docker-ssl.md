---
status: pending
priority: p2
issue_id: '053'
tags: [code-review, data-integrity, docker, configuration]
dependencies: []
---

# Password URI Encoding and Docker SSL Config

## Problem Statement

Two critical configuration issues: (1) `getConnectionString` and `updateLocalEnv` interpolate database passwords directly into PostgreSQL connection strings without URI encoding, breaking connections when passwords contain URI delimiter characters (`@`, `/`, `:`, `?`, `#`); (2) Docker docker-compose.secure.yml mounts postgresql.conf, pg_hba.conf, and redis.conf that don't exist in the repository, causing container startup failures.

## Findings

**Location**:

- `config/database-pool.config.ts:282`
- `scripts/automated-supabase-rotation.ts:534,237`
- `docker/security/docker-compose.secure.yml:158-159,224`

**Issue 1: Unencoded Password Characters**:

```typescript
// BROKEN - password contains @
const password = 'p@ssw0rd!#xyz';
const connString = `postgresql://user:${password}@host:5432/db`;
// Results in: postgresql://user:p@ssw0rd!#xyz@host:5432/db
//                                 ^ parsed as user@host separator
```

**Characters That Break URIs**:

- `@` - Interpreted as user@host separator
- `/` - Interpreted as path separator
- `:` - Interpreted as port separator
- `?` - Interpreted as query string start
- `#` - Interpreted as fragment identifier
- `%` - Interpreted as encoding prefix

**Generated Password Alphabet**:

- Current password generation includes all special chars
- High probability of generating URI-breaking passwords
- Connection failures appear random based on password content

**Issue 2: Missing Docker Config Files**:

```yaml
# docker-compose.secure.yml
volumes:
  - ./config/postgresql.conf:/etc/postgresql/postgresql.conf # Does not exist
  - ./config/pg_hba.conf:/var/lib/postgresql/data/pg_hba.conf # Does not exist
  - ./config/redis.conf:/usr/local/etc/redis/redis.conf # Does not exist
```

## Proposed Solutions

1. **URI Encode Passwords** (Required):

   ```typescript
   function getConnectionString(host, port, user, password, database) {
     const encodedPassword = encodeURIComponent(password);
     return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
   }
   ```

2. **Create Missing Config Files**:

   - Option A: Create minimal postgresql.conf, pg_hba.conf, redis.conf
   - Option B: Remove volume mounts, use container defaults
   - Option C: Use environment variables instead of config files

3. **Restrict Password Alphabet**:
   - Remove URI-special characters from password generation
   - Use only alphanumeric + safe special chars (!-\_.)
   - Still requires encoding for defense-in-depth

## Technical Details

**Files Requiring Changes**:

1. **config/database-pool.config.ts:282**:

   ```typescript
   // Before
   return `postgresql://${user}:${password}@${host}:${port}/${database}`;

   // After
   return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
   ```

2. **scripts/automated-supabase-rotation.ts:534**:

   ```typescript
   // Before
   DATABASE_URL=postgresql://${user}:${newPassword}@${host}:${port}/${database}

   // After
   DATABASE_URL=postgresql://${user}:${encodeURIComponent(newPassword)}@${host}:${port}/${database}
   ```

3. **scripts/automated-supabase-rotation.ts:237** (similar fix)

4. **Docker Config Files** - Create or remove:
   - `docker/config/postgresql.conf`
   - `docker/config/pg_hba.conf`
   - `docker/config/redis.conf`

**Test Cases**:

```typescript
testPasswords = [
  'simple123', // Baseline
  'p@ssw0rd', // @ character
  'pass/word', // / character
  'p:a:s:s', // : character
  'pass?word', // ? character
  'pass#word', // # character
  'p@ss/w:o?r#d', // Multiple special chars
];

for (const password of testPasswords) {
  const connString = getConnectionString('localhost', 5432, 'user', password, 'db');
  // Verify connection succeeds
}
```

## Acceptance Criteria

- [ ] All connection string builders use `encodeURIComponent(password)`
- [ ] Passwords with URI-special characters work correctly
- [ ] All automated rotation scripts use encoded passwords
- [ ] Docker config files exist or mounts removed
- [ ] docker-compose.secure.yml starts successfully
- [ ] Unit tests verify encoding for problematic characters
- [ ] Integration tests use passwords with special chars
- [ ] Password generation documented (alphabet, length, encoding)
- [ ] No connection failures due to password characters
- [ ] Database connections succeed across all environments

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- PostgreSQL connection string documentation
- URI encoding specification (RFC 3986)
- Docker Compose volume mount documentation
