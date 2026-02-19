/**
 * Marketplace Service Interface
 * EPIC-010: Creator Network — Service marketplace with Lightning escrow
 */

export interface MarketplaceListing {
  id: string;
  creator_id: string;
  service_type: string;
  title: string;
  description: string | null;
  price_sats: number;
  portfolio_urls: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  amount_sats: number;
  created_at: string;
}

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
  getListing(listingId: string): Promise<MarketplaceListing | null>;
  getListings(
    filters?: { serviceType?: string; active?: boolean },
    pagination?: { page: number; limit: number }
  ): Promise<{ items: MarketplaceListing[]; total: number }>;
  updateListing(
    listingId: string,
    creatorId: string,
    data: {
      title?: string;
      description?: string;
      priceSats?: number;
      portfolioUrls?: string[];
      active?: boolean;
    }
  ): Promise<void>;
  deleteListing(listingId: string, creatorId: string): Promise<void>;
  getOrders(
    userId: string,
    role: 'buyer' | 'seller',
    pagination?: { page: number; limit: number }
  ): Promise<{ items: MarketplaceOrder[]; total: number }>;
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
