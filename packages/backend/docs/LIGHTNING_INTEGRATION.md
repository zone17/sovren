# ⚡ Elite Lightning Network Integration

**World-class Bitcoin Lightning Network integration for Sovren creator monetization**

## 🎯 Overview

Sovren's Lightning Network integration provides instant Bitcoin payments for creator monetization, featuring:

- **LNbits Integration**: Professional wallet management with instant settlement
- **LNURL-pay Protocol**: Seamless mobile wallet compatibility
- **Lightning Addresses**: Human-readable payment endpoints
- **Real-time Webhooks**: Instant payment notifications
- **Payment Receipts**: Comprehensive receipt generation with PDF and email delivery
- **Enterprise Security**: Cryptographic validation and rate limiting
- **Mobile Optimization**: QR codes and deep linking support

---

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Lightning Network Configuration
LNBITS_URL=https://legend.lnbits.com
LNBITS_API_KEY=your-lnbits-api-key
LNBITS_WALLET_ID=your-wallet-id
LIGHTNING_WEBHOOK_SECRET=your-secure-webhook-secret

# Receipt Generation Configuration
RECEIPT_FROM_EMAIL=receipts@sovren.com
RECEIPT_SIGNATURE_SECRET=your-receipt-secret
RECEIPT_STORAGE_PATH=./storage/receipts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Optional Configuration
WEBHOOK_BASE_URL=https://api.sovren.dev
LNURL_BASE_URL=https://api.sovren.dev
LIGHTNING_ADDRESS_DOMAIN=sovren.com
```

### 2. Service Initialization

```typescript
import { lightningService } from '@/services/lightning-service';
import { lightningReceiptService } from '@/services/lightning/receipt-service';

// Initialize Lightning Network service
await lightningService.initialize({
  lnbitsUrl: process.env.LNBITS_URL!,
  lnbitsApiKey: process.env.LNBITS_API_KEY!,
  lnbitsWalletId: process.env.LNBITS_WALLET_ID!,
  webhookSecret: process.env.LIGHTNING_WEBHOOK_SECRET!,
  enableWebhooks: true,
  enableLnurlPay: true,
  enableLightningAddress: true,
});

// Receipt service is automatically initialized with default configuration
console.log('⚡ Lightning and Receipt services ready');
```

### 3. Complete Payment Flow with Receipt

```typescript
// Create Lightning invoice for creator support
const invoiceResult = await lightningService.createInvoice({
  amount: 1000, // satoshis
  description: 'Support for amazing content',
  creatorId: 'creator-uuid',
  supporterId: 'supporter-uuid',
  memo: 'Thanks for the great content!',
});

if (invoiceResult.success) {
  console.log('Invoice created:', invoiceResult.invoice.bolt11);

  // After payment is completed (via webhook), generate receipt
  const receipt = await lightningReceiptService.generateReceipt({
    paymentId: invoiceResult.invoice.id,
    includeDetailedVerification: true,
    emailReceipt: true,
    emailAddress: 'supporter@example.com',
    pdfOptions: {
      includeQrCode: true,
      includeSignature: true,
      watermark: false,
    },
  });

  console.log('Receipt generated:', receipt.receiptNumber);
  console.log('Download URL:', receipt.receipt.downloadUrl);
}
```

---

## 🔌 API Endpoints

### Invoice Management

#### Create Invoice

```http
POST /api/lightning/invoice
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "amount": 1000,
  "description": "Support for creator",
  "creatorId": "creator-uuid",
  "memo": "Optional memo",
  "expiryMinutes": 60
}
```

#### Check Invoice Status

```http
GET /api/lightning/invoice/:invoiceId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice-uuid",
      "status": "paid",
      "amount": 1000,
      "description": "Support for creator",
      "payment_hash": "abc123..."
    },
    "payment": {
      "id": "payment-uuid",
      "amount": 1000,
      "fee": 1,
      "settled_at": 1640995200000,
      "preimage": "def456..."
    }
  }
}
```

### Payment Receipts

#### Generate Receipt

```http
POST /api/lightning/receipt
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "paymentId": "payment-uuid",
  "includeDetailedVerification": true,
  "emailReceipt": true,
  "emailAddress": "user@example.com",
  "pdfOptions": {
    "includeQrCode": true,
    "includeSignature": true,
    "watermark": false
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Receipt generated successfully",
  "data": {
    "receipt": {
      "id": "receipt-uuid",
      "receiptNumber": "SVR-ABC123-DEF456",
      "paymentHash": "payment-hash",
      "amount": 1000,
      "fee": 10,
      "timestamp": 1640995200000,
      "creator": {
        "id": "creator-uuid",
        "displayName": "Amazing Creator"
      },
      "downloadUrl": "/api/lightning/receipt/SVR-ABC123-DEF456/pdf",
      "verificationCode": "A1B2C3D4",
      "pdfGenerated": true,
      "emailSent": true
    }
  }
}
```

#### Get Receipt

```http
GET /api/lightning/receipt/:identifier
```

_identifier can be payment hash, receipt number, or receipt ID_

#### Download PDF Receipt

```http
GET /api/lightning/receipt/:receiptNumber/pdf
```

#### Email Receipt

```http
POST /api/lightning/receipt/:receiptId/email
Content-Type: application/json

