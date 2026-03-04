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
  SignProvenanceBody,
} from '../types';

const BASE = '/api/v2/shield';

export const shieldApi = {
  // -- Provenance --

  getProvenance(contentId: string): Promise<ApiResponse<ProvenanceData>> {
    return apiClient.get(`${BASE}/provenance/${contentId}`);
  },

  signProvenance(body: SignProvenanceBody): Promise<ApiResponse<ProvenanceData>> {
    return apiClient.post(`${BASE}/provenance/sign`, body);
  },

  revokeProvenance(
    contentId: string
  ): Promise<ApiResponse<{ content_id: string; status: string; revoked_at: string }>> {
    return apiClient.post(`${BASE}/provenance/${contentId}/revoke`);
  },

  getCertificate(contentId: string): Promise<ApiResponse<{ certificate: unknown }>> {
    return apiClient.get(`${BASE}/provenance/${contentId}/certificate`);
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

  createFingerprint(body: {
    content_id: string;
    content_type: 'text' | 'image';
    content_data: string;
  }): Promise<ApiResponse<unknown>> {
    return apiClient.post(`${BASE}/fingerprint`, body);
  },

  compareFingerprints(body: {
    hash_type: 'simhash' | 'phash';
    hash_value: string;
    threshold?: number;
  }): Promise<ApiResponse<unknown>> {
    return apiClient.post(`${BASE}/compare`, body);
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
};
