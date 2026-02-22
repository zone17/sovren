#!/bin/bash
# Anti-pattern scanner for Sovren pre-commit hook
# Scans STAGED source files only (excludes tests). Runs in <1 second.
# See: docs/solutions/PREVENTION_CODE_PATTERNS.md

set -e

STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep '\.ts$' || true)
STAGED_SQL=$(git diff --cached --name-only --diff-filter=ACM | grep '\.sql$' || true)

# Exclude test files and test utilities from TypeScript checks (legitimate as any usage in mocks)
STAGED_TS_SRC=$(echo "$STAGED_TS" | grep -vE '__tests__|\.test\.ts|\.spec\.ts|test-utils/|vitest.*setup' || true)

ROUTE_FILES=$(echo "$STAGED_TS_SRC" | grep -E 'routes/' || true)
ERRORS=0

# Check 1a: Unsafe `any` types in source TypeScript files
# Catches: as any, : any, <any>, <any[, any[], Record<string, any>, Promise<any>,
#          (...args: any), <any,  (generic position)
if [ -n "$STAGED_TS_SRC" ]; then
  MATCHES=""
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    MATCHES+=$(grep -HnE '(\bas\s+any\b|:\s*any\b|<any>|<any,|any\[\])' "$f" 2>/dev/null || true)$'\n'
  done <<< "$STAGED_TS_SRC"
  MATCHES=$(echo "$MATCHES" | grep -v '^\s*//' | sed '/^$/d' || true)
  if [ -n "$MATCHES" ]; then
    echo "⚠️  Unsafe 'any' type detected (use proper types):"
    echo "$MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 1b: console.log in source TypeScript files
# Legitimate logging should use the logger service, not console.log
# Excludes: frontend (no logger service), env-validation.ts, logger.ts
if [ -n "$STAGED_TS_SRC" ]; then
  MATCHES=""
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    echo "$f" | grep -q 'packages/frontend/' && continue
    MATCHES+=$(grep -HnE '\bconsole\.(log|debug|info|warn|error)\(' "$f" 2>/dev/null || true)$'\n'
  done <<< "$STAGED_TS_SRC"
  MATCHES=$(echo "$MATCHES" | grep -v '^\s*//' \
    | grep -v 'env-validation\.ts' \
    | grep -v 'logger\.ts' \
    | sed '/^$/d' || true)
  if [ -n "$MATCHES" ]; then
    echo "⚠️  console.log detected in source (use logger service instead):"
    echo "$MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 1c: TODO/FIXME comments in newly-added lines only
# Scoped to new lines (git diff --cached) to avoid false positives on pre-existing TODOs
if [ -n "$STAGED_TS_SRC" ]; then
  DIFF_FILES=()
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    DIFF_FILES+=("$f")
  done <<< "$STAGED_TS_SRC"
  MATCHES=$(git diff --cached -U0 -- "${DIFF_FILES[@]}" 2>/dev/null \
    | grep -E '^\+' | grep -vF '+++' \
    | grep -Ei '\b(TODO|FIXME|HACK|XXX)\b' || true)
  if [ -n "$MATCHES" ]; then
    echo "⚠️  TODO/FIXME comment in newly-added lines (resolve before committing):"
    echo "$MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 1d: Hardcoded secrets/credentials in source files
# Catches common patterns: password=, secret=, apikey=, token= with inline values
# Excludes: test-utils (intentional test fixtures), setup files
if [ -n "$STAGED_TS_SRC" ]; then
  MATCHES=""
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    MATCHES+=$(grep -HnEi "(password|secret|api_?key|token)\s*[:=]\s*['\"][^'\"]{8,}" "$f" 2>/dev/null || true)$'\n'
  done <<< "$STAGED_TS_SRC"
  MATCHES=$(echo "$MATCHES" | grep -v '^\s*//' \
    | grep -v '\.env' \
    | grep -v 'process\.env' \
    | grep -v '\.test\.' \
    | grep -v 'example' \
    | grep -v 'placeholder' \
    | grep -v 'your-' \
    | grep -v 'test-utils/' \
    | grep -v 'setup\.ts' \
    | sed '/^$/d' || true)
  if [ -n "$MATCHES" ]; then
    echo "⚠️  Possible hardcoded secret detected (use environment variables):"
    echo "$MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 2: FK references without ON DELETE clause