{
  "email": "user@example.com",
  "message": "Optional message"
}
```

#### Verify Receipt

```http
POST /api/lightning/receipt/:receiptId/verify
Content-Type: application/json

{
  "verificationCode": "A1B2C3D4"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Receipt verification successful",
  "data": {
    "valid": true,
    "verifiedAt": "2024-01-01T12:00:00.000Z",
    "receipt": {
      "receiptNumber": "SVR-ABC123-DEF456",
      "amount": 1000,
      "timestamp": 1640995200000,
      "creator": "Amazing Creator"
    }
  }
}
```

### LNURL-pay Protocol

#### Generate LNURL-pay

```http
POST /api/lightning/lnurl-pay/:creatorId
Content-Type: application/json

{
  "minAmount": 100,
  "maxAmount": 100000,
  "commentAllowed": 280
}
```

#### LNURL Callback

```http
GET /api/lightning/lnurl-pay/:creatorId?amount=1000000&comment=Great%20content!
```

### Lightning Addresses

#### Create Lightning Address

```http
POST /api/lightning/address
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "identifier": "creator",
  "domain": "sovren.com"
}
```

### Payment History

#### Get Creator Payments

```http
GET /api/lightning/payments/:creatorId?limit=50&offset=0&status=completed
Authorization: Bearer <jwt-token>
```

### Webhooks

#### Payment Webhook

```http
POST /api/lightning/webhook
X-Signature: sha256=webhook-signature
Content-Type: application/json

{
  "type": "payment",
  "payment_hash": "abc123...",
  "amount": 1000,
  "fee": 1,
  "preimage": "def456..."
}
```

---

## 🔧 Configuration Options

### LightningService Configuration

```typescript
interface LightningConfig {
  // Required
  lnbitsUrl: string; // LNbits server URL
  lnbitsApiKey: string; // LNbits API key
  lnbitsWalletId: string; // LNbits wallet ID
  webhookSecret: string; // Webhook signature secret

  // Optional
  defaultMemo?: string; // Default invoice memo
  invoiceExpiryMinutes?: number; // Invoice expiry (default: 60)
  maxInvoiceAmount?: number; // Max amount in sats (default: 1M)
  minInvoiceAmount?: number; // Min amount in sats (default: 1)
  enableWebhooks?: boolean; // Enable webhooks (default: true)
  enableLnurlPay?: boolean; // Enable LNURL-pay (default: true)
  enableLightningAddress?: boolean; // Enable addresses (default: true)
  retryAttempts?: number; // API retry attempts (default: 3)
  requestTimeout?: number; // Request timeout ms (default: 30000)
}
```

### Receipt Service Configuration

```typescript
interface ReceiptConfig {
  // PDF Generation
  pdfTemplate: string; // Template name for PDF generation
  pdfOptions: {
    format: 'A4' | 'Letter'; // PDF page format
    margin: {
      // PDF margins
      top: string;
      right: string;
      bottom: string;
      left: string;
    };
    printBackground: boolean; // Include background graphics
    displayHeaderFooter: boolean; // Show header/footer
  };

  // Email Configuration
  email: {
    from: string; // Sender email address
    subject: string; // Email subject template
    template: string; // Email template name
    attachPdf: boolean; // Attach PDF to email
  };

  // Storage Configuration
  storage: {
    provider: 'local' | 's3' | 'gcs'; // Storage provider
    basePath: string; // Storage base path
    retention: number; // Retention period in days
  };

  // Security Configuration
  security: {
    encryptPdf: boolean; // Encrypt PDF files
    passwordProtected: boolean; // Password protect PDFs
    signatureAlgorithm: string; // Signature algorithm
  };
}
```

### Environment Variables

```bash
# LNbits Configuration
LNBITS_URL=https://your-lnbits-server.com
LNBITS_API_KEY=your-lnbits-api-key
LNBITS_WALLET_ID=your-wallet-id
LIGHTNING_WEBHOOK_SECRET=secure-webhook-secret

