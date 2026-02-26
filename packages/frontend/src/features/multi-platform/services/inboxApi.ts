import apiClient from '@/services/api/apiClient';
import type { ApiResponse } from '../types';
import type {
  ReplyTemplate,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  BYOKSubmitPayload,
  BYOKValidationResult,
} from '../types/inbox';
import type { InboxMessage, DistributionPagination } from '@sovren/shared/types/distribution';

const INBOX_BASE = '/api/v2/inbox';
const BYOK_BASE = '/api/v2/platforms/byok';

export const inboxApi = {
  // -- Messages --

  getMessages(params: {
    platform?: string;
    sentiment?: string;
    priority?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ messages: InboxMessage[]; pagination: DistributionPagination }>> {
    return apiClient.get(`${INBOX_BASE}/messages`, params);
  },

  replyToMessage(messageId: string, content: string): Promise<ApiResponse<void>> {
    return apiClient.post(`${INBOX_BASE}/reply/${messageId}`, { content });
  },

  batchAction(params: {
    message_ids: string[];
    action: 'mark_read' | 'mark_unread' | 'archive';
  }): Promise<ApiResponse<{ affected: number }>> {
    return apiClient.put(`${INBOX_BASE}/batch`, params);
  },

  // -- Templates --

  getTemplates(): Promise<ApiResponse<ReplyTemplate[]>> {
    return apiClient.get(`${INBOX_BASE}/templates`);
  },

  createTemplate(data: CreateTemplatePayload): Promise<ApiResponse<ReplyTemplate>> {
    return apiClient.post(`${INBOX_BASE}/templates`, data);
  },

  updateTemplate(id: string, data: UpdateTemplatePayload): Promise<ApiResponse<ReplyTemplate>> {
    return apiClient.put(`${INBOX_BASE}/templates/${id}`, data);
  },

  deleteTemplate(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`${INBOX_BASE}/templates/${id}`);
  },

  // -- BYOK --

  submitBYOK(data: BYOKSubmitPayload): Promise<ApiResponse<BYOKValidationResult>> {
    return apiClient.post(`${BYOK_BASE}/twitter`, data);
  },

  validateBYOK(): Promise<ApiResponse<BYOKValidationResult>> {
    return apiClient.get(`${BYOK_BASE}/twitter/status`);
  },

  revokeBYOK(): Promise<ApiResponse<void>> {
    return apiClient.delete(`${BYOK_BASE}/twitter`);
  },
};
