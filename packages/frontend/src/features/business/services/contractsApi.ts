import apiClient from '@/services/api/apiClient';
import type { ApiResponse, CreateContractPayload, UpdateContractPayload } from '../types';
import type { Contract, ContractTemplate, PaginatedData, RedFlag } from '@shared/types/finance';

const BASE = '/api/v2/business/contracts';

export const contractsApi = {
  getTemplates(): Promise<ApiResponse<PaginatedData<ContractTemplate>>> {
    return apiClient.get(`${BASE}/templates`);
  },

  getTemplate(id: string): Promise<ApiResponse<ContractTemplate>> {
    return apiClient.get(`${BASE}/templates/${id}`);
  },

  getContracts(): Promise<ApiResponse<PaginatedData<Contract>>> {
    return apiClient.get(BASE);
  },

  createContract(data: CreateContractPayload): Promise<ApiResponse<Contract>> {
    return apiClient.post(BASE, data);
  },

  updateContract(id: string, data: UpdateContractPayload): Promise<ApiResponse<Contract>> {
    return apiClient.put(`${BASE}/${id}`, data);
  },

  analyzeContract(text: string): Promise<ApiResponse<RedFlag[]>> {
    return apiClient.post(`${BASE}/analyze`, { text });
  },
};
