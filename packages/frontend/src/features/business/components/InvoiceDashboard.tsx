import React, { useState, useRef } from 'react';
import { useBusinessInvoices, useUpdateInvoiceStatus } from '../hooks/useBusinessInvoices';
import type { InvoiceStatus } from '@shared/types/finance';
import { formatSats } from '../../../shared/utils/formatSats';

interface InvoiceDashboardProps {
  onCreateNew: () => void;
  onViewInvoice?: (id: string) => void;
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-indigo-100 text-indigo-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_FILTERS: Array<InvoiceStatus | 'all'> = ['all', 'draft', 'sent', 'paid', 'overdue'];

const InvoiceDashboard: React.FC<InvoiceDashboardProps> = ({ onCreateNew, onViewInvoice }) => {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const { data: invoices, isLoading } = useBusinessInvoices();
  const updateStatus = useUpdateInvoiceStatus();

  const handleMarkPaid = (invoiceId: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setPendingId(invoiceId);
    updateStatus.mutate(
      { id: invoiceId, status: 'paid' },
      {
        onSettled: () => {
          inFlightRef.current = false;
          setPendingId(null);
        },
      }
    );
  };

  const filtered =
    invoices?.filter((inv) => statusFilter === 'all' || inv.status === statusFilter) ?? [];

  const totalPaid =
    invoices?.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.totalSats, 0) ??
    0;
  const totalPending =
    invoices
      ?.filter((inv) => inv.status === 'sent' || inv.status === 'viewed')
      .reduce((sum, inv) => sum + inv.totalSats, 0) ?? 0;

  return (
    <div className="space-y-5">
      {/* Toolbar — always visible so E2E & users can interact during loading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter invoices by status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          onClick={onCreateNew}
        >
          New Invoice
        </button>
      </div>

      {/* Summary cards */}
      {!isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Total Invoices</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{invoices?.length ?? 0}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-xs text-green-600">Paid</p>
            <p className="mt-1 text-lg font-bold text-green-700">{formatSats(totalPaid)}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-blue-600">Pending</p>
            <p className="mt-1 text-lg font-bold text-blue-700">{formatSats(totalPending)}</p>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded-lg bg-gray-100" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No invoices found.</p>
      ) : (
        <ul
          className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white"
          role="list"
          aria-label="Invoices"
        >
          {filtered.map((invoice) => (
            <li key={invoice.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <button
                className="flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                onClick={() => onViewInvoice?.(invoice.id)}
                aria-label={`View invoice for ${invoice.clientName}`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{invoice.clientName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatSats(invoice.totalSats)}
                  {invoice.dueDate && ` · Due ${new Date(invoice.dueDate).toLocaleDateString()}`}
                </p>
              </button>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status]}`}
                >
                  {invoice.status}
                </span>
                {invoice.status === 'sent' && (
                  <button
                    className="text-xs text-green-600 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-green-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleMarkPaid(invoice.id)}
                    disabled={pendingId !== null || updateStatus.isPending}
                    aria-busy={pendingId === invoice.id || updateStatus.isPending}
                  >
                    {pendingId === invoice.id ||
                    (updateStatus.isPending && pendingId === invoice.id)
                      ? 'Processing...'
                      : 'Mark Paid'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InvoiceDashboard;
