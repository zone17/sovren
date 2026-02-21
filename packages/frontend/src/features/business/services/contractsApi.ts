import apiClient from '@/services/api/apiClient';
import type { ApiResponse, CreateContractPayload, UpdateContractPayload } from '../types';
import type { Contract, ContractTemplate, RedFlag } from '@shared/types/finance';

const BASE = '/api/v2/business/contracts';

export const contractsApi = {
  getTemplates(): Promise<ApiResponse<ContractTemplate[]>> {
    return apiClient['request']('GET', `${BASE}/templates`);
  },

  getTemplate(id: string): Promise<ApiResponse<ContractTemplate>> {
    return apiClient['request']('GET', `${BASE}/templates/${id}`);
  },

  getContracts(): Promise<ApiResponse<Contract[]>> {
    return apiClient['request']('GET', BASE);
  },

  createContract(data: CreateContractPayload): Promise<ApiResponse<Contract>> {
    return apiClient['request']('POST', BASE, data);
  },

  updateContract(id: string, data: UpdateContractPayload): Promise<ApiResponse<Contract>> {
    return apiClient['request']('PUT', `${BASE}/${id}`, data);
  },

  analyzeContract(text: string): Promise<ApiResponse<RedFlag[]>> {
    return apiClient['request']('POST', `${BASE}/analyze`, { text });
  },
};
