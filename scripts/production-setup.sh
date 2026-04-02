#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Production Setup Script
# Automates the 3 manual deployment steps for production readiness.
#
# Usage: ./scripts/production-setup.sh [--rotate] [--migrate] [--encrypt] [--all]
#   --rotate   Generate new secrets and update GitHub Actions
#   --migrate  Apply pending Supabase migrations to production
#   --encrypt  Run NOSTR key encryption migration
#   --all      Run all three steps in order
#
# Requires: gh CLI authenticated, supabase CLI linked
# =============================================================================

SUPABASE_PROJECT_REF="pgxpjiarfmsammhwesfx"

rotate_secrets() {
  echo "🔑 Step 1: Secret Generation & GitHub Sync"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Generate new secrets
  NEW_JWT=$(openssl rand -base64 64 | tr -d '\n')
  NEW_REFRESH=$(openssl rand -base64 64 | tr -d '\n')
  NEW_WEBHOOK=$(openssl rand -hex 32)

  echo "  Generated JWT_SECRET (${#NEW_JWT} chars)"
  echo "  Generated JWT_REFRESH_SECRET (${#NEW_REFRESH} chars)"
  echo "  Generated WEBHOOK_SECRET (${#NEW_WEBHOOK} chars)"

  # Push to GitHub Actions
  gh secret set JWT_SECRET --body "$NEW_JWT" && echo "  ✅ JWT_SECRET → GitHub"
  gh secret set JWT_REFRESH_SECRET --body "$NEW_REFRESH" && echo "  ✅ JWT_REFRESH_SECRET → GitHub"
  gh secret set WEBHOOK_SECRET --body "$NEW_WEBHOOK" && echo "  ✅ WEBHOOK_SECRET → GitHub"

  # Sync Supabase keys if access token available
  if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
    KEYS=$(curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/api-keys" 2>/dev/null || echo "[]")

    ANON=$(echo "$KEYS" | jq -r '.[] | select(.name == "anon") | .api_key // empty')
    SERVICE=$(echo "$KEYS" | jq -r '.[] | select(.name == "service_role") | .api_key // empty')

    [ -n "$ANON" ] && gh secret set SUPABASE_ANON_KEY --body "$ANON" && gh secret set VITE_SUPABASE_ANON_KEY --body "$ANON" && echo "  ✅ SUPABASE_ANON_KEY → GitHub"
    [ -n "$SERVICE" ] && gh secret set SUPABASE_SERVICE_ROLE_KEY --body "$SERVICE" && echo "  ✅ SUPABASE_SERVICE_ROLE_KEY → GitHub"
  else
    echo "  ⚠️  Set SUPABASE_ACCESS_TOKEN to auto-sync Supabase keys"
  fi

  # Store new JWT for the encryption step
  export ENCRYPTION_KEY="$NEW_JWT"

  echo ""
  echo "  ⚠️  All active user sessions are now invalidated."
  echo ""
}

apply_migrations() {
  echo "📦 Step 2: Apply Supabase Migrations"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if ! command -v supabase &>/dev/null; then
    echo "  ❌ supabase CLI not found. Install: npm i -g supabase"
    return 1
  fi

  # Check link status
  if ! supabase db push --linked --dry-run 2>/dev/null; then
    echo "  Linking to project $SUPABASE_PROJECT_REF..."
    supabase link --project-ref "$SUPABASE_PROJECT_REF"
  fi

  echo "  Pushing migrations..."
  supabase db push --linked
  echo "  ✅ Migrations applied"
  echo ""
}

encrypt_nostr_keys() {
  echo "🔐 Step 3: Encrypt NOSTR Private Keys"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ -z "${ENCRYPTION_KEY:-}" ]; then
    echo "  ⚠️  ENCRYPTION_KEY not set. Using NOSTR_KEY_ENCRYPTION_KEY from environment."
    if [ -z "${NOSTR_KEY_ENCRYPTION_KEY:-}" ]; then
      echo "  ❌ Neither ENCRYPTION_KEY nor NOSTR_KEY_ENCRYPTION_KEY is set."
      echo "     Run --rotate first, or: export NOSTR_KEY_ENCRYPTION_KEY=\$(openssl rand -hex 32)"
      return 1
    fi
    export ENCRYPTION_KEY="$NOSTR_KEY_ENCRYPTION_KEY"
  fi

  echo "  Running encryption migration..."
  NOSTR_KEY_ENCRYPTION_KEY="$ENCRYPTION_KEY" npx ts-node packages/backend/src/scripts/encrypt-nostr-keys-migration.ts
  echo "  ✅ NOSTR keys encrypted"

  # Store encryption key in GitHub secrets for runtime decryption
  gh secret set NOSTR_KEY_ENCRYPTION_KEY --body "$ENCRYPTION_KEY" && echo "  ✅ NOSTR_KEY_ENCRYPTION_KEY → GitHub"
  echo ""
}

show_usage() {
  echo "Usage: $0 [--rotate] [--migrate] [--encrypt] [--all]"
  echo ""
  echo "  --rotate   Generate new secrets and update GitHub Actions"
  echo "  --migrate  Apply pending Supabase migrations to production"
  echo "  --encrypt  Run NOSTR key encryption migration"
  echo "  --all      Run all three steps in order (recommended)"
  echo ""
  echo "Prerequisites:"
  echo "  - gh CLI: authenticated (gh auth status)"
  echo "  - supabase CLI: installed (npm i -g supabase)"
  echo "  - Optional: SUPABASE_ACCESS_TOKEN for auto key sync"
}

# --- Main ---
if [ $# -eq 0 ]; then
  show_usage
  exit 0
fi

for arg in "$@"; do
  case "$arg" in
    --rotate)  rotate_secrets ;;
    --migrate) apply_migrations ;;
    --encrypt) encrypt_nostr_keys ;;
    --all)
      rotate_secrets
      apply_migrations
      encrypt_nostr_keys
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "✅ Production setup complete!"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
      echo "Next: Deploy to apply new secrets to running services."
      ;;
    --help|-h) show_usage ;;
    *) echo "Unknown option: $arg"; show_usage; exit 1 ;;
  esac
done
