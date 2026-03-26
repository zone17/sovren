# Runbook: Lightning Node Unreachable

**Alert name:** `lightning_node_unreachable`
**Severity:** P1 — Direct revenue impact; payments blocked
**Service:** `sovren-api` / `LightningPaymentService`
**On-call rotation:** Payments squad

---

## Symptoms

- `POST /api/v1/payments/invoices` returns `503` with `code: LIGHTNING_UNAVAILABLE`
- `GET /api/v1/payments/invoices/:id` stuck in `pending` indefinitely
- Prometheus alert: `lightning_grpc_connection_errors_total` rising
- Log pattern: `Failed to initialize LightningPaymentService` appearing on startup or spike of `lightning payment failed` errors at runtime
- Subscription tier creation succeeds but payment generation fails silently

---

## Investigation Steps

### 1. Confirm the node is unreachable

```bash
# Check LND/CLN gRPC connectivity from the backend container
docker exec sovren-api grpc_cli call <NODE_HOST>:10009 lnrpc.Lightning/GetInfo ''

# Or using lncli if available
lncli --rpcserver=<NODE_HOST>:10009 getinfo
```

Expected: node alias, block height, synced to chain.
If timeout or `UNAVAILABLE`: node is down or network is blocked.

### 2. Check backend logs for connection errors

```bash
# Last 100 error lines from sovren-api
docker logs sovren-api --tail 200 | grep -E "(lightning|LightningPaymentService|grpc)"

# Or via Loki (if configured)
logcli query '{service="sovren-api"} |= "LightningPaymentService"' --limit=50
```

### 3. Verify network connectivity from backend to node

```bash
# Test TCP connectivity on gRPC port
docker exec sovren-api nc -zv <NODE_HOST> 10009

# Test TLS certificate validity
openssl s_client -connect <NODE_HOST>:10009 -servername <NODE_HOST>
```

### 4. Check node process health

```bash
# If LND runs in a Docker container
docker ps | grep lnd
docker logs lnd --tail 100

# Check disk space (LND requires space for DB + channel backups)
df -h /var/lib/lnd
```

### 5. Verify environment variables in backend

```bash
docker exec sovren-api env | grep -E "(LND|LIGHTNING|GRPC)"
# Expected: LND_HOST, LND_PORT, LND_MACAROON_PATH or LND_ADMIN_MACAROON_HEX, LND_TLS_CERT_PATH
```

### 6. Check wallet lock state

LND auto-locks the wallet on restart. A locked wallet blocks all payment operations.

```bash
lncli state
# Returns: LOCKED, UNLOCKED, or RPC_ACTIVE
```

If locked:
```bash
lncli unlock
# Enter wallet password when prompted
```

---

## Common Causes

| Cause | Signal | Fix |
|-------|--------|-----|
| LND process crashed | Container restart count > 0 in `docker ps` | Restart LND container; check OOM in dmesg |
| Disk full on node host | `df -h` shows 100% on LND data volume | Clear old logs/backups; extend volume |
| TLS certificate expired | `openssl` shows expired cert | Regenerate TLS cert in LND data dir |
| Macaroon path wrong / file missing | `permission denied` in backend logs | Re-mount correct macaroon; check env vars |
| Firewall blocking gRPC port | TCP connection times out | Open port 10009 between backend and node |
| Wallet locked after restart | `lncli state` returns LOCKED | Unlock wallet with `lncli unlock` |
| Network partition between backend and node | Intermittent timeouts | Check VPC routing; verify security groups |
| LND out of sync (IBD) | `synced_to_chain: false` in `lncli getinfo` | Wait for IBD to complete; check bitcoind |

---

## Mitigation / Recovery Steps

1. **If LND container is down:** `docker start lnd` or `systemctl start lnd`. Monitor logs for startup errors.
2. **If wallet locked:** unlock via `lncli unlock` or REST `POST /v1/unlockwallet`.
3. **If TLS cert expired:** Delete `tls.cert` and `tls.key` from LND data dir; restart LND — it regenerates the cert. Update backend env vars with the new cert path.
4. **If env vars wrong:** Update deployment secrets, redeploy `sovren-api` (`gh workflow run deploy.yml`).
5. **After recovery:** Verify invoice generation with a test payment:
   ```bash
   curl -X POST https://api-staging.sovren.dev/api/v1/payments/invoices \
     -H "Authorization: Bearer $TEST_JWT" \
     -d '{"contentId":"test","amountSats":1000}'
   ```

---

## Escalation

| Condition | Escalate to |
|-----------|-------------|
| Node is reachable but gRPC errors persist | Payments squad lead + LND version check |
| Node disk full and cannot be extended | Infrastructure engineer (storage expansion) |
| LND database corruption suspected | Senior infra + LND channel.db backup restore |
| Prolonged outage (> 15 min, revenue blocked) | Engineering manager + incident channel |

**Incident channel:** `#incidents` in Slack
**PagerDuty escalation path:** Payments On-Call → Payments Lead → Engineering Manager