# Receipt Configuration
RECEIPT_FROM_EMAIL=receipts@sovren.com
RECEIPT_SIGNATURE_SECRET=secure-receipt-secret
RECEIPT_STORAGE_PATH=./storage/receipts

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Optional Features
WEBHOOK_BASE_URL=https://api.sovren.dev
LNURL_BASE_URL=https://api.sovren.dev
LIGHTNING_ADDRESS_DOMAIN=sovren.com
ENABLE_LIGHTNING_ADDRESSES=true
ENABLE_LNURL_PAY=true
ENABLE_LIGHTNING_WEBHOOKS=true
```

---

## 🔒 Security Features

### Rate Limiting

- **Invoice Creation**: 10 requests/minute per user
- **Receipt Generation**: 10 requests/minute per user
- **Receipt Email**: 5 requests/minute per user
- **General Lightning**: 30 requests/minute per user
- **Receipt Access**: 50 requests/minute per user
- **Webhooks**: 100 requests/minute per IP
- **IP-based Protection**: Advanced DDoS prevention

### Receipt Security

```typescript
// Receipt cryptographic verification
const receiptVerification = {
  hash: crypto.createHash('sha256').update(receiptData).digest('hex'),
  signature: crypto.createHmac('sha256', secret).update(signatureData).digest('hex'),
  verificationCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
  paymentVerification: {
    preimageHash: crypto.createHash('sha256').update(preimage).digest('hex'),
    paymentHashMatch: preimageHash === paymentHash,
  },
};
```

### Webhook Security

```typescript
// Webhook signature verification
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}
```

### Input Validation

- **Zod Schema Validation**: All inputs validated with Zod
- **Amount Limits**: Configurable min/max amounts
- **UUID Validation**: Creator and supporter IDs validated
- **String Length Limits**: Description and memo length limits
- **Email Validation**: RFC-compliant email validation
- **Receipt Integrity**: Cryptographic hash and signature validation

---

## 📱 Mobile Integration

### QR Code Support

```typescript
// Generate QR code for Lightning invoice
const qrCodeUrl = `lightning:${invoice.bolt11}`;

// LNURL-pay QR code
const lnurlQrCode = await lightningService.generateLnurlPay({
  creatorId: 'creator-123',
});

// Receipt verification QR code
const receiptQrCode = `https://api.sovren.dev/receipt/verify/${receipt.receiptNumber}?code=${receipt.security.verificationCode}`;
```

### Deep Linking

```html
<!-- Lightning invoice deep link -->
<a href="lightning:lnbc1000n1...">Pay with Lightning</a>

<!-- LNURL-pay deep link -->
<a href="lightning:lnurl1dp68gurn8ghj7um...">Support Creator</a>

<!-- Receipt download deep link -->
<a href="sovren://receipt/download/SVR-ABC123-DEF456">Download Receipt</a>
```

---

## 🧪 Testing

### Unit Tests

```bash
# Run Lightning service tests
npm test -- --testPathPattern=lightning-service.test.ts

# Run Receipt service tests
npm test -- --testPathPattern=lightning-receipt-service.test.ts

# Run with coverage
npm run test:coverage
```

### Integration Tests

```typescript
describe('Lightning Payment Flow with Receipts', () => {
  it('should process complete payment with receipt generation', async () => {
    // Create invoice
    const invoice = await lightningService.createInvoice({
      amount: 1000,
      description: 'Test payment',
      creatorId: 'test-creator',
      supporterId: 'test-supporter',
    });

    // Simulate payment webhook
    const webhookResult = await lightningService.processWebhook({
      type: 'payment',
      payment_hash: invoice.payment_hash,
      amount: 1000,
    });

    // Generate receipt
    const receipt = await lightningReceiptService.generateReceipt({
      paymentId: invoice.id,
      includeDetailedVerification: true,
    });

    // Verify receipt
    const verification = await lightningReceiptService.verifyReceipt(
      receipt.id,
      receipt.security.verificationCode
    );

    expect(webhookResult.success).toBe(true);
    expect(receipt.receiptNumber).toMatch(/^SVR-[A-Z0-9-]+$/);
    expect(verification.valid).toBe(true);
  });

  it('should handle PDF generation and email delivery', async () => {
    const receipt = await lightningReceiptService.generateReceipt({
      paymentId: 'test-payment-id',
      emailReceipt: true,
      emailAddress: 'test@example.com',
      pdfOptions: {
        includeQrCode: true,
        includeSignature: true,
      },
    });

    expect(receipt.receipt.pdfGenerated).toBe(true);
    expect(receipt.receipt.emailSent).toBe(true);
    expect(receipt.receipt.pdfUrl).toContain('.pdf');
  });
});
```

### Testing with Testnet

```bash
# Use testnet LNbits for development
LNBITS_URL=https://testnet.lnbits.com
LNBITS_API_KEY=testnet-api-key
LNBITS_WALLET_ID=testnet-wallet-id