if [ -n "$STAGED_SQL" ]; then
  MATCHES=""
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    MATCHES+=$(grep -Hn 'REFERENCES' "$f" 2>/dev/null || true)$'\n'
  done <<< "$STAGED_SQL"
  MATCHES=$(echo "$MATCHES" | grep -v 'ON DELETE' | sed '/^$/d' || true)
  if [ -n "$MATCHES" ]; then
    echo "⚠️  FK without ON DELETE clause (add RESTRICT or CASCADE):"
    echo "$MATCHES"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check 3: Route files using req.body without Zod validation
if [ -n "$ROUTE_FILES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    HAS_BODY=$(grep -c 'req\.body' "$f" 2>/dev/null | head -1 || echo 0)
    HAS_VALIDATE=$(grep -cE 'validateRequest|zodValidate|\bvalidate\b|\.safeParse|\.parse\(' "$f" 2>/dev/null | head -1 || echo 0)
    if [ "${HAS_BODY:-0}" -gt 0 ] && [ "${HAS_VALIDATE:-0}" -eq 0 ]; then
      echo "⚠️  $f: Uses req.body without Zod validation"
      ERRORS=$((ERRORS + 1))
    fi
  done <<< "$ROUTE_FILES"
fi

# Check 4: Mutation routes without rate limiter
if [ -n "$ROUTE_FILES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    HAS_MUTATION=$(grep -cE '\.(post|put|delete)\(' "$f" 2>/dev/null | head -1 || echo 0)
    HAS_LIMITER=$(grep -cE 'rateLimiter|RateLimiter' "$f" 2>/dev/null | head -1 || echo 0)
    if [ "${HAS_MUTATION:-0}" -gt 0 ] && [ "${HAS_LIMITER:-0}" -eq 0 ]; then
      echo "⚠️  $f: Mutation routes without rate limiter"
      ERRORS=$((ERRORS + 1))
    fi
  done <<< "$ROUTE_FILES"
fi

# Check 5: Unbounded queries — .findMany() / .find({ without take or limit
# Per-file check: if file has .findMany( but no take/limit nearby, flag it
SERVICE_FILES=$(echo "$STAGED_TS_SRC" | grep -E 'services/|repositories/' || true)
if [ -n "$SERVICE_FILES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    HAS_FINDMANY=$(grep -cE '\.findMany\(|\.find\(\{' "$f" 2>/dev/null | head -1 || echo 0)
    HAS_LIMIT=$(grep -cE '\btake\b|\blimit\b' "$f" 2>/dev/null | head -1 || echo 0)
    if [ "${HAS_FINDMANY:-0}" -gt 0 ] && [ "${HAS_LIMIT:-0}" -eq 0 ]; then
      echo "⚠️  $f: Unbounded query (.findMany/.find without take/limit)"
      ERRORS=$((ERRORS + 1))
    fi
  done <<< "$SERVICE_FILES"
fi

# Check 6: Auth bypass — route handler without auth middleware
# Handles multiline route definitions (middleware on subsequent lines)
# Excludes: /health, /metrics, /ready, /live endpoints (legitimately public)
# Excludes: auth routes (challenge, authenticate — public by design)
if [ -n "$ROUTE_FILES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    # Skip auth route file itself (login/challenge endpoints are public)
    case "$f" in *routes/auth.ts|*routes/auth/*) continue ;; esac
    UNPROTECTED=""
    while IFS= read -r line_num; do
      # Check 5-line window for auth middleware (handles multiline route defs)
      CONTEXT=$(sed -n "${line_num},$((line_num + 5))p" "$f")
      if ! echo "$CONTEXT" | grep -qE 'authenticate|optionalAuth|authRateLimit|requireAuth'; then
        if ! echo "$CONTEXT" | grep -qE "'/health'|'/metrics'|'/ready'|'/live'|'/status'"; then
          UNPROTECTED+="  ${line_num}: $(sed -n "${line_num}p" "$f")"$'\n'
        fi
      fi
    done < <(grep -nE 'router\.(get|post|put|delete|patch)\(' "$f" 2>/dev/null | cut -d: -f1)
    if [ -n "$UNPROTECTED" ]; then
      echo "⚠️  $f: Route without auth middleware:"
      echo "$UNPROTECTED"
      ERRORS=$((ERRORS + 1))
    fi
  done <<< "$ROUTE_FILES"
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Found $ERRORS anti-pattern(s). Fix before committing."
  echo "Patterns: docs/solutions/PREVENTION_CODE_PATTERNS.md"
  echo "Bypass (emergencies only): git commit --no-verify"
  exit 1
fi
