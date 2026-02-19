/**
 * Contract Service
 * EPIC-011: Business Manager — Contract templates and red flag analysis
 */

import type { IContractService } from '../../interfaces/finance/IContractService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ContractTemplate, Contract } from '@shared/types/finance';
import { ConflictError } from '../../utils/errors';

type RedFlagType = 'exclusivity' | 'perpetual' | 'delayed_payment' | 'ip_assignment';

interface RedFlagMatch {
  type: string;
  match: string;
  severity: string;
  suggestion: string;
}

const RED_FLAG_PATTERNS: Record<RedFlagType, RegExp[]> = {
  exclusivity: [/exclusive/i, /sole\s+right/i, /non-compete/i],
  perpetual: [/perpetuity/i, /perpetual/i, /irrevocable/i, /in\s+perpetuity/i],
  delayed_payment: [/net\s+(6[1-9]|[7-9]\d|\d{3,})/i, /within\s+(6[1-9]|[7-9]\d|\d{3,})\s+days/i],
  ip_assignment: [/assign.*intellectual\s+property/i, /transfer.*copyright/i, /work\s+for\s+hire/i],
};

// #277: Align severity values with shared RedFlag type ('high'|'medium'|'low')
const RED_FLAG_SEVERITY: Record<RedFlagType, 'high' | 'medium' | 'low'> = {
  exclusivity: 'high',
  perpetual: 'high',
  delayed_payment: 'medium',
  ip_assignment: 'high',
};

const RED_FLAG_SUGGESTIONS: Record<RedFlagType, string> = {
  exclusivity:
    'Consider negotiating a limited exclusivity window (e.g., 30-90 days) rather than broad exclusivity.',
  perpetual:
    'Avoid perpetual licenses. Negotiate for a fixed term (e.g., 2 years) with renewal options.',
  delayed_payment: 'Payment terms beyond 60 days are unusual. Request Net-30 or Net-45 terms.',
  ip_assignment:
    'IP assignment transfers ownership. Negotiate for a license grant instead of full assignment.',
};

// #323: Row type interfaces for typed .from<T>() calls
interface ContractTemplateRow {
  id: string;
  created_by: string | null;
  name: string;
  category: string;
  template_text: string;
  created_at: string;
}

interface ContractRow {
  id: string;
  creator_id: string;
  template_id: string | null;
  counterparty: string;
  filled_text: string;
  status: string;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export class ContractService implements IContractService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async getTemplates(category?: string): Promise<ContractTemplate[]> {
    this.logger.info('ContractService.getTemplates', { category });

    let query = this.db
      .from<ContractTemplateRow>('contract_templates')
      .select('id, name, category, template_text, created_at');
    if (category) {
      query = query.eq('category', category);
    }

    // #278: Add default limit to prevent unbounded result sets
    const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
    if (error) {
      this.logger.error('Failed to fetch contract templates', { error, category });
      throw new Error('Failed to fetch contract templates');
    }
    return data ?? [];
  }

  async getTemplate(templateId: string): Promise<ContractTemplate> {
    this.logger.info('ContractService.getTemplate', { templateId });

    const { data, error } = await this.db
      .from<ContractTemplateRow>('contract_templates')
      .select('id, name, category, template_text, created_at')
      .eq('id', templateId)
      .single();

    if (error) {
      this.logger.error('Failed to fetch contract template', { error, templateId });
      throw new Error('Failed to fetch contract template');
    }
    if (!data) throw new Error(`Template not found: ${templateId}`);
    return data;
  }

  /** M-2: User-created template — sets created_by so RLS restricts visibility to the creator */
  async createTemplate(
    creatorId: string,
    data: { name: string; category: string; templateText: string }
  ): Promise<{ id: string }> {
    this.logger.info('ContractService.createTemplate', { creatorId, name: data.name });

    const { data: inserted, error } = await this.db
      .from<ContractTemplateRow>('contract_templates')
      .insert({
        created_by: creatorId,
        name: data.name,
        category: data.category,
        template_text: data.templateText,
      })
      .select('id')
      .single();

    if (error) {
      this.logger.error('Failed to create contract template', { error, creatorId });
      throw new Error('Failed to create contract template');
    }
    if (!inserted) throw new Error('Failed to create template');
    return { id: inserted.id };
  }

