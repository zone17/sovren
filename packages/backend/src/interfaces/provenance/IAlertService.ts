/**
 * IAlertService Interface
 * Alert CRUD and status transitions
 * EPIC-008: Content Shield
 */

import type { ContentAlert, AlertDetail, AlertStatus, Pagination } from '@shared/types/provenance';

export interface IAlertService {
  getAlerts(creatorId: string, status: AlertStatus, page: number, limit: number): Promise<{ data: ContentAlert[]; pagination: Pagination }>;
  getAlertDetail(creatorId: string, alertId: string): Promise<AlertDetail>;
  updateAlertStatus(creatorId: string, alertId: string, newStatus: AlertStatus): Promise<{ id: string; status: AlertStatus; updated_at: string }>;
}
