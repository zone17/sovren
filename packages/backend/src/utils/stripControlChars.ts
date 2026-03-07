/**
 * Strip ASCII control characters (U+0000-U+001F) from user-supplied strings.
 * Extracted from CreatorCircleService and MentorshipService (#705).
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1F]/g;

export function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHAR_RE, '');
}
