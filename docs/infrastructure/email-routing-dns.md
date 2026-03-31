# Email Routing DNS Configuration — sovren.app

## Required Email Addresses

| Address            | Purpose                                  | Forward To            |
| ------------------ | ---------------------------------------- | --------------------- |
| dmca@sovren.app    | DMCA takedown notices (legal compliance) | Your designated inbox |
| privacy@sovren.app | Privacy/GDPR requests                    | Your designated inbox |
| abuse@sovren.app   | Abuse reports                            | Your designated inbox |

## Option A: Cloudflare Email Routing (Recommended)

If your domain DNS is managed by Cloudflare:

1. Go to **Cloudflare Dashboard** → **sovren.app** → **Email** → **Email Routing**
2. Enable Email Routing
3. Add destination address (your personal/team inbox)
4. Add routing rules:
   - `dmca@sovren.app` → destination
   - `privacy@sovren.app` → destination
   - `abuse@sovren.app` → destination
5. Cloudflare auto-configures MX and SPF records

### Cloudflare Auto-Generated Records

Cloudflare adds these automatically when Email Routing is enabled:

```
MX   sovren.app   isaac.mx.cloudflare.net    priority 86
MX   sovren.app   linda.mx.cloudflare.net    priority 24
MX   sovren.app   amir.mx.cloudflare.net     priority 3
TXT  sovren.app   "v=spf1 include:_spf.mx.cloudflare.net ~all"
```

## Option B: Generic MX Forwarding

If not using Cloudflare, configure MX records to point to your email provider.

### For Google Workspace

```
MX   sovren.app   aspmx.l.google.com         priority 1
MX   sovren.app   alt1.aspmx.l.google.com    priority 5
MX   sovren.app   alt2.aspmx.l.google.com    priority 5
MX   sovren.app   alt3.aspmx.l.google.com    priority 10
MX   sovren.app   alt4.aspmx.l.google.com    priority 10
```

### For ImprovMX (Free Forwarding)

```
MX   sovren.app   mx1.improvmx.com           priority 10
MX   sovren.app   mx2.improvmx.com           priority 20
TXT  sovren.app   "v=spf1 include:spf.improvmx.com ~all"
```

Sign up at https://improvmx.com, add `sovren.app`, configure forwarding rules.

## SPF Record

Prevents email spoofing. **A domain can only have ONE SPF TXT record.** Multiple `v=spf1` records cause SPF PermError, breaking email authentication entirely. Merge all `include:` directives from your chosen email provider(s) into a single record.

```
TXT  sovren.app   "v=spf1 include:_spf.google.com include:_spf.mx.cloudflare.net ~all"
```

Adjust `include:` directives based on which services send email on behalf of sovren.app. The backend EmailService uses SMTP (env var `SMTP_HOST`), so include your SMTP provider's SPF domain.

## DKIM Record

DKIM signing is configured in the EmailService (`packages/backend/src/services/EmailService.ts`). Your email provider generates the DKIM key pair. Add the public key as a TXT record:

```
TXT  default._domainkey.sovren.app   "v=DKIM1; k=rsa; p=<YOUR_PUBLIC_KEY>"
```

The selector name (`default`) must match what your SMTP provider uses.

## DMARC Record

Instructs receiving servers how to handle emails that fail SPF/DKIM checks.

Start with `p=none` for monitoring, then move to `p=quarantine` or `p=reject` once DKIM/SPF are verified:

```
# Phase 1: Monitoring only (start here)
TXT  _dmarc.sovren.app   "v=DMARC1; p=none; rua=mailto:dmarc-reports@sovren.app; pct=100"

# Phase 2: Quarantine (after verifying SPF/DKIM work correctly)
TXT  _dmarc.sovren.app   "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@sovren.app; pct=100"
```

**Important:** Use a dedicated address for DMARC aggregate reports (e.g., `dmarc-reports@sovren.app`), NOT `dmca@` or other compliance addresses. ISPs send daily XML report files in bulk — they will overwhelm a legal inbox.

## Verification

After applying DNS records, verify with:

```bash
# Check MX records
dig MX sovren.app +short

# Check SPF
dig TXT sovren.app +short | grep spf

# Check DKIM
dig TXT default._domainkey.sovren.app +short

# Check DMARC
dig TXT _dmarc.sovren.app +short
```

## Related Configuration

- SMTP env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- EmailService: `packages/backend/src/services/EmailService.ts`
- Dev email: Mailhog on `localhost:1025`
