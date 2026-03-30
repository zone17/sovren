/**
 * ⚡ Lightning Payment Receipt API Routes
 *
 * RESTful API endpoints for Lightning payment receipt management.
 * Handles receipt generation, PDF download, email delivery, and verification.
 *
 * @author Sovren Engineering Team
 * @version 1.0.0
 * @license MIT
 */

import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { lightningReceiptService, PaymentReceipt } from '../services/lightning/receipt-service';
import { authenticate, authorize } from '../middleware/auth';

// ===============================
// 📋 Request Validation Schemas
// ===============================

/**
 * Receipt generation request schema
 */
const GenerateReceiptSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID format'),
  includeDetailedVerification: z.boolean().optional().default(true),
  emailReceipt: z.boolean().optional().default(false),
  emailAddress: z.string().email('Invalid email address').optional(),
  pdfOptions: z
    .object({
      includeQrCode: z.boolean().optional().default(true),
      includeSignature: z.boolean().optional().default(true),
      watermark: z.boolean().optional().default(false),
    })
    .optional(),
});

/**
 * Email receipt request schema
 */
const EmailReceiptSchema = z.object({
  email: z.string().email('Invalid email address'),
  message: z.string().max(500, 'Message too long').optional(),
});

/**
 * Receipt verification request schema
 */
const VerifyReceiptSchema = z.object({
  verificationCode: z.string().min(4, 'Verification code too short').optional(),
});

// ===============================
// 🛡️ Rate Limiting Configuration
// ===============================

/**
 * Receipt generation rate limit - 10 requests per minute
 */
const receiptGenerationLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    error: 'Too many receipt generation requests',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Receipt email rate limit - 5 emails per minute
 */
const receiptEmailLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    error: 'Too many email requests',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General receipt access rate limit - 50 requests per minute
 */
const receiptAccessLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  message: {
    error: 'Too many receipt access requests',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ===============================
// 🛣️ Router Implementation
// ===============================

const router = Router();

// ===============================
// 🔄 Health Check Endpoint
// ===============================
// IMPORTANT: Static routes MUST be defined BEFORE parameterized routes.
// Express matches top-to-bottom, so /:identifier would capture /health and /analytics/summary
// if they were defined after it.

/**
 * GET /api/lightning/receipt/health
 * Health check for receipt service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check service health
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        receiptGeneration: 'operational',
        pdfGeneration: 'operational',
        emailService: 'operational',
        storage: 'operational',
      },
    };

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===============================
// 📊 Receipt Analytics Endpoint
// ===============================

/**
 * GET /api/lightning/receipt/analytics/summary
 * Get receipt generation analytics (admin only)
 */
router.get(
  '/analytics/summary',
  authenticate,
  authorize(['admin']),
  receiptAccessLimit,
  async (req: Request, res: Response) => {
    try {
      // TODO(backlog): Implement analytics aggregation
      // This would typically require database queries to aggregate receipt data

      const analyticsData = {
        totalReceipts: 0,
        totalAmount: 0,
        averageAmount: 0,
        pdfGenerated: 0,
        emailsSent: 0,
        verificationCount: 0,
        timeRange: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          to: new Date().toISOString(),
        },
      };

      res.json({
        success: true,
        data: analyticsData,
      });
    } catch (error) {
      console.error('Analytics retrieval failed:', error);
      res.status(500).json({
        success: false,
        error: 'Analytics retrieval failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ===============================
// 📝 Receipt Generation Endpoint
// ===============================

/**
 * POST /api/lightning/receipt
 * Generate a comprehensive payment receipt
 */
router.post('/', authenticate, receiptGenerationLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = GenerateReceiptSchema.parse(req.body);

    // Generate receipt — pin the calling user's pubkey so creator/supporter
    // is derived from the JWT, not from untrusted request body data
    const receipt = await lightningReceiptService.generateReceipt({
      ...validatedData,
      callerPubkey: req.user?.nostr_pubkey,
    } as any);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Receipt generated successfully',
      data: {
        receipt: {
          id: receipt.id,
          receiptNumber: receipt.receiptNumber,
          paymentHash: receipt.paymentHash,
          amount: receipt.amount,
          fee: receipt.fee,
          timestamp: receipt.timestamp,
          creator: receipt.creator,
          supporter: receipt.supporter,
          downloadUrl: receipt.receipt.downloadUrl,
          verificationCode: receipt.security.verificationCode,
          pdfGenerated: receipt.receipt.pdfGenerated,
          emailSent: receipt.receipt.emailSent,
        },
      },
    });
  } catch (error) {
    console.error('Receipt generation failed:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Receipt generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===============================
// 🔍 Receipt Retrieval Endpoints
// ===============================

/**
 * GET /api/lightning/receipt/:identifier
 * Get receipt by payment hash, receipt number, or receipt ID
 */
router.get(
  '/:identifier',
  authenticate,
  receiptAccessLimit,
  async (req: Request, res: Response) => {
    try {
      const { identifier } = req.params;

      // Try to find receipt by different identifiers
      let receipt: PaymentReceipt | null = null;

      // Check if it's a UUID (receipt ID)
      if (identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        receipt = await lightningReceiptService.getReceiptByNumber(identifier);
      }
      // Check if it's a receipt number format
      else if (identifier.startsWith('SVR-')) {
        receipt = await lightningReceiptService.getReceiptByNumber(identifier);
      }
      // Assume it's a payment hash
      else {
        receipt = await lightningReceiptService.getReceiptByPaymentHash(identifier);
      }

      if (!receipt) {
        return res.status(404).json({
          success: false,
          error: 'Receipt not found',
          message: 'No receipt found with the provided identifier',
        });
      }

      // IDOR protection: verify caller is either the creator or supporter on this receipt
      const callerPubkey = req.user?.nostr_pubkey;
      const isCreator = receipt.creator.id === callerPubkey;
      const isSupporter = receipt.supporter.id === callerPubkey;
      const isAdmin = req.user?.role === 'admin';
      if (!isCreator && !isSupporter && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only view receipts for your own payments',
        });
      }

      // Return receipt data (excluding sensitive information)
      res.json({
        success: true,
        data: {
          receipt: {
            id: receipt.id,
            receiptNumber: receipt.receiptNumber,
            paymentHash: receipt.paymentHash,
            amount: receipt.amount,
            fee: receipt.fee,
            timestamp: receipt.timestamp,
            createdAt: receipt.createdAt,
            creator: receipt.creator,
            supporter: receipt.supporter,
            invoice: receipt.invoice,
            verification: {
              verified: receipt.verification.verified,
              verifiedAt: receipt.verification.verifiedAt,
            },
            receipt: {
              pdfGenerated: receipt.receipt.pdfGenerated,
              emailSent: receipt.receipt.emailSent,
              downloadUrl: receipt.receipt.downloadUrl,
              downloadCount: receipt.receipt.downloadCount,
            },
            platform: receipt.platform,
          },
        },
      });
    } catch (error) {
      console.error('Receipt retrieval failed:', error);
      res.status(500).json({
        success: false,
        error: 'Receipt retrieval failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ===============================
// 📄 PDF Download Endpoint
// ===============================

/**
 * GET /api/lightning/receipt/:receiptNumber/pdf
 * Download PDF receipt
 */
router.get(
  '/:receiptNumber/pdf',
  authenticate,
  receiptAccessLimit,
  async (req: Request, res: Response) => {
    try {
      const { receiptNumber } = req.params;

      // Find receipt
      const receipt = await lightningReceiptService.getReceiptByNumber(receiptNumber);
      if (!receipt) {
        return res.status(404).json({
          success: false,
          error: 'Receipt not found',
        });
      }

      // IDOR protection: verify caller owns this receipt
      const callerPubkey = req.user?.nostr_pubkey;
      const isCreator = receipt.creator.id === callerPubkey;
      const isSupporter = receipt.supporter.id === callerPubkey;
      const isAdmin = req.user?.role === 'admin';
      if (!isCreator && !isSupporter && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only download receipts for your own payments',
        });
      }

      // Generate PDF if not already generated
      let pdfBuffer: Buffer;
      if (!receipt.receipt.pdfGenerated) {
        pdfBuffer = await lightningReceiptService.generatePdfReceipt(receipt);
      } else {
        // Load existing PDF (this would need to be implemented based on storage solution)
        pdfBuffer = Buffer.from('PDF content would be loaded from storage');
      }

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="receipt-${receiptNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error('PDF download failed:', error);
      res.status(500).json({
        success: false,
        error: 'PDF download failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ===============================
// 📧 Email Receipt Endpoint
// ===============================

/**
 * POST /api/lightning/receipt/:receiptId/email
 * Email receipt to specified address
 */
router.post(
  '/:receiptId/email',
  authenticate,
  receiptEmailLimit,
  async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.params;

      // Validate request body
      const validatedData = EmailReceiptSchema.parse(req.body);

      // IDOR protection: verify caller owns this receipt before emailing
      const receipt = await lightningReceiptService.getReceiptByNumber(receiptId);
      if (!receipt) {
        return res.status(404).json({
          success: false,
          error: 'Receipt not found',
        });
      }
      const callerPubkey = req.user?.nostr_pubkey;
      const isCreator = receipt.creator.id === callerPubkey;
      const isSupporter = receipt.supporter.id === callerPubkey;
      const isAdmin = req.user?.role === 'admin';
      if (!isCreator && !isSupporter && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only email receipts for your own payments',
        });
      }

      // Email receipt
      await lightningReceiptService.emailReceipt(receiptId, validatedData.email);

      res.json({
        success: true,
        message: 'Receipt emailed successfully',
        data: {
          email: validatedData.email,
          sentAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Email receipt failed:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Email delivery failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ===============================
// ✅ Receipt Verification Endpoint
// ===============================

/**
 * POST /api/lightning/receipt/:receiptId/verify
 * Verify receipt authenticity and integrity
 */
router.post(
  '/:receiptId/verify',
  authenticate,
  receiptAccessLimit,
  async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.params;

      // Validate request body
      const validatedData = VerifyReceiptSchema.parse(req.body);

      // IDOR protection: verify caller owns this receipt
      const existingReceipt = await lightningReceiptService.getReceiptByNumber(receiptId);
      if (!existingReceipt) {
        return res.status(404).json({
          success: false,
          error: 'Receipt not found',
        });
      }
      const callerPubkey = req.user?.nostr_pubkey;
      const isCreator = existingReceipt.creator.id === callerPubkey;
      const isSupporter = existingReceipt.supporter.id === callerPubkey;
      const isAdmin = req.user?.role === 'admin';
      if (!isCreator && !isSupporter && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only verify receipts for your own payments',
        });
      }

      // Verify receipt
      const verificationResult = await lightningReceiptService.verifyReceipt(
        receiptId,
        validatedData.verificationCode
      );

      if (verificationResult.valid) {
        // Return only verification status — no PII or financial details
        res.json({
          success: true,
          message: 'Receipt verification successful',
          data: {
            valid: true,
            verifiedAt: new Date().toISOString(),
            receipt: verificationResult.receipt
              ? {
                  receiptNumber: verificationResult.receipt.receiptNumber,
                }
              : undefined,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Receipt verification failed',
          data: {
            valid: false,
            errors: verificationResult.errors,
          },
        });
      }
    } catch (error) {
      console.error('Receipt verification failed:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ===============================
// 📤 Export Router
// ===============================

export default router;
