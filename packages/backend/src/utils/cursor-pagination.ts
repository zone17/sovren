/**
 * Cursor Pagination Utilities
 *
 * Implements cursor-based pagination keyed on `created_at + id` for live feeds
 * (content feed, comments, transaction history).
 *
 * Cursor format: ISO 8601 datetime + "|" + UUID
 *   Example: "2026-03-25T10:00:00.000Z|3fa85f64-5717-4562-b3fc-2c963f66afa6"
 *
 * Why cursor over offset?
 *  - Offset pagination drifts when new rows are inserted between pages (live feeds).
 *  - Cursor pagination is stable: the position is anchored to a specific row.
 *  - Scales better: the DB uses an index seek rather than a full-table offset scan.
 *
 * Admin/analytics endpoints that require absolute row positioning should continue
 * to use offset pagination (page + limit).
 */

/**
 * Decode a composite cursor string into its component parts.
 *
 * @param cursor - Composite cursor in the format "createdAt|id"
 * @returns Parsed { createdAt, id }
 * @throws TypeError when the cursor format is invalid
 */
export function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const separatorIndex = cursor.indexOf('|');
  if (separatorIndex === -1) {
    throw new TypeError(
      `Invalid cursor format: expected "createdAt|id", received "${cursor}"`
    );
  }
  const createdAt = cursor.slice(0, separatorIndex);
  const id = cursor.slice(separatorIndex + 1);
  if (!createdAt || !id) {
    throw new TypeError(
      `Invalid cursor format: createdAt or id is empty in "${cursor}"`
    );
  }
  return { createdAt, id };
}

/**
 * Encode a (createdAt, id) pair into a cursor string.
 *
 * @param createdAt - ISO 8601 datetime string
 * @param id        - UUID string
 * @returns Composite cursor
 */
export function encodeCursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`;
}

/**
 * Apply cursor-based filtering and ordering to a Supabase query builder.
 *
 * Direction semantics (default sort is created_at DESC, id DESC):
 *  - "next": return items *older* than the cursor (standard infinite scroll / next page)
 *  - "prev": return items *newer* than the cursor (pull-to-refresh / previous page)
 *
 * The compound filter `(created_at < X) OR (created_at = X AND id < Y)` handles
 * ties on created_at correctly by falling back to id ordering.
 *
 * @param query     - Supabase PostgREST query builder (any table)
 * @param cursor    - Opaque cursor string; if undefined the first page is returned
 * @param direction - "next" | "prev"
 * @returns The modified query builder with filter + order applied
 */
export function applyCursorFilter(
  query: any,
  cursor: string | undefined,
  direction: 'next' | 'prev' = 'next'
): any {
  if (!cursor) {
    // No cursor — return the first page, newest items first
    return query.order('created_at', { ascending: false }).order('id', { ascending: false });
  }

  const { createdAt, id } = decodeCursor(cursor);

  if (direction === 'next') {
    // Items older than the cursor (or same timestamp but smaller id)
    return query
      .or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
  }

  // direction === 'prev': items newer than the cursor
  return query
    .or(`created_at.gt.${createdAt},and(created_at.eq.${createdAt},id.gt.${id})`)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
}

/**
 * Build the pagination envelope for a cursor-paginated response.
 *
 * @param items     - The result rows from the DB (already limited)
 * @param limit     - Page size that was requested
 * @param direction - Which direction was paginated
 * @returns Pagination metadata including next/prev cursors
 */
export function buildCursorPageInfo(
  items: Array<{ created_at: string; id: string }>,
  limit: number,
  direction: 'next' | 'prev' = 'next'
): {
  nextCursor: string | null;
  prevCursor: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
} {
  if (items.length === 0) {
    return { nextCursor: null, prevCursor: null, hasNextPage: false, hasPrevPage: false };
  }

  // When paginating backward the DB returns oldest-first; reverse for consistent API shape
  const orderedItems = direction === 'prev' ? [...items].reverse() : items;

  const firstItem = orderedItems[0];
  const lastItem = orderedItems[orderedItems.length - 1];
  const hasFullPage = items.length === limit;

  return {
    nextCursor: hasFullPage ? encodeCursor(lastItem.created_at, lastItem.id) : null,
    prevCursor: encodeCursor(firstItem.created_at, firstItem.id),
    hasNextPage: hasFullPage,
    hasPrevPage: true, // caller knows if there is a previous page
  };
}
