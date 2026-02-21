/**
 * Collaborative Content Service
 * EPIC-010: Creator Network — Co-authoring with revenue splits (basis points)
 *
 * Key design decisions:
 * - Revenue splits stored as basis points (0-10000) to avoid floating-point rounding
 * - Two-layer validation: DB trigger blocks sum >10000, service enforces sum =10000
 * - Largest-remainder algorithm for sat allocation (prevents rounding loss)
 * - NIP-17 encrypted DMs for collaboration invitations to NOSTR users
 *
 * Security decisions:
 * - C-6: Revenue split ledger pattern — record intent BEFORE payments, process per-coauthor
 *   with retry. revenue_split_ledger + revenue_split_payments tables.
 * - L-3: Audit log on every revenue split change for dispute resolution
 */

import type { ICollaborativeContentService } from '../../interfaces/community/ICollaborativeContentService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';

interface CollaboratorRow {
  id: string;
  content_id: string;
  creator_id: string;
  revenue_split_bps: number;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

interface ContentRow {
  id: string;
  creator_id: string;
}

interface LedgerRow {
  id: string;
  content_id: string;
  initiated_by: string;
  total_sats: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface SplitPaymentRow {
  id: string;
  ledger_id: string;
  creator_id: string;
  amount_sats: number;
  status: string;
  attempts: number;
  lightning_payment_hash: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * Largest-remainder algorithm for sat allocation.
 * Guarantees total output == totalSats with no rounding loss.
 */
function allocateSats(totalSats: number, splitsBps: number[]): number[] {
  const exact = splitsBps.map((bps) => (totalSats * bps) / 10000);
  const floored = exact.map(Math.floor);
  const remainder = totalSats - floored.reduce((a, b) => a + b, 0);
  const fractions = exact.map((e, i) => ({ i, frac: e - floored[i] }));
  fractions.sort((a, b) => b.frac - a.frac);
  for (let j = 0; j < remainder; j++) {
    floored[fractions[j].i]++;
  }
  return floored;
}

export class CollaborativeContentService implements ICollaborativeContentService {
  private readonly db: ISupabaseClient;
  private readonly logger: ILogger;

  constructor(db: ISupabaseClient, logger: ILogger) {
    this.db = db;
    this.logger = logger;
  }

  async inviteCollaborator(
    contentId: string,
    ownerId: string,
    collaboratorId: string,
    revenueSplitBps: number
  ): Promise<{ id: string }> {
    if (ownerId === collaboratorId) {
      throw new Error('Cannot invite yourself as a collaborator');
    }

    if (!Number.isInteger(revenueSplitBps) || revenueSplitBps <= 0 || revenueSplitBps > 10000) {
      throw new Error('revenue_split_bps must be an integer between 1 and 10000');
    }

    // Verify content ownership
    const { data: content, error: contentError } = await this.db
      .from<ContentRow>('content')
      .select('id, creator_id')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new Error('Content not found');
    }

    if (content.creator_id !== ownerId) {
      throw new Error('Only the content owner can invite collaborators');
    }

    // Check for existing active collaboration
    const { data: existing } = await this.db
      .from<CollaboratorRow>('content_collaborators')
      .select('id, status')
      .eq('content_id', contentId)
      .eq('creator_id', collaboratorId)
      .in('status', ['invited', 'accepted'])
      .maybeSingle();

    if (existing) {
      throw new Error(`Collaboration already exists with status: ${existing.status}`);
    }

    const { data: rows, error } = await this.db
      .from<CollaboratorRow>('content_collaborators')
      .insert({
        content_id: contentId,
        creator_id: collaboratorId,
        revenue_split_bps: revenueSplitBps,
        status: 'invited',
      })
      .select('id')
      .single();

    if (error || !rows) {
      // Check if DB trigger blocked due to sum exceeding 10000
      if (error?.message?.includes('exceed 10000 bps')) {
        throw new Error(
          `Cannot add collaborator: total revenue splits would exceed 100% (10000 bps). ${error.message}`
        );
      }
      this.logger.error('Failed to invite collaborator', { error, contentId, collaboratorId });
      throw new Error(`Failed to invite collaborator: ${error?.message}`);
    }

    this.logger.info('Collaborator invited', {
      collaborationId: rows.id,
      contentId,
      collaboratorId,
      revenueSplitBps,
    });
    return { id: rows.id };
  }

  async respondToInvitation(
    collaborationId: string,
    creatorId: string,
    accept: boolean
  ): Promise<void> {
    const { data: collab, error: findError } = await this.db
      .from<CollaboratorRow>('content_collaborators')
      .select('id, creator_id, status')
      .eq('id', collaborationId)
      .single();

    if (findError || !collab) {
      throw new Error('Collaboration not found');
    }

    if (collab.creator_id !== creatorId) {
      throw new Error('Only the invited collaborator can respond');
    }

    if (collab.status !== 'invited') {
      throw new Error(`Cannot respond to collaboration in '${collab.status}' status`);
    }

    const newStatus = accept ? 'accepted' : 'declined';
    const updates: Partial<CollaboratorRow> = accept
      ? { status: newStatus, accepted_at: new Date().toISOString() }
      : { status: newStatus };

    const { error } = await this.db
      .from<CollaboratorRow>('content_collaborators')
      .update(updates)
      .eq('id', collaborationId)
      .eq('status', 'invited'); // Atomic status guard

    if (error) {
      this.logger.error('Failed to respond to invitation', { error, collaborationId, accept });
      throw new Error(`Failed to respond to invitation: ${error.message}`);
    }

    this.logger.info('Collaboration invitation responded', { collaborationId, accept, newStatus });
  }

  /**
   * L-3: Audit log on every revenue split change.
   * Logs before/after state for dispute resolution purposes.
   */
  async updateRevenueSplit(
    contentId: string,
    ownerId: string,
    splits: Array<{ creatorId: string; bps: number }>
  ): Promise<void> {
    // Verify content ownership
    const { data: content, error: contentError } = await this.db
      .from<ContentRow>('content')
      .select('id, creator_id')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      throw new Error('Content not found');
    }

    if (content.creator_id !== ownerId) {
      throw new Error('Only the content owner can update revenue splits');
    }

    // Service-layer validation: sum must equal exactly 10000 bps
    const totalBps = splits.reduce((sum, s) => sum + s.bps, 0);
    if (totalBps !== 10000) {
      throw new Error(
        `Revenue splits must sum to exactly 10000 bps (100%). Current sum: ${totalBps} bps`
      );
    }

    // Validate each split is a valid integer
    for (const split of splits) {
      if (!Number.isInteger(split.bps) || split.bps <= 0 || split.bps > 10000) {
        throw new Error(`Invalid bps value ${split.bps} for creator ${split.creatorId}`);
      }
    }

    // L-3: Capture the BEFORE state for audit log
    const { data: beforeState } = await this.db
      .from<CollaboratorRow>('content_collaborators')
      .select('creator_id, revenue_split_bps')
      .eq('content_id', contentId)
      .in('status', ['invited', 'accepted']);

    // #317: Atomic RPC replaces non-atomic loop of individual updates.
    // update_revenue_split_atomic deletes + re-inserts all splits in one transaction.
    const { error } = await this.db.rpc('update_revenue_split_atomic', {
      p_content_id: contentId,
      p_splits: splits.map((s) => ({ creator_id: s.creatorId, bps: s.bps })),
    });

    if (error) {
      this.logger.error('Failed to update revenue splits atomically', { error, contentId });
      throw new Error(`Failed to update revenue splits: ${error.message}`);
    }

    // L-3: Emit structured audit log with before/after state for dispute resolution
    this.logger.info('Revenue splits updated — audit trail', {
      audit: true,
      contentId,
      updatedBy: ownerId,
      before: (beforeState ?? []).map((r) => ({
        creatorId: r.creator_id,
        bps: r.revenue_split_bps,
      })),
      after: splits.map((s) => ({ creatorId: s.creatorId, bps: s.bps })),
      changedAt: new Date().toISOString(),
    });
  }

