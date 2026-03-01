export * from './IPaymentProcessingService';
export * from './ISubscriptionService';
export * from './IRefundService';
export * from './IPaymentAnalyticsService';
export * from './IWebhookService';
export * from './ICurrencyService';

// Re-export from IPaymentService but allow extending Invoice
export {
  PaymentStatus,
  PaymentMethod,
  CreateInvoiceParams,
  ProcessPaymentParams,
  PaymentResult,
  PaymentVerification,
  RefundParams,
  RefundResult,
  PaymentEvent,
  PaymentCallback,
  IPaymentService,
} from './IPaymentService';
export type { Invoice } from './IPaymentService';

// Additional types used by InvoiceService that don't exist in existing interfaces
export type Money = any;
export type InvoiceItem = any;
export type InvoiceDraft = any;
export type TaxCalculation = any;
export type SubscriptionChange = any;
export type ProrationResult = any;
export type Payment = any;
export type InvoiceMetrics = any;
export type Discount = any;
export type Subscription = any;
export type QueryOptions = any;
export type DateRange = any;

export interface IInvoiceService {
  [key: string]: any;
}
