# Database Schema Changes — P1 Critical Fixes (Round 6)

**Date**: 2026-02-14

## Supabase Schema Changes

**None.** No Supabase migrations required. All existing tables (`subscriptions`, `subscription_tiers`, `recurring_payments`) remain unchanged.

## JSON File Store Changes

### New File: `data/payments/receipts.json`

Created by the extended `JsonFilePaymentStore` (Todo 114). Stores receipts that were previously only in memory.

**Format**: JSON array of `PaymentReceipt` objects.

```json
[
  {
    "id": "uuid",
    "receiptNumber": "SVR-XXXXX-YYYYYY",
    "paymentHash": "hex-string",
    "invoiceId": "uuid",
    "amount": 1000,
    "fee": 10,
    "timestamp": 1707900000000,
    "createdAt": 1707900000000,
    "creator": { "id": "...", "name": "...", "displayName": "...", "profile": {} },
    "supporter": { "id": "...", "anonymous": false },
    "invoice": { "bolt11": "...", "description": "...", "expiresAt": 0 },
    "verification": {
      "paymentHash": "...",
      "preimage": "...",
      "verified": true,
      "verifiedAt": 0,
      "signature": "..."
    },
    "receipt": {
      "receiptNumber": "...",
      "pdfGenerated": false,
      "emailSent": false,
      "downloadUrl": "...",
      "downloadCount": 0
    },
    "platform": {
      "name": "Sovren",
      "version": "1.0.0",
      "environment": "...",
      "processedBy": "..."
    },
    "security": { "hash": "...", "signature": "...", "verificationCode": "..." }
  }
]
```

**Note**: The JSON file uses the same atomic write pattern (temp+rename) as `invoices.json` and `payments.json` per Todo 112.

### Existing Files (Unchanged Format)

- `data/payments/invoices.json` — No schema change, but now written atomically
- `data/payments/payments.json` — No schema change, but now written atomically

### Backup Files (New)

When `loadFromDisk` encounters a corrupted JSON file, it creates a backup before reinitializing:

- `data/payments/invoices.json.corrupt.<timestamp>`
- `data/payments/payments.json.corrupt.<timestamp>`
- `data/payments/receipts.json.corrupt.<timestamp>`
