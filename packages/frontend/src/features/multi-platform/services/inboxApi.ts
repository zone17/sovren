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
    return apiClient['request']('GET', `${INBOX_BASE}/messages`, undefined, params);
  },

  replyToMessage(messageId: string, content: string): Promise<ApiResponse<void>> {
    return apiClient['request']('POST', `${INBOX_BASE}/reply/${messageId}`, { content });
  },

  batchAction(params: {
    message_ids: string[];
    action: 'mark_read' | 'mark_unread' | 'archive';
  }): Promise<ApiResponse<{ affected: number }>> {
    return apiClient['request']('PUT', `${INBOX_BASE}/batch`, params);
  },

  // -- Templates --

  getTemplates(): Promise<ApiResponse<ReplyTemplate[]>> {
    return apiClient['request']('GET', `${INBOX_BASE}/templates`);
  },

  createTemplate(data: CreateTemplatePayload): Promise<ApiResponse<ReplyTemplate>> {
    return apiClient['request']('POST', `${INBOX_BASE}/templates`, data);
  },

  updateTemplate(id: string, data: UpdateTemplatePayload): Promise<ApiResponse<ReplyTemplate>> {
    return apiClient['request']('PUT', `${INBOX_BASE}/templates/${id}`, data);
  },

  deleteTemplate(id: string): Promise<ApiResponse<void>> {
    return apiClient['request']('DELETE', `${INBOX_BASE}/templates/${id}`);
  },

  // -- BYOK --

  submitBYOK(data: BYOKSubmitPayload): Promise<ApiResponse<BYOKValidationResult>> {
    return apiClient['request']('POST', `${BYOK_BASE}/twitter`, data);
  },

  validateBYOK(): Promise<ApiResponse<BYOKValidationResult>> {
    return apiClient['request']('GET', `${BYOK_BASE}/twitter/status`);
  },

  revokeBYOK(): Promise<ApiResponse<void>> {
    return apiClient['request']('DELETE', `${BYOK_BASE}/twitter`);
  },
};
