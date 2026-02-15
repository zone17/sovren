---
status: pending
priority: p3
issue_id: '035'
tags: [code-review, security, docker, vault]
dependencies: []
---

# Docker/Vault Security Hardening

## Problem Statement

Several security configuration issues in Docker and Vault:

1. **Docker ports exposed to all interfaces** (`docker-compose.secure.yml:167-168`): PostgreSQL 5432 and Redis 6379 bound to `0.0.0.0` despite other hardening.

2. **Redis health check uses INCR** (`docker-compose.secure.yml:248`): `redis-cli --raw incr ping` is a write op that modifies state. Also does not supply password despite `--requirepass` being set.

3. **Vault TLS disabled** (`setup-vault.sh:83-85`): Production Vault config has `tls_disable = 1` bound to `0.0.0.0:8200`.

4. **Vault init keys saved unencrypted** (`setup-vault.sh:143-146`): Single key share with threshold of 1, saved to disk in plaintext JSON.

5. **Docker ICC disabled** (`docker-compose.secure.yml:324`): `enable_icc: 'false'` prevents all container communication on the bridge network, which would break the application.

6. **CSP report endpoint logs unsanitized input** (`security-headers.ts:1020-1039`).

## Findings

- **security-sentinel**: MEDIUM-03 through MEDIUM-07, LOW-04

## Proposed Solutions

1. Bind ports to `127.0.0.1:` only
2. Fix Redis health check: `redis-cli -a ${REDIS_PASSWORD} ping`
3. Enable Vault TLS or bind to localhost
4. Use 3 key shares with threshold 2
5. Enable ICC or use proper Docker networking
6. Validate CSP report body schema before logging

**Effort**: Medium | **Risk**: Low

## Acceptance Criteria

- [ ] No database/cache ports exposed to all interfaces
- [ ] Redis health check uses PING with auth
- [ ] Vault not listening on 0.0.0.0 without TLS
