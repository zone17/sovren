---
status: pending
priority: p2
issue_id: '202'
tags: [code-review, pr-85, architecture]
---

# Encryption Key Bypasses SecretsService

## Problem Statement

crypto.ts getEncryptionKey() reads process.env.PLATFORM_TOKEN_ENCRYPTION_KEY directly instead of using SecretsService through DI. Inconsistent with the DI pattern used everywhere else.

## Findings

- **File**: `packages/backend/src/services/distribution/crypto.ts`
- `getEncryptionKey()` accesses `process.env.PLATFORM_TOKEN_ENCRYPTION_KEY` directly
- The rest of the application uses `SecretsService` (injected via DI container) for accessing secrets and environment variables
- This bypasses any secret rotation, validation, or centralized error handling that SecretsService provides
- Makes the crypto module harder to test (requires setting env vars instead of mocking SecretsService)
- If SecretsService is later updated to fetch secrets from a vault (e.g., AWS Secrets Manager), crypto.ts will still read from env vars

## Proposed Solutions

1. Refactor crypto functions to accept the encryption key as a parameter, injected by the caller from SecretsService. This keeps crypto.ts pure and testable.
2. Convert crypto.ts into a CryptoService class registered in the DI container, with SecretsService injected via constructor.

## Acceptance Criteria

- [ ] crypto.ts no longer reads process.env directly
- [ ] Encryption key is sourced from SecretsService (either via DI or parameter injection)
- [ ] Existing encrypt/decrypt functionality is unchanged
- [ ] Unit tests can mock the encryption key without setting environment variables
