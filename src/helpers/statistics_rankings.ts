import type { StatisticsDistributionItem } from "@/plugins/api/interfaces";

/** One slice of a share bar: a named entry, or the rest summed as "other". */
export interface ShareSegment {
  name: string;
  value: number;
  // 0-100, of the total of all entries
  share: number;
  isOther: boolean;
}

/** How many genres the top genre card names before summing the rest. */
export const NAMED_GENRE_SEGMENTS = 4;

/** `value` as a whole percentage of `total`, between 0 and 100. */
export function sharePercent(value: number, total: number): number {
  if (!(total > 0) || !(value > 0)) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

/**
 * The first `namedCount` entries with their share of the total, followed by
 * an "other" segment with the rest when anything is left over. Entries
 * without plays are left out.
 */
export function shareSegments(
  items: StatisticsDistributionItem[],
  namedCount = NAMED_GENRE_SEGMENTS,
): ShareSegment[] {
  const played = items.filter((item) => item.value > 0);
  const total = played.reduce((sum, item) => sum + item.value, 0);
  const segments: ShareSegment[] = played.slice(0, namedCount).map((item) => ({
    name: item.name,
    value: item.value,
    share: sharePercent(item.value, total),
    isOther: false,
  }));
  const otherValue = played
    .slice(namedCount)
    .reduce((sum, item) => sum + item.value, 0);
  if (otherValue > 0) {
    segments.push({
      name: "",
      value: otherValue,
      share: sharePercent(otherValue, total),
      isOther: true,
    });
  }
  return segments;
}

/** The entry with the highest value; the first one on a tie. */
export function topEntry(
  items: StatisticsDistributionItem[],
): StatisticsDistributionItem | undefined {
  let top: StatisticsDistributionItem | undefined;
  for (const item of items) {
    if (item.value > 0 && (!top || item.value > top.value)) top = item;
  }
  return top;
}

/** Decades oldest first; the server sends them newest first. */
export function sortDecades(
  items: StatisticsDistributionItem[],
): StatisticsDistributionItem[] {
  return [...items].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * The entry with this name, ignoring case and surrounding spaces, to link
 * name-only statistics (listening time per artist) to the ranked artist.
 */
export function findByName<T>(
  name: string,
  entries: readonly T[],
  nameOf: (entry: T) => string,
): T | undefined {
  const wanted = name.trim().toLocaleLowerCase();
  return entries.find(
    (entry) => nameOf(entry).trim().toLocaleLowerCase() === wanted,
  );
}
