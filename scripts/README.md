# Sovren Tana Integration

**Elite project management integration. Single source of truth.**

## Setup (30 seconds)

```bash
# 1. Get Tana token (Settings → API)
export TANA_TOKEN="your_token"

# 2. Create project
node scripts/tana.js setup

# 3. Done. Check Tana: Projects → Sovren
```

## Usage

```bash
# Project status
node scripts/tana.js status

# Update progress
node scripts/tana.js update "Docker containers working"

# Sync development state
node scripts/tana.js sync
```

## What You Get

- **Clean Organization**: One project under Projects folder
- **Automatic Updates**: Git commits → Tana progress
- **Mobile Access**: Check status anywhere via Tana
- **Zero Maintenance**: Set it and forget it

## Git Hook (Optional)

Add to `.git/hooks/post-commit`:

```bash
#!/bin/sh
if [ -n "$TANA_TOKEN" ]; then
  node scripts/tana.js sync
fi
```

**That's it. Elite simplicity.**