  async getCollaborators(contentId: string, requesterId: string): Promise<CollaboratorRow[]> {
    const { data, error } = await this.db
      .from<CollaboratorRow>('content_collaborators')
      .select('id, content_id, creator_id, revenue_split_bps, status, invited_at, accepted_at')
      .eq('content_id', contentId)
      .not('status', 'in', '("removed")')
      .order('invited_at', { ascending: true });

    if (error) {
      this.logger.error('Failed to get collaborators', { error, contentId, requesterId });
      throw new Error(`Failed to get collaborators: ${error.message}`);
    }

    return data ?? [];
  }

  async allocateRevenue(
    contentId: string,
    totalSats: number
  ): Promise<Array<{ creatorId: string; amountSats: number }>> {
    if (totalSats <= 0 || !Number.isInteger(totalSats)) {
      throw new Error('totalSats must be a positive integer');
    }

    // Get all accepted collaborators
    const { data: collaborators, error } = await this.db
      .from<CollaboratorRow>('content_collaborators')
      .select('creator_id, revenue_split_bps')
      .eq('content_id', contentId)
      .eq('status', 'accepted');

    if (error) {
      this.logger.error('Failed to get collaborators for revenue allocation', { error, contentId });
      throw new Error(`Failed to get collaborators: ${error.message}`);
    }

    if (!collaborators || collaborators.length === 0) {
      return [];
    }

    // Validate splits sum to 10000 bps
    const totalBps = collaborators.reduce((sum, c) => sum + c.revenue_split_bps, 0);
    if (totalBps !== 10000) {
      throw new Error(
        `Revenue splits do not sum to 10000 bps (sum=${totalBps}). Distribution cannot proceed until all splits are finalized.`
      );
    }

    // Apply largest-remainder algorithm for precise sat allocation
    const splitsBps = collaborators.map((c) => c.revenue_split_bps);
    const allocations = allocateSats(totalSats, splitsBps);

    const result = collaborators.map((c, i) => ({
      creatorId: c.creator_id,
      amountSats: allocations[i],
    }));

    this.logger.info('Revenue allocated', { contentId, totalSats, allocations: result });
    return result;
  }

