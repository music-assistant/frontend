/**
 * Strip a code down to its bare characters: uppercased, with separators and
 * other foreign characters removed.
 */
export function sanitizeCode(value: string, digitsOnly = false): string {
  return value.toUpperCase().replace(digitsOnly ? /[^0-9]/g : /[^A-Z0-9]/g, "");
}

/**
 * Split a code into one part per segment length, sanitizing it first.
 */
export function splitCode(code: string, lengths: number[]): string[] {
  const clean = sanitizeCode(code);
  const parts: string[] = [];
  let offset = 0;
  for (const length of lengths) {
    parts.push(clean.slice(offset, offset + length));
    offset += length;
  }
  return parts;
}

/** Segment lengths the remote access ID is grouped into: 8-5-5-8. */
export const REMOTE_ID_GROUPS = [8, 5, 5, 8];

/**
 * Format a remote access ID into its dash-separated 8-5-5-8 groups.
 */
export function formatRemoteId(id: string): string {
  return splitCode(id, REMOTE_ID_GROUPS).join("-");
}
