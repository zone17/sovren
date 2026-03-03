import apiClient from '@/services/api/apiClient';
import type {
  AlertDetail,
  AlertStatus,
  ApiResponse,
  ContentAlert,
  DMCAReport,
  FingerprintCoverageData,
  PaginatedApiResponse,
  ProvenanceData,
  ReportFormat,
} from '../types';

const BASE = '/api/v2/shield';

// Sync with packages/backend/src/validators/shield.ts → SignProvenanceBodySchema
export interface SignProvenanceBody {
  content_id: string;
  content_body: string;
  nostr_event_id: string;
  signature: string;
  relays?: string[];
  event_created_at: number;
}

export const shieldApi = {
  // -- Provenance --

  getProvenance(contentId: string): Promise<ApiResponse<ProvenanceData>> {
    return apiClient.get(`${BASE}/provenance/${contentId}`);
  },

  // -- Fingerprints --

  getFingerprintCoverage(
    creatorId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedApiResponse<FingerprintCoverageData>> {
    return apiClient.get(`${BASE}/fingerprints/${creatorId}`, {
      page,
      limit,
    });
  },

  // -- Alerts --

  getAlerts(
    status: AlertStatus = 'new',
    page = 1,
    limit = 20
  ): Promise<PaginatedApiResponse<ContentAlert[]>> {
    return apiClient.get(`${BASE}/alerts`, { status, page, limit });
  },

  getAlertDetail(alertId: string): Promise<ApiResponse<AlertDetail>> {
    return apiClient.get(`${BASE}/alerts/${alertId}`);
  },

  updateAlertStatus(
    alertId: string,
    status: AlertStatus
  ): Promise<ApiResponse<{ id: string; status: AlertStatus; updated_at: string }>> {
    return apiClient.put(`${BASE}/alerts/${alertId}`, { status });
  },

  // -- DMCA Reports --

  generateDmcaReport(
    alertId: string,
    format: ReportFormat = 'json'
  ): Promise<ApiResponse<{ report: DMCAReport }>> {
    return apiClient.post(`${BASE}/alerts/${alertId}/dmca-report`, undefined, {
      format,
    });
  },

  // -- Provenance Signing --

  signProvenance(body: SignProvenanceBody): Promise<ApiResponse<{ signed: boolean }>> {
    return apiClient.post(`${BASE}/provenance/sign`, body);
  },
};
