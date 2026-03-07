/**
 * Escape user-supplied strings for use in PostgREST .or() / .filter() calls.
 * Critical-patterns.md #11 — backslash MUST be escaped first to avoid double-escaping.
 *
 * Full metacharacter set: \ , . * ( ) : % " _
 *
 * @example
 *   const safe = escapePostgrestFilter(userQuery);
 *   query.or(`display_name.ilike.%${safe}%`);
 */
export function escapePostgrestFilter(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // backslash FIRST
    .replace(/[,.*():%"_]/g, '\\$&'); // all metacharacters
}