# Test receipt generation
RECEIPT_FROM_EMAIL=test-receipts@sovren.com
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
```

---

## 🚀 Production Deployment

### LNbits Setup

1. **Self-hosted LNbits**:

   ```bash
   # Docker deployment
   docker run -p 5000:5000 lnbits/lnbits
   ```

2. **Hosted LNbits**: Use `legend.lnbits.com` or other providers

3. **Create Wallet**:
   - Generate new wallet in LNbits
   - Fund with Bitcoin for Lightning channels
   - Get API key and wallet ID

### Vercel Deployment

```bash
# Set environment variables in Vercel
vercel env add LNBITS_URL
vercel env add LNBITS_API_KEY
vercel env add LNBITS_WALLET_ID
vercel env add LIGHTNING_WEBHOOK_SECRET
vercel env add RECEIPT_FROM_EMAIL
vercel env add RECEIPT_SIGNATURE_SECRET
vercel env add SMTP_HOST
vercel env add SMTP_USER
vercel env add SMTP_PASS

# Deploy with Lightning and Receipt support
vercel deploy --prod
```

### Receipt Storage Setup

```bash
# Local storage (development)
mkdir -p ./storage/receipts
chmod 755 ./storage/receipts

# AWS S3 (production)
aws s3 mb s3://sovren-receipts
aws s3api put-bucket-versioning --bucket sovren-receipts --versioning-configuration Status=Enabled

# Google Cloud Storage (production)
gsutil mb gs://sovren-receipts
gsutil lifecycle set receipt-lifecycle.json gs://sovren-receipts
```

### Health Monitoring

```http
GET /api/lightning/health
```

**Response:**

```json
{
  "success": true,
  "status": "healthy",
  "checks": {
    "lnbits": true,
    "wallet": true,
    "invoices": true,
    "receipts": true,
    "email": true,
    "storage": true
  }
}
```

---

## 📊 Analytics & Monitoring

### Payment Metrics

```typescript
// Get Lightning service statistics
const stats = await lightningService.getStats();

console.log('Total payments:', stats.totalPayments);
console.log('Success rate:', stats.successRate);
console.log('Average amount:', stats.averageAmount);
console.log('Receipt generation rate:', stats.receiptGenerationRate);
```

### Receipt Analytics

```typescript
// Get receipt analytics
const receiptStats = await lightningReceiptService.getAnalytics();

console.log('Total receipts generated:', receiptStats.totalReceipts);
console.log('PDF generation rate:', receiptStats.pdfGenerationRate);
console.log('Email delivery rate:', receiptStats.emailDeliveryRate);
console.log('Verification requests:', receiptStats.verificationCount);
```

### Real-time Events

```typescript
// Listen for payment events
lightningService.on('payment:completed', async (payment) => {
  console.log(`Payment received: ${payment.amount} sats`);

  // Auto-generate receipt for completed payments
  const receipt = await lightningReceiptService.generateReceipt({
    paymentId: payment.id,
    includeDetailedVerification: true,
  });

  // Send notification to creator
  notifyCreator(payment.creator_id, { payment, receipt });

  // Update analytics
  trackPayment(payment, receipt);
});

// Listen for receipt events
lightningReceiptService.on('receipt:generated', (receipt) => {
  console.log(`Receipt generated: ${receipt.receiptNumber}`);

  // Log receipt creation
  auditLog('receipt:generated', {
    receiptNumber: receipt.receiptNumber,
    paymentHash: receipt.paymentHash,
    amount: receipt.amount,
  });
});

lightningReceiptService.on('receipt:email:sent', (event) => {
  console.log(`Receipt emailed: ${event.receiptId} to ${event.email}`);
});

lightningService.on('invoice:expired', (invoice) => {
  console.log(`Invoice expired: ${invoice.id}`);
});
```

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. LNbits Connection Failed

```bash
# Check LNbits server status
curl -H "X-Api-Key: your-api-key" https://your-lnbits.com/api/v1/wallet

# Verify API key and wallet ID
# Check network connectivity
```

#### 2. Receipt Generation Failed

```bash
# Check PDF generation dependencies
npm list puppeteer

# Verify email configuration
curl -X POST https://api.sovren.dev/api/lightning/receipt/health

