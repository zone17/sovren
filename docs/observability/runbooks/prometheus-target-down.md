# Runbook: PrometheusTargetDown

## Alert

- **PrometheusTargetDown** (critical): A Prometheus scrape target has been `down` for more than 2 minutes

## Symptoms

- Alert fires from `up == 0` for a given `job` and `instance` label pair
- Gaps in all metrics panels for the affected service in Grafana
- Prometheus UI (`/targets`) shows the target as `DOWN` with a red indicator
- `Last scrape error` field shows the failure reason

## Investigation Steps

### 1. Check the target status in Prometheus UI

Navigate to `http://<prometheus-host>:9090/targets` and find the failing target.
Note the `Last scrape error` message — it will be one of:
- `context deadline exceeded` → network timeout
- `connection refused` → service not running or wrong port
- `401 Unauthorized` → bearer token / auth issue
- `x509: certificate...` → TLS cert problem

### 2. Check bearer_token_file

If the scrape config uses `bearer_token_file`, verify the file exists and is readable:

```bash
# On the Prometheus host
ls -la /etc/prometheus/bearer_tokens/<service>.token
cat /etc/prometheus/bearer_tokens/<service>.token | head -c 20
```

If the file is missing or empty:
```bash
# Regenerate the token (service-specific — check deployment scripts)
./scripts/generate-scrape-token.sh <service> > /etc/prometheus/bearer_tokens/<service>.token
# Reload Prometheus config without restart
curl -X POST http://localhost:9090/-/reload
```

If using a Kubernetes secret:
```bash
kubectl get secret prometheus-scrape-token -o jsonpath='{.data.token}' | base64 -d
```

### 3. Verify network connectivity

```bash
# From the Prometheus host/pod, curl the /metrics endpoint directly
curl -v http://<target-host>:<port>/metrics

# If bearer token is required
TOKEN=$(cat /etc/prometheus/bearer_tokens/<service>.token)
curl -v -H "Authorization: Bearer $TOKEN" http://<target-host>:<port>/metrics
```

Expected: HTTP 200 with `# HELP` lines in the response body.

Common failures:
- `Connection refused` → service crashed or port mismatch; check `docker ps` or `kubectl get pods`
- `No route to host` → firewall or network policy blocking the scrape port
- `403 Forbidden` → token valid but insufficient permissions

### 4. Verify the /metrics endpoint is responding

```bash
# Check the backend is healthy
curl http://<target-host>:<port>/health

# Check metrics specifically
curl http://<target-host>:<port>/metrics | head -20
```

If `/health` returns 200 but `/metrics` fails, the metrics middleware may have crashed or been removed.

### 5. Check the Prometheus scrape configuration

```bash
# View the current scrape config for the affected job
cat /etc/prometheus/prometheus.yml | grep -A 20 'job_name: "<job>"'

# Validate config syntax
promtool check config /etc/prometheus/prometheus.yml
```

Look for:
- Correct `metrics_path` (default is `/metrics`)
- Correct `scheme` (http vs https)
- Correct port in `static_configs` or service discovery
- `bearer_token_file` path pointing to a valid file

### 6. Check for recent deployments

If the target went down around a deployment time:
```bash
git log --oneline -10  # recent commits
gh run list --limit 5  # recent CI runs
```

A port change, metrics middleware removal, or auth config change could cause this.

## Remediation

### Token authentication failure

```bash
# 1. Regenerate token
./scripts/generate-scrape-token.sh <service>

# 2. Reload Prometheus
curl -X POST http://localhost:9090/-/reload

# 3. Verify target recovers
watch -n5 'curl -s http://localhost:9090/api/v1/targets | jq ".data.activeTargets[] | select(.labels.job==\"<job>\") | .health"'
```

### Service not running

```bash
# Docker
docker start sovren-backend

# Kubernetes
kubectl rollout restart deployment/<deployment-name>
```

### Network/firewall issue

- Verify the scrape port is in the security group / network policy allow-list
- For Kubernetes: check that the `ServiceMonitor` or `PodMonitor` port name matches the container port name

### Wrong metrics_path

Update `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'sovren-backend'
    metrics_path: /metrics   # correct path
    static_configs:
      - targets: ['backend:3001']
```

Then reload: `curl -X POST http://localhost:9090/-/reload`

## Escalation

- If target remains down after token regeneration and service restart → P1, check for infrastructure failure
- If multiple targets go down simultaneously → check Prometheus itself (OOM, disk full) before investigating individual services
- For production: always notify on-call if a target is down > 5 minutes — metrics blindness is a P1 condition
