/**
 * Contract Service Interface
 * EPIC-011: Business Manager — Contract templates and red flag analysis
 */

export interface IContractService {
  getTemplates(category?: string): Promise<any[]>;
  getTemplate(templateId: string): Promise<any>;
  createContract(
    creatorId: string,
    data: { templateId?: string; counterparty: string; filledText: string }
  ): Promise<{ id: string }>;
  getContracts(creatorId: string): Promise<any[]>;
  updateContract(
    contractId: string,
    creatorId: string,
    data: { filledText?: string; status?: string }
  ): Promise<void>;
  analyzeRedFlags(
    text: string
  ): Promise<Array<{ type: string; match: string; severity: string; suggestion: string }>>;
}
