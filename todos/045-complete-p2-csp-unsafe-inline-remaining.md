---
status: pending
priority: p2
issue_id: '045'
tags: [code-review, security, csp]
dependencies: []
---

# CSP unsafe-inline Remaining

## Problem Statement

Content Security Policy configuration still contains `unsafe-inline` directive in `script-src` across both vercel.json and nginx.conf deployment configurations. Additionally, the CSP `connect-src` directive allows plaintext WebSocket connections via `ws:` protocol, which should be restricted to secure `wss:` only.

## Findings

**Location**:

- `vercel.json`
- `packages/frontend/nginx.conf`

**Details**:

- `script-src` includes `'unsafe-inline'` which allows inline script execution
- `connect-src` includes `ws:` allowing unencrypted WebSocket connections
- CSP should enforce HTTPS-only connections for all resources
- `unsafe-inline` defeats primary XSS protection benefit of CSP
- Plaintext WebSocket connections expose data in transit

**Security Impact**:

- XSS attacks can execute inline scripts despite CSP presence
- Man-in-the-middle attacks possible on WebSocket connections
- Reduced effectiveness of CSP as a defense-in-depth layer

## Proposed Solutions

1. **Remove unsafe-inline**:

   - Implement nonce-based CSP for inline scripts
   - Extract inline scripts to external files
   - Use hash-based CSP for specific inline scripts
   - Update build process to inject nonces

2. **Replace ws: with wss:**:
   - Change `connect-src` directive to only allow `wss:`
   - Audit WebSocket client code for hardcoded `ws://` URLs
   - Ensure all WebSocket connections use secure protocol
   - Update environment variables for WebSocket endpoints

## Technical Details

**Current CSP Configuration**:

```
script-src: ... 'unsafe-inline' ...
connect-src: ... ws: wss: ...
```

**Target CSP Configuration**:

```
script-src: ... 'nonce-{random}' ...
connect-src: ... wss: ...
```

**Files Requiring Changes**:

- `vercel.json` - Update CSP headers
- `packages/frontend/nginx.conf` - Update CSP headers
- HTML templates - Add nonce attributes to inline scripts
- Build scripts - Generate and inject nonces
- WebSocket client code - Verify wss:// usage

## Acceptance Criteria

- [ ] `unsafe-inline` removed from all CSP configurations
- [ ] Nonce-based or hash-based CSP implemented for required inline scripts
- [ ] All inline scripts extracted or properly secured
- [ ] `ws:` removed from `connect-src` directive
- [ ] Only `wss:` allowed for WebSocket connections
- [ ] All WebSocket client code audited and uses secure protocol
- [ ] CSP headers consistent across vercel.json and nginx.conf
- [ ] Security testing confirms XSS protection improvement
- [ ] Documentation updated with CSP implementation details

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- MDN CSP documentation
- OWASP CSP Cheat Sheet
