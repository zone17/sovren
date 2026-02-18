/**
 * Contract Service
 * EPIC-011: Business Manager — Contract templates and red flag analysis
 */

import type { IContractService } from '../../interfaces/finance/IContractService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';

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
  delayed_payment: [
    /net\s+(6[1-9]|[7-9]\d|\d{3,})/i,
    /within\s+(6[1-9]|[7-9]\d|\d{3,})\s+days/i,
  ],
  ip_assignment: [
    /assign.*intellectual\s+property/i,
    /transfer.*copyright/i,
    /work\s+for\s+hire/i,
  ],
};

const RED_FLAG_SEVERITY: Record<RedFlagType, 'warning' | 'critical'> = {
  exclusivity: 'critical',
  perpetual: 'critical',
  delayed_payment: 'warning',
  ip_assignment: 'critical',
};

const RED_FLAG_SUGGESTIONS: Record<RedFlagType, string> = {
  exclusivity:
    'Consider negotiating a limited exclusivity window (e.g., 30-90 days) rather than broad exclusivity.',
  perpetual:
    'Avoid perpetual licenses. Negotiate for a fixed term (e.g., 2 years) with renewal options.',
  delayed_payment:
    'Payment terms beyond 60 days are unusual. Request Net-30 or Net-45 terms.',
  ip_assignment:
    'IP assignment transfers ownership. Negotiate for a license grant instead of full assignment.',
};

export class ContractService implements IContractService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async getTemplates(category?: string): Promise<any[]> {
    this.logger.info('ContractService.getTemplates', { category });

    let query = this.db.from('contract_templates').select('*');
    if (category) {
      query = (query as any).eq('category', category);
    }

    const { data, error } = await (query as any).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getTemplate(templateId: string): Promise<any> {
    this.logger.info('ContractService.getTemplate', { templateId });

    const { data, error } = await this.db
      .from('contract_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw error;
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
      .from('contract_templates')
      .insert({
        created_by: creatorId,
        name: data.name,
        category: data.category,
        template_text: data.templateText,
      })
      .select('id')
      .single();

    if (error) throw error;
    if (!inserted) throw new Error('Failed to create template');
    return { id: (inserted as any).id };
  }

  async createContract(
    creatorId: string,
    data: { templateId?: string; counterparty: string; filledText: string }
  ): Promise<{ id: string }> {
    this.logger.info('ContractService.createContract', { creatorId, counterparty: data.counterparty });

    const row: Record<string, unknown> = {
      creator_id: creatorId,
      counterparty: data.counterparty,
      filled_text: data.filledText,
      status: 'draft',
    };
    if (data.templateId) row.template_id = data.templateId;

    const { data: inserted, error } = await this.db
      .from('contracts')
      .insert(row)
      .select('id')
      .single();

    if (error) throw error;
    if (!inserted) throw new Error('Failed to create contract');
    return { id: (inserted as any).id };
  }

  async getContracts(creatorId: string): Promise<any[]> {
    this.logger.info('ContractService.getContracts', { creatorId });

    const { data, error } = await this.db
      .from('contracts')
      .select('*, contract_templates(name, category)')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
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
      .from('contracts')
      .update(updates)
      .eq('id', contractId)
      .eq('creator_id', creatorId);

    if (error) throw error;
  }

  async analyzeRedFlags(text: string): Promise<RedFlagMatch[]> {
    this.logger.info('ContractService.analyzeRedFlags', { textLength: text.length });

    const findings: RedFlagMatch[] = [];

    for (const [flagType, patterns] of Object.entries(RED_FLAG_PATTERNS) as [RedFlagType, RegExp[]][]) {
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
}
