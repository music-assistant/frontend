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
