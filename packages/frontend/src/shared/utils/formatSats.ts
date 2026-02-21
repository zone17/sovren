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

  let formatted: string;

  if (abbreviate) {
    if (sats >= 1_000_000) {
      formatted = (sats / 1_000_000).toFixed(1) + 'M';
    } else if (sats >= 1_000) {
      formatted = (sats / 1_000).toFixed(1) + 'K';
    } else {
      formatted = sats.toLocaleString();
    }
  } else {
    formatted = sats.toLocaleString();
  }

  return suffix ? formatted + ' sats' : formatted;
}