  /**
   * C-6: Revenue split ledger pattern — atomic, auditable distribution.
   * Records the full intended split in revenue_split_ledger + revenue_split_payments
   * BEFORE any payments are initiated. Each payment row is processed independently
   * with retry support. This prevents partial distributions from being undetectable.
   *
   * Call allocateRevenue() to compute amounts, then this method to record intent.
   * Payment processing (Lightning payouts) happens in the BullMQ worker that
   * reads pending revenue_split_payments rows.
   */
  async recordRevenueSplitLedger(
    contentId: string,
    initiatedBy: string,
    allocations: Array<{ creatorId: string; amountSats: number }>
  ): Promise<{ ledgerId: string }> {
    const totalSats = allocations.reduce((sum, a) => sum + a.amountSats, 0);

    // C-6: Step 1 — Create ledger entry (records INTENT before any payment)
    const { data: ledger, error: ledgerError } = await this.db
      .from<LedgerRow>('revenue_split_ledger')
      .insert({
        content_id: contentId,
        initiated_by: initiatedBy,
        total_sats: totalSats,
        status: 'pending',
      })
      .select('id')
      .single();

    if (ledgerError || !ledger) {
      this.logger.error('Failed to create revenue split ledger', { error: ledgerError, contentId });
      throw new Error(`Failed to create revenue split ledger: ${ledgerError?.message}`);
    }

    // C-6: Step 2 — Create one payment row per collaborator (all pending)
    const paymentRows = allocations.map((a) => ({
      ledger_id: ledger.id,
      creator_id: a.creatorId,
      amount_sats: a.amountSats,
      status: 'pending' as const,
      attempts: 0,
    }));

    const { error: paymentsError } = await this.db
      .from<SplitPaymentRow>('revenue_split_payments')
      .insert(paymentRows);

    if (paymentsError) {
      // Ledger was created but payments failed — mark ledger as failed for reconciliation
      await this.db
        .from<LedgerRow>('revenue_split_ledger')
        .update({ status: 'failed' })
        .eq('id', ledger.id);

      this.logger.error('Failed to create split payment rows — ledger marked failed', {
        error: paymentsError,
        ledgerId: ledger.id,
        contentId,
      });
      throw new Error(`Failed to record split payments: ${paymentsError.message}`);
    }

    this.logger.info('Revenue split ledger recorded', {
      ledgerId: ledger.id,
      contentId,
      initiatedBy,
      totalSats,
      recipientCount: allocations.length,
    });

    return { ledgerId: ledger.id };
  }
}
