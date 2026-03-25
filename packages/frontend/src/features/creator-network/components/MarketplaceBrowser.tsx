import React, { useCallback, useRef, useState } from 'react';
import { useListings, usePlaceOrder } from '../hooks/useMarketplace';
import { SERVICE_TYPE_LABELS } from '../types/community';
import type { ServiceType, ServiceListing } from '@shared/types/community';

const MarketplaceBrowser: React.FC = () => {
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | ''>('');
  const [page, setPage] = useState(1);
  const [orderingId, setOrderingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useListings({
    serviceType: serviceTypeFilter || undefined,
    page,
  });

  const listings = data?.listings ?? [];
  const pagination = data?.pagination;

  const placeOrderMutation = usePlaceOrder();

  // #267: Generate idempotency key once per listing intent, not per click
  const idempotencyKeys = useRef<Map<string, string>>(new Map());
  const getIdempotencyKey = useCallback((listingId: string): string => {
    const existing = idempotencyKeys.current.get(listingId);
    if (existing) return existing;
    const key = crypto.randomUUID();
    idempotencyKeys.current.set(listingId, key);
    return key;
  }, []);

  const handleOrder = (listing: ServiceListing) => {
    if (placeOrderMutation.isPending) return; // Guard against double-click
    const idempotencyKey = getIdempotencyKey(listing.id);
    setOrderingId(listing.id);
    placeOrderMutation.mutate(
      { listingId: listing.id, idempotencyKey },
      {
        onSuccess: () => {
          setOrderingId(null);
          idempotencyKeys.current.delete(listing.id); // Clear for future orders
        },
        onError: () => {
          setOrderingId(null);
          // Keep idempotency key so retry uses same key
        },
      }
    );
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load marketplace. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Creator Marketplace</h2>
        <p className="text-sm text-muted-foreground">
          Hire creators for editing, writing, design, and more
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={serviceTypeFilter}
          onChange={(e) => {
            setServiceTypeFilter(e.target.value as ServiceType | '');
            setPage(1);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          aria-label="Filter by service type"
        >
          <option value="">All services</option>
          {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Listings */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4 h-32" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No listings match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="rounded-lg border bg-card p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-foreground">{listing.title}</h3>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 shrink-0">
                    {SERVICE_TYPE_LABELS[listing.serviceType] ?? listing.serviceType}
                  </span>
                </div>
                {listing.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {listing.description}
                  </p>
                )}
                {listing.portfolioUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {listing.portfolioUrls.slice(0, 2).map((url: string, i: number) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Portfolio {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {listing.priceSats.toLocaleString()} sats
                </span>
                <button
                  onClick={() => handleOrder(listing)}
                  disabled={placeOrderMutation.isPending}
                  className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                  aria-label={`Order ${listing.title}`}
                >
                  {placeOrderMutation.isPending && orderingId === listing.id
                    ? 'Placing order...'
                    : 'Order'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!pagination.hasPrev}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNext}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceBrowser;