# Check storage permissions
ls -la ./storage/receipts
```

#### 3. Webhook Not Received

```bash
# Verify webhook URL is publicly accessible
curl -X POST https://api.sovren.dev/api/lightning/webhook

# Check webhook secret configuration
# Verify firewall settings
```

#### 4. Email Delivery Failed

```bash
# Test SMTP configuration
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  auth: { user: 'user', pass: 'pass' }
});
transporter.verify().then(console.log).catch(console.error);
"
```

#### 5. PDF Generation Issues

```bash
# Check Puppeteer installation
npm list puppeteer

# Verify Chrome/Chromium installation
which google-chrome || which chromium-browser

# Check file system permissions
ls -la ./storage/receipts/
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=lightning*,receipt* npm start

# Verbose test output
VERBOSE_TESTS=true npm test

# Receipt generation debugging
RECEIPT_DEBUG=true npm start
```

### Receipt Verification Troubleshooting

```typescript
// Manual receipt verification
const verificationResult = await lightningReceiptService.verifyReceipt(
  'receipt-id',
  'verification-code'
);

if (!verificationResult.valid) {
  console.error('Verification errors:', verificationResult.errors);

  // Common issues:
  // - Receipt hash verification failed: Receipt data was tampered with
  // - Receipt signature verification failed: Invalid signature secret
  // - Verification code mismatch: Wrong verification code provided
  // - Payment verification failed: Invalid preimage/payment hash
}
```

---

## 🔮 Advanced Features

### Custom Receipt Templates

```typescript
// Custom PDF template
const customTemplate = `
<!DOCTYPE html>
<html>
<head>
  <title>Custom Receipt</title>
  <style>
    .custom-receipt { /* your styles */ }
  </style>
</head>
<body>
  <div class="custom-receipt">
    <h1>{{creator.displayName}} Payment Receipt</h1>
    <p>Amount: {{amount}} sats</p>
    <p>Date: {{formattedDate}}</p>
    <!-- QR code for verification -->
    <img src="data:image/png;base64,{{qrCodeBase64}}" alt="Verification QR" />
  </div>
</body>
</html>
`;

// Save template
await fs.writeFile('./templates/custom-receipt.html', customTemplate);
```

### Multi-recipient Receipts

```typescript
// Split payment receipts (future feature)
const splitReceipt = await lightningReceiptService.generateSplitReceipt({
  paymentId: 'payment-id',
  recipients: [
    { creatorId: 'creator-1', percentage: 70, amount: 700 },
    { creatorId: 'creator-2', percentage: 30, amount: 300 },
  ],
});
```

### Recurring Payment Receipts

```typescript
// Subscription payment receipts (future feature)
const subscriptionReceipt = await lightningReceiptService.generateSubscriptionReceipt({
  subscriptionId: 'sub-123',
  paymentId: 'payment-id',
  period: 'monthly',
  paymentNumber: 3,
  totalPayments: 12,
});
```

### NOSTR Integration

```typescript
// Publish receipt to NOSTR
lightningReceiptService.on('receipt:generated', async (receipt) => {
  const nostrEvent = await nostrService.createReceiptEvent({
    receiptNumber: receipt.receiptNumber,
    amount: receipt.amount,
    creatorPubkey: receipt.creator.nostrPubkey,
    supporterPubkey: receipt.supporter.nostrPubkey,
    verificationCode: receipt.security.verificationCode,
  });

  await nostrService.publishEvent(nostrEvent);
});
```

---

## 📚 Resources

### Documentation

- [LNbits API Documentation](https://docs.lnbits.org/)
- [LNURL Protocol Specification](https://github.com/lnurl/luds)
- [Lightning Network Whitepaper](https://lightning.network/)
- [BOLT11 Payment Requests](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md)
- [Puppeteer PDF Generation](https://pptr.dev/)
- [Nodemailer Email Sending](https://nodemailer.com/)

### Tools

- [Lightning Network Explorers](https://1ml.com/)
- [Invoice Decoders](https://lndecode.com/)
- [LNURL Tools](https://lnurl.fiatjaf.com/)
- [QR Code Generators](https://qrserver.com/)
- [Receipt Verification Tool](https://api.sovren.dev/receipt/verify)

### Community

- [Lightning Developers Slack](https://lightningcommunity.slack.com/)
- [Bitcoin Lightning Network Telegram](https://t.me/lightning_network)
- [Sovren Developer Community](https://discord.gg/sovren)

---

**Built with ⚡ by the Sovren Team**

_Empowering creators with instant Bitcoin payments and comprehensive receipt management_
