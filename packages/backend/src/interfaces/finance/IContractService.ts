/**
 * Contract Service Interface
 * EPIC-011: Business Manager — Contract templates and red flag analysis
 * #276: Typed return values instead of any[]
 */

import type { ContractTemplate, Contract, RedFlag } from '@shared/types/finance';

export interface IContractService {
  getTemplates(category?: string): Promise<ContractTemplate[]>;
  getTemplate(templateId: string): Promise<ContractTemplate>;
  /** M-2: User-created templates; sets created_by = creatorId so RLS restricts to owner */
  createTemplate(
    creatorId: string,
    data: { name: string; category: string; templateText: string }
  ): Promise<{ id: string }>;
  createContract(
    creatorId: string,
    data: { templateId?: string; counterparty: string; filledText: string }
  ): Promise<{ id: string }>;
  getContracts(creatorId: string): Promise<Contract[]>;
  updateContract(
    contractId: string,
    creatorId: string,
    data: { filledText?: string; status?: string }
  ): Promise<void>;
  analyzeRedFlags(text: string): Promise<RedFlag[]>;
}
