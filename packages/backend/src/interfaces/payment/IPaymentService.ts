/**
 * Payment Service Interface
 * Core payment processing and invoice management
 * Part of Epic 005 - Backend Service Refactoring
 */

import { Currency } from '@/types/payment';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  LIGHTNING = 'lightning',
  ONCHAIN = 'onchain',
  LNURL = 'lnurl',
  WEBLN = 'webln',
  KEYSEND = 'keysend',
}

export interface Invoice {
  id: string;
  userId: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  paymentRequest: string;
  paymentHash: string;
  description?: string;
  expiresAt: Date;
  createdAt: Date;
  paidAt?: Date;
  metadata?: Record<string, any>;
}

export interface CreateInvoiceParams {
  userId: string;
  amount: number;
  currency: Currency;
  description?: string;
  expiresIn?: number; // seconds
  metadata?: Record<string, any>;
}

export interface ProcessPaymentParams {
  invoiceId: string;
  paymentRequest: string;
  method: PaymentMethod;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  timestamp: Date;
}

export interface PaymentVerification {
  valid: boolean;
  paymentHash: string;
  preimage?: string;
  amountPaid?: number;
  confirmedAt?: Date;
}

export interface RefundParams {
  transactionId: string;
  amount?: number; // partial refund if specified
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  error?: string;
}

export interface PaymentEvent {
  type: 'received' | 'failed' | 'refunded';
  invoiceId: string;
  userId: string;
  amount: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type PaymentCallback = (event: PaymentEvent) => void | Promise<void>;

/**
 * Core payment service interface
 * Handles Lightning Network payments, invoices, and refunds
 */
export interface IPaymentService {
  // Invoice Management
  createInvoice(params: CreateInvoiceParams): Promise<Invoice>;
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  getInvoiceByPaymentHash(paymentHash: string): Promise<Invoice | null>;
  cancelInvoice(invoiceId: string): Promise<void>;
  listUserInvoices(userId: string, limit?: number, offset?: number): Promise<Invoice[]>;

  // Payment Processing
  processPayment(params: ProcessPaymentParams): Promise<PaymentResult>;
  verifyPayment(paymentHash: string): Promise<PaymentVerification>;
  checkPaymentStatus(invoiceId: string): Promise<PaymentStatus>;

  // Refunds
  initiateRefund(params: RefundParams): Promise<RefundResult>;
  getRefundStatus(refundId: string): Promise<RefundResult>;

  // Payment History
  getPaymentHistory(userId: string, limit?: number, offset?: number): Promise<PaymentResult[]>;
  getPaymentsByDateRange(startDate: Date, endDate: Date): Promise<PaymentResult[]>;

  // Events
  onPaymentReceived(callback: PaymentCallback): void;
  onPaymentFailed(callback: PaymentCallback): void;
  onRefundProcessed(callback: PaymentCallback): void;

  // Cleanup
  removeEventListener(callback: PaymentCallback): void;
  dispose(): Promise<void>;
}
