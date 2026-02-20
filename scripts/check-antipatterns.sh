#!/bin/bash
# Anti-pattern scanner for Sovren pre-commit hook
# Scans STAGED source files only (excludes tests). Runs in <1 second.
# See: docs/solutions/PREVENTION_CODE_PATTERNS.md

set -e

STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep '\.ts$' || true)
STAGED_SQL=$(git diff --cached --name-only --diff-filter=ACM | grep '\.sql$' || true)

# Exclude test files from TypeScript checks (legitimate as any usage in mocks)
STAGED_TS_SRC=$(echo "$STAGED_TS" | grep -v '__tests__\|\.test\.ts\|\.spec\.ts' || true)

ROUTE_FILES=$(echo "$STAGED_TS_SRC" | grep -E 'routes/' || true)
ERRORS=0

# Check 1: Unsafe `any` types in source TypeScript files
# Catches: as any, : any, Promise<any>, Promise<any[]>, Array<any>
if [ -n "$STAGED_TS_SRC" ]; then
  MATCHES=$(echo "$STAGED_TS_SRC" | xargs grep -HnE '(\bas\s+any\b|:\s*any\b|<any>|<any\[)' 2>/dev/null \
    | grep -v '^\s*//' || true)
  if [ -n "$MATCHES" ]; then
    echo "⚠️  Unsafe 'any' type detected (use proper types):"
    echo "$MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 2: FK references without ON DELETE clause
if [ -n "$STAGED_SQL" ]; then
  MATCHES=$(echo "$STAGED_SQL" | xargs grep -Hn 'REFERENCES' 2>/dev/null \
    | grep -v 'ON DELETE' || true)
  if [ -n "$MATCHES" ]; then
    echo "⚠️  FK without ON DELETE clause (add RESTRICT or CASCADE):"
    echo "$MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 3: Route files using req.body without Zod validation
if [ -n "$ROUTE_FILES" ]; then
  for f in $ROUTE_FILES; do
    HAS_BODY=$(grep -c 'req\.body' "$f" 2>/dev/null | head -1 || echo 0)
    HAS_VALIDATE=$(grep -cE 'validateRequest|zodValidate|\bvalidate\b|\.safeParse|\.parse\(' "$f" 2>/dev/null | head -1 || echo 0)
    if [ "${HAS_BODY:-0}" -gt 0 ] && [ "${HAS_VALIDATE:-0}" -eq 0 ]; then
      echo "⚠️  $f: Uses req.body without Zod validation"
      ERRORS=$((ERRORS + 1))
    fi
  done
fi

# Check 4: Mutation routes without rate limiter
if [ -n "$ROUTE_FILES" ]; then
  for f in $ROUTE_FILES; do
    HAS_MUTATION=$(grep -cE '\.(post|put|delete)\(' "$f" 2>/dev/null | head -1 || echo 0)
    HAS_LIMITER=$(grep -cE 'rateLimiter|RateLimiter' "$f" 2>/dev/null | head -1 || echo 0)
    if [ "${HAS_MUTATION:-0}" -gt 0 ] && [ "${HAS_LIMITER:-0}" -eq 0 ]; then
      echo "⚠️  $f: Mutation routes without rate limiter"
      ERRORS=$((ERRORS + 1))
    fi
  done
fi

# Check 5: Unbounded queries — .findMany() / .find({ without take or limit
# Per-file check: if file has .findMany( but no take/limit nearby, flag it
SERVICE_FILES=$(echo "$STAGED_TS_SRC" | grep -E 'services/|repositories/' || true)
if [ -n "$SERVICE_FILES" ]; then
  for f in $SERVICE_FILES; do
    HAS_FINDMANY=$(grep -cE '\.findMany\(|\.find\(\{' "$f" 2>/dev/null | head -1 || echo 0)
    HAS_LIMIT=$(grep -cE '\btake\b|\blimit\b' "$f" 2>/dev/null | head -1 || echo 0)
    if [ "${HAS_FINDMANY:-0}" -gt 0 ] && [ "${HAS_LIMIT:-0}" -eq 0 ]; then
      echo "⚠️  $f: Unbounded query (.findMany/.find without take/limit)"
      ERRORS=$((ERRORS + 1))
    fi
  done
fi

# Check 6: Auth bypass — route handler without auth middleware
# Excludes: /health, /metrics, /ready, /live endpoints (legitimately public)
# Excludes: auth routes (challenge, authenticate — public by design)
if [ -n "$ROUTE_FILES" ]; then
  for f in $ROUTE_FILES; do
    # Skip auth route file itself (login/challenge endpoints are public)
    case "$f" in *routes/auth.ts|*routes/auth/*) continue ;; esac
    UNPROTECTED=$(grep -nE 'router\.(get|post|put|delete|patch)\(' "$f" 2>/dev/null \
      | grep -vE 'authenticate|optionalAuth|authRateLimit|requireAuth' \
      | grep -vE "'/health'|'/metrics'|'/ready'|'/live'|'/status'" || true)
    if [ -n "$UNPROTECTED" ]; then
      echo "⚠️  $f: Route without auth middleware:"
      echo "$UNPROTECTED"
      ERRORS=$((ERRORS + 1))
    fi
  done
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Found $ERRORS anti-pattern(s). Fix before committing."
  echo "Patterns: docs/solutions/PREVENTION_CODE_PATTERNS.md"
  echo "Bypass (emergencies only): git commit --no-verify"
  exit 1
fi
