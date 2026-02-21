---
status: complete
priority: p1
issue_id: 314
tags: [code-review, security]
---

# SSRF bypass via decimal-encoded integer IPs

## Problem Statement

The SSRF protection utility can be bypassed using decimal-encoded integer IP addresses. URL `https://2130706433` (decimal for 127.0.0.1) bypasses all hostname checks because `new URL()` resolves it to `2130706433` which doesn't match `localhost` or `127.x.x.x` regex patterns.

## Findings

- `packages/backend/src/utils/ssrf.ts` lines 15-18: hostname validation only checks string patterns
- `new URL('https://2130706433').hostname` returns `2130706433` — does not match any blocklist
- Decimal `2130706433` = `127.0.0.1` in IPv4, allowing access to loopback
- Other encodings may also bypass: octal (`0177.0.0.1`), hex (`0x7f000001`), IPv6 mapped (`::ffff:127.0.0.1`)

## Proposed Solutions

1. After parsing the URL hostname, resolve it via DNS and check if the resolved IP is private/loopback:

```typescript
import { lookup } from 'dns/promises';

async function isPrivateIp(hostname: string): Promise<boolean> {
  try {
    const { address } = await lookup(hostname);
    const parts = address.split('.').map(Number);
    return (
      parts[0] === 127 || // loopback
      parts[0] === 10 || // 10.0.0.0/8
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
      parts[0] === 0 || // 0.0.0.0/8
      address === '169.254.169.254' // AWS metadata
    );
  } catch {
    return true; // fail closed
  }
}

export async function validateSsrfUrl(url: string): Promise<boolean> {
  const parsed = new URL(url);
  if (await isPrivateIp(parsed.hostname)) return false;
  return true;
}
```

## Technical Details

- **Affected Files**: `packages/backend/src/utils/ssrf.ts`
- **Components**: SSRF protection utility, used by any service making outbound HTTP requests

## Acceptance Criteria

- [ ] `validateSsrfUrl('https://2130706433')` returns false
- [ ] `validateSsrfUrl('https://0x7f000001')` returns false
- [ ] DNS resolution is used to check actual resolved IP, not just string patterns
- [ ] Function fails closed (returns false) on DNS resolution errors
