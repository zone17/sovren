/**
 * Community Types — EPIC-010: Creator Network
 * Shared type definitions for Circles, Mentorship, Collaboration, Marketplace
 */

// Circle types
export interface Circle {
  id: string;
  name: string;
  description?: string;
  niche?: string;
  maxMembers: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CircleMember {
  id: string;
  circleId: string;
  creatorId: string;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface CirclePost {
  id: string;
  circleId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

// Mentorship types
export interface MentorProfile {
  id: string;
  creatorId: string;
  niche: string;
  audienceSizeRange: '0-1k' | '1k-10k' | '10k-100k' | '100k+';
  bio?: string;
  maxMentees: number;
  active: boolean;
  createdAt: string;
}

export interface Mentorship {
  id: string;
  mentorId: string;
  menteeId: string;
  niche?: string;
  goals: string[];
  status: 'pending' | 'active' | 'completed' | 'declined';
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// Collaboration types
export interface ContentCollaborator {
  id: string;
  contentId: string;
  creatorId: string;
  revenueSplitBps: number;
  status: 'invited' | 'accepted' | 'declined' | 'removed';
  invitedAt: string;
  acceptedAt?: string;
}

// Marketplace types
export type ServiceType = 'editing' | 'writing' | 'design' | 'consulting' | 'other';

export interface ServiceListing {
  id: string;
  creatorId: string;
  serviceType: ServiceType;
  title: string;
  description?: string;
  priceSats: number;
  portfolioUrls: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'escrow_funded'
  | 'in_progress'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'expired';

export interface ServiceOrder {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  status: OrderStatus;
  escrowInvoiceId?: string;
  escrowPaymentHash?: string;
  amountSats: number;
  idempotencyKey: string;
  // #286: Fields added by epic010_security_hardening migration
  // #308: Aligned with DB CHECK constraint and MarketplaceService usage
  releaseStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'permanently_failed';
  releaseAttempts?: number;
  createdAt: string;
  fundedAt?: string;
  completedAt?: string;
  disputedAt?: string;
  expiresAt: string;
}

export interface OrderReview {
  id: string;
  orderId: string;
  reviewerId: string;
  rating: number;
  reviewText?: string;
  createdAt: string;
}
