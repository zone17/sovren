/**
 * Strip control characters and zero-width/BiDi override characters from user-supplied strings.
 * Extracted from CreatorCircleService and MentorshipService (#705).
 *
 * Stripped ranges (#754):
 *   U+0000-U+001F  ASCII C0 controls
 *   U+007F         DEL
 *   U+0080-U+009F  C1 controls (Latin supplement control block)
 *   U+200B-U+200F  Zero-width spaces (ZWSP, ZWNJ, ZWJ, LRM, RLM)
 *   U+202A-U+202E  BiDi override characters (LRE, RLE, PDF, LRO, RLO)
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F\x80-\x9F\u200B-\u200F\u202A-\u202E]/g;

export function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHAR_RE, '');
}
