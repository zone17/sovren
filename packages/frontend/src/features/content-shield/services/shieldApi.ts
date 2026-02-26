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
};
