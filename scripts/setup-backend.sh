#!/usr/bin/env bash
# setup-backend.sh — Generate .env for packages/backend from .env.example
# Usage: ./scripts/setup-backend.sh
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/../packages/backend" && pwd)"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"
ENV_FILE="$BACKEND_DIR/.env"

echo "=== Sovren Backend Environment Setup ==="
echo ""

# --- Check .env.example exists ---
if [[ ! -f "$ENV_EXAMPLE" ]]; then
  echo "ERROR: $ENV_EXAMPLE not found. Cannot proceed."
  exit 1
fi

# --- Create .env from .env.example if it doesn't exist ---
if [[ -f "$ENV_FILE" ]]; then
  echo "INFO: $ENV_FILE already exists — skipping copy."
  echo "      Delete it and re-run this script to regenerate."
else
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "CREATED: $ENV_FILE from .env.example"
fi

# --- Generate secrets ---
JWT_SECRET=$(openssl rand -base64 48)
LNBITS_WEBHOOK_SECRET=$(openssl rand -base64 32)
PLATFORM_TOKEN_KEY=$(openssl rand -hex 32)
BYOK_KEY=$(openssl rand -hex 32)

echo ""
echo "=== Generated Secrets ==="
echo ""
echo "Add these to $ENV_FILE:"
echo ""
echo "  JWT_SECRET=$JWT_SECRET"
echo "  LNBITS_WEBHOOK_SECRET=$LNBITS_WEBHOOK_SECRET"
echo "  PLATFORM_TOKEN_ENCRYPTION_KEY=$PLATFORM_TOKEN_KEY"
echo "  BYOK_ENCRYPTION_KEY=$BYOK_KEY"
echo ""

# --- Check required env vars if .env exists ---
echo "=== Checking Required Variables ==="
REQUIRED_VARS=(
  "SUPABASE_URL"
  "SUPABASE_ANON_KEY"
  "JWT_SECRET"
  "PORT"
)

MISSING=0
while IFS= read -r line; do
  # Skip comments and blank lines
  [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
  KEY="${line%%=*}"
  VALUE="${line#*=}"
  for REQ in "${REQUIRED_VARS[@]}"; do
    if [[ "$KEY" == "$REQ" ]]; then
      if [[ -z "$VALUE" || "$VALUE" == *"your-"* || "$VALUE" == *"generate-"* ]]; then
        echo "  MISSING: $KEY (placeholder or empty)"
        MISSING=$((MISSING + 1))
      else
        echo "  OK:      $KEY"
      fi
    fi
  done
done < "$ENV_FILE"

echo ""
if [[ $MISSING -gt 0 ]]; then
  echo "WARNING: $MISSING required variable(s) need real values."
  echo "         Edit $ENV_FILE with the generated secrets above"
  echo "         and your Supabase credentials from https://app.supabase.io"
else
  echo "All required variables have values."
fi

echo ""
echo "=== Manual Steps ==="
echo "1. Copy the generated secrets above into $ENV_FILE"
echo "2. Get Supabase credentials from https://app.supabase.io"
echo "3. (Optional) Set up LNBits at https://legend.lnbits.com"
echo "4. Run: cd packages/backend && npm run dev"
echo ""
echo "Done."