  async createContract(
    creatorId: string,
    data: { templateId?: string; counterparty: string; filledText: string }
  ): Promise<{ id: string }> {
    this.logger.info('ContractService.createContract', {
      creatorId,
      counterparty: data.counterparty,
    });

    const row: Partial<ContractRow> = {
      creator_id: creatorId,
      counterparty: data.counterparty,
      filled_text: data.filledText,
      status: 'draft',
    };
    if (data.templateId) row.template_id = data.templateId;

    const { data: inserted, error } = await this.db
      .from<ContractRow>('contracts')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      this.logger.error('Failed to create contract', { error, creatorId });
      throw new Error('Failed to create contract');
    }
    if (!inserted) throw new Error('Failed to create contract');
    return { id: inserted.id };
  }

  async getContracts(creatorId: string): Promise<Contract[]> {
    this.logger.info('ContractService.getContracts', { creatorId });

    // #278: Add default limit to prevent unbounded result sets
    const { data, error } = await this.db
      .from<ContractRow>('contracts')
      .select(
        'id, creator_id, template_id, counterparty, filled_text, status, signed_at, created_at, updated_at, contract_templates(name, category)'
      )
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      this.logger.error('Failed to fetch contracts', { error, creatorId });
      throw new Error('Failed to fetch contracts');
    }
    return data ?? [];
  }

  async updateContract(
    contractId: string,
    creatorId: string,
    data: { filledText?: string; status?: string }
  ): Promise<void> {
    this.logger.info('ContractService.updateContract', { contractId, creatorId });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.filledText !== undefined) updates.filled_text = data.filledText;
    if (data.status !== undefined) updates.status = data.status;
    if (data.status === 'signed') updates.signed_at = new Date().toISOString();

    const { error } = await this.db
      .from<ContractRow>('contracts')
      .update(updates)
      .eq('id', contractId)
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to update contract', { error, contractId, creatorId });
      throw new Error('Failed to update contract');
    }
  }

  async analyzeRedFlags(text: string): Promise<RedFlagMatch[]> {
    this.logger.info('ContractService.analyzeRedFlags', { textLength: text.length });

    const findings: RedFlagMatch[] = [];

    for (const [flagType, patterns] of Object.entries(RED_FLAG_PATTERNS) as [
      RedFlagType,
      RegExp[],
    ][]) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          findings.push({
            type: flagType,
            match: match[0],
            severity: RED_FLAG_SEVERITY[flagType],
            suggestion: RED_FLAG_SUGGESTIONS[flagType],
          });
          break; // one finding per flag type
        }
      }
    }

    return findings;
  }

  async deleteContract(contractId: string, creatorId: string): Promise<void> {
    this.logger.info('ContractService.deleteContract', { contractId, creatorId });

    // #360: Status guard — only draft contracts can be deleted
    const { data: contract, error: fetchError } = await this.db
      .from<ContractRow>('contracts')
      .select('id, status')
      .eq('id', contractId)
      .eq('creator_id', creatorId)
      .single();

    if (fetchError || !contract) {
      throw new Error(`Contract not found: ${contractId}`);
    }

    if (contract.status !== 'draft') {
      throw new ConflictError(
        `Cannot delete contract with status '${contract.status}'. Only draft contracts can be deleted.`
      );
    }

    const { error } = await this.db
      .from<ContractRow>('contracts')
      .delete()
      .eq('id', contractId)
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to delete contract', { error, contractId, creatorId });
      throw new Error('Failed to delete contract');
    }
  }

  async deleteTemplate(templateId: string, creatorId: string): Promise<void> {
    this.logger.info('ContractService.deleteTemplate', { templateId, creatorId });

    const { error } = await this.db
      .from<ContractTemplateRow>('contract_templates')
      .delete()
      .eq('id', templateId)
      .eq('created_by', creatorId);

    if (error) {
      this.logger.error('Failed to delete template', { error, templateId, creatorId });
      throw new Error('Failed to delete template');
    }
  }
}
