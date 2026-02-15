# Secrets Management Guide

## Critical Security Requirements

**NEVER commit real secrets to version control**. This includes:
- API keys (Supabase, GitHub, LNBits, etc.)
- Database credentials
- JWT secrets
- Private keys
- Access tokens
- Webhook secrets

## Environment Setup

### 1. Create Local Environment Files

```bash
# Frontend
cp packages/frontend/.env.example packages/frontend/.env

# Backend
cp packages/backend/.env.example packages/backend/.env
```

### 2. Obtain Real Credentials

- **Supabase**: Get from [Supabase Dashboard](https://app.supabase.io)
- **GitHub Token**: Generate at [GitHub Settings](https://github.com/settings/tokens)
- **LNBits**: Get from [LNBits Dashboard](https://legend.lnbits.com)

### 3. Generate Secure Secrets

```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate Webhook Secret
openssl rand -base64 32

# Generate API Key
openssl rand -hex 32
```

## Security Best Practices

### Pre-Commit Protection

Our pre-commit hooks automatically scan for exposed secrets using:
- **secretlint**: Detects common secret patterns
- **Custom patterns**: Specific to our tech stack

If the pre-commit hook detects secrets, it will:
1. Block the commit
2. Show which files contain secrets
3. Provide instructions to fix

### .gitignore Configuration

The `.gitignore` file is configured to exclude:
```
.env
.env.*
!.env.example
!.env.*.example
*.pem
*.key
*.cert
```

### Secret Rotation Schedule

| Secret Type | Rotation Frequency | Priority |
|-------------|-------------------|----------|
| Database passwords | 90 days | Critical |
| JWT secrets | 180 days | High |
| API keys | 365 days | Medium |
| Webhook secrets | As needed | Low |

## Production Secrets Management

### AWS Secrets Manager (Recommended)

For production deployments, use AWS Secrets Manager:

```bash
# Store secret
aws secretsmanager create-secret \
  --name sovren/production/database \
  --secret-string '{"url":"postgresql://..."}'

# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id sovren/production/database
```

### GitHub Secrets (CI/CD)

For GitHub Actions workflows:

1. Go to Settings → Secrets → Actions
2. Add repository secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `JWT_SECRET`
   - `GITHUB_TOKEN` (auto-provided)

## Emergency Procedures

### If Secrets Are Exposed

1. **Immediately rotate** all exposed credentials
2. **Clean git history** using BFG or filter-branch
3. **Audit access logs** for unauthorized use
4. **Notify team** about credential changes
5. **Update all deployments** with new credentials

### Cleaning Git History

```bash
# Using git filter-branch
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch \
  --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/secret-file' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team)
git push origin --force --all
git push origin --force --tags
```

## Verification Commands

### Check for exposed secrets
```bash
# Run secretlint scan
npx secretlint "**/*" --secretlintignore .gitignore

# Search git history
git log --all --full-history -- "*.env*"

# Check current tracked files
git ls-files | grep -E "\.env"
```

### Verify .gitignore
```bash
# Test if file would be ignored
git check-ignore packages/frontend/.env
```

## Development Workflow

1. **Clone repository**
2. **Copy .env.example files** to .env
3. **Fill in real values** from secure storage
4. **Never modify .env.example** with real values
5. **Run verification** before committing

## Team Guidelines

- Store production secrets in password manager
- Share development secrets via secure channels only
- Rotate credentials after team member leaves
- Document which services use which credentials
- Keep audit log of secret rotations

## Monitoring & Alerts

Set up monitoring for:
- Failed authentication attempts
- Unusual API usage patterns
- Database connection anomalies
- Expired credentials

## References

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12 Factor App - Config](https://12factor.net/config)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)