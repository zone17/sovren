/**
 * Marketplace Service Interface
 * EPIC-010: Creator Network — Service marketplace with Lightning escrow
 */

export interface IMarketplaceService {
  createListing(
    creatorId: string,
    data: {
      serviceType: string;
      title: string;
      description?: string;
      priceSats: number;
      portfolioUrls?: string[];
    }
  ): Promise<{ id: string }>;
  getListings(filters?: { serviceType?: string; active?: boolean }): Promise<any[]>;
  placeOrder(
    buyerId: string,
    listingId: string,
    idempotencyKey: string
  ): Promise<{ id: string; invoicePaymentRequest: string }>;
  startOrder(orderId: string, sellerId: string): Promise<void>;
  completeOrder(orderId: string, buyerId: string): Promise<void>;
  disputeOrder(orderId: string, userId: string): Promise<void>;
  reviewOrder(
    orderId: string,
    reviewerId: string,
    data: { rating: number; reviewText?: string }
  ): Promise<{ id: string }>;
}
