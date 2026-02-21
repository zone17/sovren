/**
 * Format satoshi amounts with locale separators and optional abbreviations.
 *
 * Variants seen across the codebase:
 * - Simple: "1,000 sats" (ExpenseTracker, InvoiceDashboard)
 * - Abbreviated: "1.5M sats" / "2.3K sats" (RevenueMix, PremiumContentPaywall)
 * - Abbreviated no suffix: "1.5M" / "2.3K" (TaxSummary, SubscriptionCard, analytics)
 *
 * This single implementation replaces all 8 inline copies.
 */

/**
 * Format a satoshi amount for display.
 *
 * @param sats - The amount in satoshis
 * @param options.abbreviate - Use K/M abbreviations for large values (default: false)
 * @param options.suffix - Append " sats" suffix (default: true)
 * @returns Formatted string, e.g. "1,234 sats" or "1.5M sats"
 */
export function formatSats(
  sats: number,
  options?: { abbreviate?: boolean; suffix?: boolean }
): string {
  const abbreviate = options?.abbreviate ?? false;
  const suffix = options?.suffix ?? true;

  if (!Number.isFinite(sats) || sats < 0) {
    return suffix ? '0 sats' : '0';
  }

  // Satoshis are always integers — round to prevent decimal display
  const safeSats = Math.round(sats);

  let formatted: string;

  if (abbreviate) {
    if (safeSats >= 1_000_000) {
      formatted = (safeSats / 1_000_000).toFixed(1) + 'M';
    } else if (safeSats >= 1_000) {
      formatted = (safeSats / 1_000).toFixed(1) + 'K';
    } else {
      formatted = safeSats.toLocaleString();
    }
  } else {
    formatted = safeSats.toLocaleString();
  }

  return suffix ? formatted + ' sats' : formatted;
}
