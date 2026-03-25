import React, { useState, useRef } from 'react';
import {
  useStartOrder,
  useCompleteOrder,
  useDisputeOrder,
  useReviewOrder,
} from '../hooks/useMarketplace';
import EscrowStatus from './EscrowStatus';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../types/community';
import type { ServiceOrder } from '@shared/types/community';

interface OrderTrackerProps {
  order: ServiceOrder;
  role: 'buyer' | 'seller';
}

const OrderTracker: React.FC<OrderTrackerProps> = ({ order, role }) => {
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

  const inFlightRef = useRef(false);

  const startMutation = useStartOrder();
  const completeMutation = useCompleteOrder();
  const disputeMutation = useDisputeOrder();
  const reviewMutation = useReviewOrder();

  // #301 + #316: Synchronous ref guard + React Query isPending for belt-and-suspenders
  const anyActionPending =
    inFlightRef.current ||
    startMutation.isPending ||
    completeMutation.isPending ||
    disputeMutation.isPending ||
    reviewMutation.isPending;

  const handleDispute = () => {
    if (!disputeReason.trim() || inFlightRef.current) return;
    inFlightRef.current = true;
    disputeMutation.mutate(
      { orderId: order.id, reason: disputeReason.trim() },
      {
        onSuccess: () => {
          setShowDisputeForm(false);
          setDisputeReason('');
        },
        onSettled: () => {
          inFlightRef.current = false;
        },
      }
    );
  };

  const handleReview = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    reviewMutation.mutate(
      { orderId: order.id, rating, reviewText: reviewText.trim() || undefined },
      {
        onSuccess: () => setShowReviewForm(false),
        onSettled: () => {
          inFlightRef.current = false;
        },
      }
    );
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground/60">Order #{order.id.slice(0, 8)}</p>
          <p className="text-sm font-medium text-foreground">
            {order.amountSats.toLocaleString()} sats
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            ORDER_STATUS_COLORS[order.status] ?? 'bg-muted text-muted-foreground'
          }`}
        >
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      {/* Escrow progress */}
      <EscrowStatus
        status={order.status}
        expiresAt={order.expiresAt}
        amountSats={order.amountSats}
      />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Seller: start work */}
        {role === 'seller' && order.status === 'escrow_funded' && (
          <button
            onClick={() => {
              if (inFlightRef.current) return;
              inFlightRef.current = true;
              startMutation.mutate(order.id, {
                onSettled: () => {
                  inFlightRef.current = false;
                },
              });
            }}
            disabled={anyActionPending}
            aria-busy={startMutation.isPending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {startMutation.isPending ? 'Starting...' : 'Start Work'}
          </button>
        )}

        {/* Buyer: mark complete */}
        {role === 'buyer' && order.status === 'in_progress' && (
          <button
            onClick={() => {
              if (inFlightRef.current) return;
              inFlightRef.current = true;
              completeMutation.mutate(order.id, {
                onSettled: () => {
                  inFlightRef.current = false;
                },
              });
            }}
            disabled={anyActionPending}
            aria-busy={completeMutation.isPending}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {completeMutation.isPending ? 'Completing...' : 'Mark Complete'}
          </button>
        )}

        {/* Dispute (buyer or seller) */}
        {(order.status === 'escrow_funded' || order.status === 'in_progress') && (
          <button
            onClick={() => setShowDisputeForm(true)}
            disabled={anyActionPending}
            aria-busy={disputeMutation.isPending}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disputeMutation.isPending ? 'Processing...' : 'Dispute'}
          </button>
        )}

        {/* Review (buyer, completed orders) */}
        {role === 'buyer' && order.status === 'completed' && (
          <button
            onClick={() => setShowReviewForm(true)}
            disabled={anyActionPending}
            aria-busy={reviewMutation.isPending}
            className="rounded-md border border-yellow-300 px-3 py-1.5 text-sm text-yellow-700 hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reviewMutation.isPending ? 'Processing...' : 'Leave Review'}
          </button>
        )}
      </div>

      {/* Dispute form */}
      {showDisputeForm && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
          <p className="text-sm font-medium text-red-800">Dispute this order</p>
          <textarea
            placeholder="Describe the issue..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-red-300 px-3 py-2 text-sm focus:outline-none"
            aria-label="Dispute reason"
          />
          <div className="flex gap-2">
            <button
              onClick={handleDispute}
              disabled={!disputeReason.trim() || anyActionPending}
              aria-busy={disputeMutation.isPending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disputeMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
            </button>
            <button
              onClick={() => {
                setShowDisputeForm(false);
                setDisputeReason('');
              }}
              className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Review form */}
      {showReviewForm && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 space-y-2">
          <p className="text-sm font-medium text-yellow-800">Rate this service</p>
          <div className="flex items-center gap-2">
            <label className="text-sm text-foreground" htmlFor={`rating-${order.id}`}>
              Rating:
            </label>
            <select
              id={`rating-${order.id}`}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="rounded-md border border-border px-2 py-1 text-sm"
            >
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r} star{r !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Share your experience (optional)"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border border-border px-3 py-2 text-sm focus:outline-none"
            aria-label="Review text"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReview}
              disabled={anyActionPending}
              aria-busy={reviewMutation.isPending}
              className="rounded-md bg-yellow-600 px-3 py-1.5 text-sm text-white hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
            </button>
            <button
              onClick={() => setShowReviewForm(false)}
              className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timestamps */}
      <dl className="text-xs text-muted-foreground/60 space-y-0.5">
        <div className="flex gap-2">
          <dt>Created:</dt>
          <dd>{new Date(order.createdAt).toLocaleDateString()}</dd>
        </div>
        {order.fundedAt && (
          <div className="flex gap-2">
            <dt>Funded:</dt>
            <dd>{new Date(order.fundedAt).toLocaleDateString()}</dd>
          </div>
        )}
        {order.completedAt && (
          <div className="flex gap-2">
            <dt>Completed:</dt>
            <dd>{new Date(order.completedAt).toLocaleDateString()}</dd>
          </div>
        )}
      </dl>
    </div>
  );
};

export default OrderTracker;
