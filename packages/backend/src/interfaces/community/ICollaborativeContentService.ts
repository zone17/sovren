/**
 * Collaborative Content Service Interface
 * EPIC-010: Creator Network — Co-authoring with revenue splits
 * #276: Typed return values instead of any[]
 */

import type { ContentCollaborator } from '@shared/types/community';

export interface ICollaborativeContentService {
  inviteCollaborator(
    contentId: string,
    ownerId: string,
    collaboratorId: string,
    revenueSplitBps: number
  ): Promise<{ id: string }>;
  respondToInvitation(collaborationId: string, creatorId: string, accept: boolean): Promise<void>;
  updateRevenueSplit(
    contentId: string,
    ownerId: string,
    splits: Array<{ creatorId: string; bps: number }>
  ): Promise<void>;
  getCollaborators(contentId: string, requesterId: string): Promise<ContentCollaborator[]>;
  allocateRevenue(
    contentId: string,
    totalSats: number
  ): Promise<Array<{ creatorId: string; amountSats: number }>>;
  recordRevenueSplitLedger(
    contentId: string,
    initiatedBy: string,
    allocations: Array<{ creatorId: string; amountSats: number }>
  ): Promise<{ ledgerId: string }>;
}
