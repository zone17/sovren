import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlertDetail, useAlerts, useUpdateAlertStatus } from '../hooks/useAlerts';
import { useDmcaReport } from '../hooks/useDmcaReport';
import type { AlertStatus, ContentAlert, MatchLevel } from '../types';

const STATUS_TABS: AlertStatus[] = ['new', 'reviewed', 'resolved', 'false_positive', 'reported'];

const STATUS_COLORS: Record<AlertStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  false_positive: 'bg-gray-100 text-gray-600',
  reported: 'bg-red-100 text-red-700',
};

const MATCH_COLORS: Record<MatchLevel, string> = {
  exact_copy: 'bg-red-500',
  derivative: 'bg-orange-500',
  coincidental: 'bg-green-500',
};

const VALID_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  new: ['reviewed', 'false_positive'],
  reviewed: ['resolved', 'false_positive', 'reported'],
  reported: ['resolved'],
  resolved: [],
  false_positive: [],
};

// --- Alert Card ---

interface AlertCardProps {
  alert: ContentAlert;
  onSelect: (id: string) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, onSelect }) => (
  <button
    onClick={() => onSelect(alert.id)}
    className="w-full text-left p-4 border rounded-lg hover:shadow-sm transition-shadow"
    aria-label={`Alert: ${alert.original_title}, ${(alert.similarity_score * 100).toFixed(0)}% similar, status ${alert.status}`}
  >
    <div className="flex items-start justify-between mb-2">
      <h4 className="text-sm font-medium text-gray-800 line-clamp-1 flex-1">
        {alert.original_title}
      </h4>
      <Badge className={`${STATUS_COLORS[alert.status]} text-[10px] ml-2 shrink-0`}>
        {alert.status.replace('_', ' ')}
      </Badge>
    </div>

    <div className="flex items-center gap-3 mb-2">
      <div className="flex items-center gap-1 flex-1">
        <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${MATCH_COLORS[alert.match_level]}`}
            style={{ width: `${alert.similarity_score * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-600 shrink-0">
          {(alert.similarity_score * 100).toFixed(0)}%
        </span>
      </div>
    </div>

    <p className="text-[10px] text-gray-400">
      Detected {new Date(alert.detected_at).toLocaleDateString()} on {alert.relay}
    </p>
  </button>
);

// --- Alert Detail Panel ---

interface AlertDetailPanelProps {
  alertId: string;
  onClose: () => void;
}

const AlertDetailPanel: React.FC<AlertDetailPanelProps> = ({ alertId, onClose }) => {
  const { data, isLoading } = useAlertDetail(alertId);
  const updateStatus = useUpdateAlertStatus();
  const dmcaReport = useDmcaReport();

  if (isLoading || !data) {
    return (
      <div className="p-4 border rounded-lg space-y-4">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const transitions = VALID_TRANSITIONS[data.status];

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Alert Detail</h3>
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-7">
          Close
        </Button>
      </div>

      {/* Side by side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Original */}
        <div className="p-3 bg-green-50 rounded-lg">
          <h4 className="text-xs font-medium text-green-700 mb-2">Original</h4>
          <p className="text-sm font-medium text-gray-800 mb-1">{data.original.title}</p>
          <p className="text-xs text-gray-600 line-clamp-4">{data.original.excerpt}</p>
          <p className="text-[10px] text-gray-400 mt-2">
            Published {new Date(data.original.published_at).toLocaleDateString()}
          </p>
        </div>

        {/* Detected copy */}
        <div className="p-3 bg-red-50 rounded-lg">
          <h4 className="text-xs font-medium text-red-700 mb-2">Detected Copy</h4>
          <p className="text-xs text-gray-600 line-clamp-4">{data.detected.excerpt}</p>
          <p className="text-[10px] text-gray-400 mt-2">
            Published {new Date(data.detected.published_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Similarity */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${MATCH_COLORS[data.comparison.match_level]}`}
            style={{ width: `${data.comparison.similarity_score * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700">
          {(data.comparison.similarity_score * 100).toFixed(0)}% — {data.comparison.match_level.replace('_', ' ')}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {transitions.map((status) => (
          <Button
            key={status}
            variant="outline"
            size="sm"
            className="text-xs h-7"
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ alertId, status })}
          >
            Mark as {status.replace('_', ' ')}
          </Button>
        ))}

        {data.status === 'reviewed' && (
          <Button
            size="sm"
            className="text-xs h-7 bg-red-600 hover:bg-red-700"
            disabled={dmcaReport.isPending}
            onClick={() => dmcaReport.mutate({ alertId })}
          >
            {dmcaReport.isPending ? 'Generating...' : 'Generate DMCA Report'}
          </Button>
        )}
      </div>

      {dmcaReport.isSuccess && (
        <p className="text-xs text-green-600">DMCA report generated successfully.</p>
      )}
      {dmcaReport.isError && (
        <p className="text-xs text-red-600">Failed to generate DMCA report.</p>
      )}
    </div>
  );
};

// --- Main AlertsFeed ---

export const AlertsFeed: React.FC = () => {
  const [activeStatus, setActiveStatus] = useState<AlertStatus>('new');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { data: response, isLoading, error } = useAlerts(activeStatus, page);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Copy Detection Alerts</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((status) => (
            <button
              key={status}
              onClick={() => {
                setActiveStatus(status);
                setPage(1);
                setSelectedAlertId(null);
              }}
              className={`px-3 py-1.5 text-xs rounded whitespace-nowrap ${
                activeStatus === status
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              aria-pressed={activeStatus === status}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Selected alert detail */}
        {selectedAlertId && (
          <AlertDetailPanel
            alertId={selectedAlertId}
            onClose={() => setSelectedAlertId(null)}
          />
        )}

        {/* Alert list */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-gray-500 text-center py-6">
            Failed to load alerts.
          </p>
        )}

        {response && !isLoading && (
          <>
            {response.data.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No {activeStatus.replace('_', ' ')} alerts.
              </p>
            ) : (
              <div className="space-y-3">
                {response.data.map((alert: ContentAlert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onSelect={setSelectedAlertId}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {response.pagination && response.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!response.pagination.hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-xs"
                >
                  Previous
                </Button>
                <span className="text-xs text-gray-500">
                  Page {response.pagination.page} of {response.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!response.pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AlertsFeed;
