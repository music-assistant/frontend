export type ListKind = "conjunction" | "disjunction";

/** Items joined into an "and" or an "or" list the locale's way, such as "A, B and C". */
export function formatList(
  items: string[],
  locale: string,
  kind: ListKind = "conjunction",
): string {
  try {
    return new Intl.ListFormat(locale, { type: kind }).format(items);
  } catch {
    return items.join(", ");
  }
}
