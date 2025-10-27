# Runbook: Lightning Node Down

**Alert**: `LightningNodeDown`
**Severity**: CRITICAL
**Team**: Infrastructure
**SLA**: 5 minutes to acknowledge, 30 minutes to resolve

## Symptoms

Lightning Network node is unreachable or unhealthy. Health check failing for 2+ minutes.

## Impact

- **Payment Processing**: All Lightning payments will fail
- **Revenue**: Complete payment processing halt
- **User Experience**: Users cannot complete any transactions
- **Channel State**: Risk of force-close if node is offline too long

## Immediate Actions (First 2 Minutes)

1. **Acknowledge Alert**: Confirm investigation in PagerDuty/Slack

2. **Check Node Status**:
   ```bash
   # Check Docker container
   docker ps -a | grep lightning

   # Check node health
   lncli getinfo
   ```

3. **Check Logs**:
   ```bash
   # View recent logs
   docker logs --tail 100 sovren-lightning-node

   # Follow logs in real-time
   docker logs -f sovren-lightning-node
   ```

## Investigation Steps

### Step 1: Verify Container Status

```bash
# Check if container is running
docker ps | grep lightning

# If stopped, check why
docker inspect sovren-lightning-node | jq '.[0].State'

# Check exit code
docker inspect sovren-lightning-node | jq '.[0].State.ExitCode'
```

**Exit Codes**:
- `0`: Clean shutdown (manual stop)
- `1`: General error (check logs)
- `137`: Killed by OOM
- `139`: Segmentation fault

### Step 2: Check Network Connectivity

```bash
# Ping Lightning node host
ping -c 5 lightning-node.sovren.internal

# Check network routes
traceroute lightning-node.sovren.internal

# Verify DNS resolution
nslookup lightning-node.sovren.internal

# Check port accessibility
telnet lightning-node.sovren.internal 9735
nc -zv lightning-node.sovren.internal 9735
```

### Step 3: Check System Resources

```bash
# Check disk space
df -h | grep lightning

# Check memory
free -h

# Check CPU
top -bn1 | head -20

# Check inode usage (LND uses many small files)
df -i
```

### Step 4: Validate LND Database

```bash
# Check database integrity
lncli validatedb

# Check wallet status
lncli walletbalance

# Verify channel state
lncli listchannels | jq '.channels | length'
```

## Common Root Causes

| Cause | Symptoms | Solution |
|-------|----------|----------|
| Container crashed | Container exited, logs show error | Restart container, fix config |
| Out of memory | OOM killer messages, exit code 137 | Increase memory limit |
| Disk full | Cannot write logs/db, I/O errors | Clean up disk space |
| Network partition | Cannot reach peers, sync stopped | Check network, firewall rules |
| Database corruption | LND won't start, errors in logs | Restore from backup |
| Configuration error | LND exits immediately, config errors | Review and fix lnd.conf |

## Resolution Steps

### If Container Crashed:

```bash
# Restart Lightning node
docker restart sovren-lightning-node

# Monitor startup
docker logs -f sovren-lightning-node

# Wait for sync
watch -n 5 'lncli getinfo | jq .synced_to_chain'
```

### If Out of Memory:

```bash
# Increase memory limit in docker-compose.yml
services:
  lightning-node:
    deploy:
      resources:
        limits:
          memory: 4G  # Increase from 2G

# Restart with new limits
docker-compose up -d lightning-node
```

### If Disk Full:

```bash
# Find large files
du -sh /var/lib/docker/volumes/lightning-data/* | sort -rh | head -10

# Clean old logs
find /var/lib/docker/volumes/lightning-data/logs -name "*.log" -mtime +7 -delete

# Prune old channel backups
find /var/lib/docker/volumes/lightning-data/backups -name "*.backup" -mtime +30 -delete
```

### If Database Corrupted:

```bash
# Stop node
docker stop sovren-lightning-node

# Restore from latest backup
tar -xzf /backups/lightning-$(date -d yesterday +%Y%m%d).tar.gz -C /var/lib/docker/volumes/lightning-data/_data

# Start node
docker start sovren-lightning-node

# Verify channels
lncli listchannels
```

### If Network Issues:

```bash
# Check firewall rules
sudo iptables -L -n | grep 9735

# Allow Lightning port
sudo iptables -A INPUT -p tcp --dport 9735 -j ACCEPT

# Check peers
lncli listpeers | jq '.peers | length'

# Reconnect to peers
lncli connect <pubkey>@<host>:9735
```

## Verification

1. **Node Responsive**:
   ```bash
   lncli getinfo
   # Should return node info without errors
   ```

2. **Synced to Chain**:
   ```bash
   lncli getinfo | jq .synced_to_chain
   # Should return: true
   ```

3. **Channels Active**:
   ```bash
   lncli listchannels | jq '[.channels[] | select(.active == true)] | length'
   # Should match expected channel count
   ```

4. **Health Check Passing**:
   ```bash
   curl http://payment-api:3000/health | jq '.components.lightning_node.status'
   # Should return: "healthy"
   ```

5. **Test Payment**:
   ```bash
   # Create small invoice
   lncli addinvoice --amt 100
   # Try to decode it
   lncli decodepayreq <payment_request>
   ```

## Escalation

If node cannot be recovered within 30 minutes:

1. **Page Senior Infrastructure Engineer**
2. **Notify Payment Team**: Payments are offline
3. **Consider Backup Node**: Switch to standby Lightning node (if available)
4. **Communicate to Users**: Display maintenance message

## Post-Incident

1. **Verify All Channels**: Ensure no channels were force-closed
   ```bash
   lncli pendingchannels
   lncli closedchannels
   ```

2. **Check for Lost Funds**: Verify wallet balance
   ```bash
   lncli walletbalance
   lncli channelbalance
   ```

3. **Document Incident**: Record what happened and resolution steps
4. **Improve Monitoring**: Add checks for root cause
5. **Review Backup Strategy**: Ensure backups are current
6. **Update Runbook**: Add learnings from this incident

## Prevention

- **Automated Backups**: Daily backups of LND data
- **Resource Monitoring**: Alert on high memory/disk usage before failure
- **Channel Monitoring**: Track channel liquidity and health
- **Redundancy**: Consider hot standby Lightning node
- **Health Checks**: More frequent health checks (every 15s)
- **Static Channel Backups**: Enable and monitor SCB

## Useful Commands

```bash
# Get full node status
lncli getinfo | jq .

# Check wallet balance
lncli walletbalance

# List all channels
lncli listchannels | jq '.channels[] | {alias, capacity, local_balance, remote_balance, active}'

# Check pending HTLCs
lncli listchannels | jq '[.channels[].pending_htlcs | select(length > 0)]'

# Verify static channel backup
ls -lh /var/lib/docker/volumes/lightning-data/_data/channel.backup

# Force sync with blockchain
lncli synctochain
```

## Related Alerts

- `HighPaymentFailureRate` - Will trigger when payments start failing
- `CircuitBreakerOpen` - May trigger as payments fail
- `NoPaymentsProcessed` - Will trigger as payment volume drops to zero

## References

- [LND Documentation](https://docs.lightning.engineering/)
- [Lightning Node Administration Guide](/docs/lightning-node-admin.md)
- [Disaster Recovery Plan](/docs/disaster-recovery.md)
- [Channel Management Guide](/docs/channel-management.md)
