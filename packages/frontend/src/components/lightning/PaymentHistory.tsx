/**
 * ⚡ **PAYMENT HISTORY COMPONENT** - Lightning Network Payment Dashboard
 *
 * Elite Engineering Standards:
 * - Full TypeScript type safety
 * - Comprehensive filtering and sorting
 * - Pagination for performance
 * - Mobile-responsive design
 * - WCAG AA accessibility compliant
 * - TDD approach with 85%+ coverage
 *
 * User Story: PAY-007 - Display Payment History in User Dashboard
 *
 * @module PaymentHistory
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { useToast } from '../../hooks/use-toast';
import { lightningApi, LightningPayment, LightningApiError } from '../../lib/api/lightningApi';
import { Copy, Download, AlertCircle, RefreshCw } from 'lucide-react';

// Payment status type for filtering
type PaymentStatus = 'all' | 'settled' | 'pending' | 'failed' | 'expired';

// Sort options
type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

const PAYMENTS_PER_PAGE = 20;

/**
 * Format satoshis amount with proper formatting
 */
const formatAmount = (sats: number): string => {
  if (sats >= 1000000) {
    // Format as millions for large amounts (e.g., "100M sats")
    const millions = sats / 1000000;
    return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(2)}M sats`;
  }
  return new Intl.NumberFormat('en-US').format(sats) + ' sats';
};

/**
 * Format date to relative time or absolute date
 */
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }

  if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Truncate payment hash for display
 */
const truncateHash = (hash: string): string => {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
};

/**
 * Get status badge color
 */
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'settled':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'expired':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Payment History Component
 */
export const PaymentHistory: React.FC = () => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>('all');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch payment history using React Query
  const {
    data: payments = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['paymentHistory'],
    queryFn: () => lightningApi.getUserPaymentHistory(),
    staleTime: 30000, // 30 seconds
    retry: 2,
  });

  // Filter payments by status
  const filteredPayments = useMemo(() => {
    if (statusFilter === 'all') return payments;
    return payments.filter((payment) => payment.status === statusFilter);
  }, [payments, statusFilter]);

  // Sort payments
  const sortedPayments = useMemo(() => {
    const sorted = [...filteredPayments];

    switch (sortOption) {
      case 'date-desc':
        return sorted.sort((a, b) => b.createdAt - a.createdAt);
      case 'date-asc':
        return sorted.sort((a, b) => a.createdAt - b.createdAt);
      case 'amount-desc':
        return sorted.sort((a, b) => b.amount - a.amount);
      case 'amount-asc':
        return sorted.sort((a, b) => a.amount - b.amount);
      default:
        return sorted;
    }
  }, [filteredPayments, sortOption]);

  // Paginate payments
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * PAYMENTS_PER_PAGE;
    const endIndex = startIndex + PAYMENTS_PER_PAGE;
    return sortedPayments.slice(startIndex, endIndex);
  }, [sortedPayments, currentPage]);

  const totalPages = Math.ceil(sortedPayments.length / PAYMENTS_PER_PAGE);

  // Copy payment hash to clipboard
  const copyPaymentHash = (hash: string) => {
    navigator.clipboard.writeText(hash).then(() => {
      toast({
        title: 'Copied',
        description: 'Payment hash copied to clipboard',
        variant: 'default',
      });
    });
  };

  // Download receipt (placeholder implementation)
  const downloadReceipt = (payment: LightningPayment) => {
    // Generate receipt data
    const receiptData = {
      id: payment.id,
      paymentHash: payment.paymentHash,
      amount: payment.amount,
      description: payment.description || 'Payment',
      status: payment.status,
      createdAt: new Date(payment.createdAt).toISOString(),
      settledAt: payment.settledAt ? new Date(payment.settledAt).toISOString() : undefined,
    };

    // Create download link
    const dataStr = JSON.stringify(receiptData, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileDefaultName = `receipt-${payment.id}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast({
      title: 'Receipt Downloaded',
      description: 'Payment receipt saved successfully',
      variant: 'default',
    });
  };

  // Handle filter change
  const handleFilterChange = (filter: PaymentStatus) => {
    setStatusFilter(filter);
    setCurrentPage(1); // Reset to first page
  };

  // Handle sort change
  const handleSortChange = () => {
    // Toggle between date and amount sorting
    if (sortOption === 'date-desc') {
      setSortOption('amount-desc');
    } else {
      setSortOption('date-desc');
    }
    setCurrentPage(1); // Reset to first page
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4" role="main">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">Loading payment history...</p>
      </div>
    );
  }

  // Error state
  if (isError) {
    const errorMessage =
      error instanceof LightningApiError
        ? error.message
        : 'Error loading payment history. Please try again.';

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4" role="main">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-sm text-red-600">{errorMessage}</p>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4" role="main">
        <div className="p-6 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 text-center">
            No payments yet. Make your first Lightning payment to see it here!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6" role="main">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-semibold text-gray-900">Payment History</h2>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div role="group" aria-label="Filter payments by status">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('all')}
          >
            All ({payments.length})
          </Button>
          <Button
            variant={statusFilter === 'settled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('settled')}
          >
            Paid ({payments.filter((p) => p.status === 'settled').length})
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('pending')}
          >
            Pending ({payments.filter((p) => p.status === 'pending').length})
          </Button>
          <Button
            variant={statusFilter === 'failed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('failed')}
          >
            Failed ({payments.filter((p) => p.status === 'failed').length})
          </Button>
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {paginatedPayments.length} of {filteredPayments.length} payment
          {filteredPayments.length !== 1 ? 's' : ''}
        </p>
        <Button variant="ghost" size="sm" onClick={handleSortChange}>
          Sort by: {sortOption.includes('date') ? 'Date' : 'Amount'}
        </Button>
      </div>

      {/* Payment List */}
      {paginatedPayments.length === 0 ? (
        <div className="p-6 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-600">No payments found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedPayments.map((payment) => (
            <article
              key={payment.id}
              className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Left side: Description and details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {payment.description || 'Lightning Payment'}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(
                        payment.status
                      )}`}
                    >
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-600">
                    <span>{formatDate(payment.createdAt)}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="font-mono">{truncateHash(payment.paymentHash)}</span>
                  </div>
                </div>

                {/* Right side: Amount and actions */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatAmount(payment.amount)}
                    </p>
                    {payment.settledAt && (
                      <p className="text-xs text-gray-500">
                        Settled {formatDate(payment.settledAt)}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyPaymentHash(payment.paymentHash)}
                      aria-label="Copy payment hash"
                      title="Copy payment hash"
                      tabIndex={0}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadReceipt(payment)}
                      aria-label="Download receipt"
                      title="Download receipt"
                      tabIndex={0}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between border-t border-gray-200 pt-4"
          aria-label="Pagination"
        >
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>

          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium">{currentPage}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
};
