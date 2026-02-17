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
    return apiClient['request']('GET', `${BASE}/provenance/${contentId}`);
  },

  // -- Fingerprints --

  getFingerprintCoverage(
    creatorId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedApiResponse<FingerprintCoverageData>> {
    return apiClient['request']('GET', `${BASE}/fingerprints/${creatorId}`, undefined, {
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
    return apiClient['request']('GET', `${BASE}/alerts`, undefined, { status, page, limit });
  },

  getAlertDetail(alertId: string): Promise<ApiResponse<AlertDetail>> {
    return apiClient['request']('GET', `${BASE}/alerts/${alertId}`);
  },

  updateAlertStatus(
    alertId: string,
    status: AlertStatus
  ): Promise<ApiResponse<{ id: string; status: AlertStatus; updated_at: string }>> {
    return apiClient['request']('PUT', `${BASE}/alerts/${alertId}`, { status });
  },

  // -- DMCA Reports --

  generateDmcaReport(
    alertId: string,
    format: ReportFormat = 'json'
  ): Promise<ApiResponse<{ report: DMCAReport }>> {
    return apiClient['request']('POST', `${BASE}/alerts/${alertId}/dmca-report`, undefined, {
      format,
    });
  },

  // -- DMCA Reports List --

  getDmcaReports(
    creatorId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedApiResponse<DMCAReport[]>> {
    return apiClient['request']('GET', `${BASE}/dmca/reports`, undefined, {
      creatorId,
      page,
      limit,
    });
  },

  // -- Provenance Verification --

  getProvenanceVerification(contentId: string): Promise<ApiResponse<ProvenanceData>> {
    return apiClient['request']('GET', `${BASE}/provenance/${contentId}`);
  },
};
