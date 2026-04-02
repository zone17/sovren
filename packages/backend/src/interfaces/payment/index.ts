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
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Money {
  amount: number;
  currency: string;
  constructor(amount: any, currency?: any) {
    this.amount = Number(amount) || 0;
    this.currency = String(currency || 'USD');
  }
  add(other: any): any {
    return new Money((this.amount || 0) + (other?.amount || 0), this.currency);
  }
  subtract(other: any): any {
    return new Money((this.amount || 0) - (other?.amount || 0), this.currency);
  }
  multiply(factor: any): any {
    return new Money((this.amount || 0) * (Number(factor) || 0), this.currency);
  }
  isZero(): boolean {
    return this.amount === 0;
  }
  isNegative(): boolean {
    return this.amount < 0;
  }
  toObject(): any {
    return { amount: this.amount, currency: this.currency };
  }
  toString(): string {
    return `${this.amount} ${this.currency}`;
  }
  [key: string]: any;
}
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
