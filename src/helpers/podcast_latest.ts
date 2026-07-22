/**
 * Pure transforms for building the "latest podcast episodes" listing.
 *
 * These helpers take the raw per-podcast episode lists returned by
 * `api.getPodcastEpisodes` and turn them into a single, globally ordered list
 * of the newest episodes across every podcast in the library. All functions
 * here are pure (no I/O, no reactivity) so they can be unit-tested in
 * isolation; the fetching/orchestration lives in the composable
 * `useLatestPodcastEpisodes`.
 */
import type { PodcastEpisode } from "@/plugins/api/interfaces";

/** Default number of newest candidate episodes taken from each podcast feed. */
export const DEFAULT_CANDIDATES_PER_PODCAST = 10;

/** Hard cap on the number of episodes shown in the combined listing. */
export const MAX_LATEST_EPISODES = 100;

export interface BuildLatestEpisodesOptions {
  /** Newest episodes to consider per podcast before merging (default 10). */
  candidatesPerPodcast?: number;
  /** Maximum episodes returned after the global sort (default 100). */
  maxResults?: number;
}

/**
 * Matches a date-only `release_date` of the form `YYYY-MM-DD` (no time part).
 * Such values carry a calendar date, not an instant, so they must be rendered
 * as that same local date regardless of the viewer's time zone.
 */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Construct a local-time `Date` at midnight for the given calendar components
 * (month is 1-based). The `Date` constructor maps two-digit years (0-99) to
 * 1900-1999, so `setFullYear` is used to pin the actual four-digit year and
 * keep construction correct across the whole `0000`-`9999` range.
 */
function buildLocalCalendarDate(
  year: number,
  month: number,
  day: number,
): Date {
  const date = new Date(year, month - 1, day);
  date.setFullYear(year);
  return date;
}

/**
 * When `raw` is a valid `YYYY-MM-DD` calendar date, return its `[year, month,
 * day]` components (month is 1-based). Returns `null` for any other shape or
 * for values that look date-only but are not real dates (e.g. `2024-02-31`).
 */
function parseDateOnlyParts(raw: string): [number, number, number] | null {
  if (!DATE_ONLY_PATTERN.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject impossible calendar dates (e.g. Feb 31) via round-trip check: an
  // overflowing day rolls into the next month, so the components no longer match.
  const asDate = buildLocalCalendarDate(year, month, day);
  if (
    asDate.getFullYear() !== year ||
    asDate.getMonth() !== month - 1 ||
    asDate.getDate() !== day
  ) {
    return null;
  }
  return [year, month, day];
}

/**
 * Build a UTC-midnight timestamp (ms) for the given calendar components (month
 * is 1-based). `Date.UTC` maps two-digit years (0-99) to 1900-1999, so
 * `setUTCFullYear` pins the actual four-digit year and keeps the result correct
 * across the whole `0000`-`9999` range.
 */
function buildUtcMidnightTime(
  year: number,
  month: number,
  day: number,
): number {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(year);
  return date.getTime();
}

/**
 * Parse an episode's `metadata.release_date` into a numeric timestamp (ms).
 * Returns `null` when the field is missing or not a valid date, which callers
 * use to push undated episodes to the end of the listing.
 *
 * Date-only values (`YYYY-MM-DD`) are validated strictly and pinned to UTC
 * midnight so that global sorting stays deterministic and independent of the
 * viewer's time zone. Impossible calendar dates that merely look date-only
 * (e.g. `2024-02-31`) are treated as undated (`null`) rather than being
 * silently normalized to a different month by lenient `Date` parsing. Full ISO
 * timestamps keep their instant semantics.
 */
export function getEpisodeReleaseTime(episode: PodcastEpisode): number | null {
  const rawReleaseDate = episode.metadata?.release_date;
  if (!rawReleaseDate) return null;

  // Any date-only-shaped value is resolved strictly here and never falls
  // through to generic parsing, so invalid calendar dates sort as undated.
  if (DATE_ONLY_PATTERN.test(rawReleaseDate)) {
    const dateOnlyParts = parseDateOnlyParts(rawReleaseDate);
    if (!dateOnlyParts) return null;
    const [year, month, day] = dateOnlyParts;
    return buildUtcMidnightTime(year, month, day);
  }

  const parsedTime = new Date(rawReleaseDate).getTime();
  return Number.isNaN(parsedTime) ? null : parsedTime;
}

/**
 * Format an episode's release date as a localized date string, or return
 * `null` when the episode has no valid release date.
 *
 * Date-only values (`YYYY-MM-DD`) are rendered as that exact local calendar
 * date, so a `2024-01-15` release shows as Jan 15 even in time zones west of
 * UTC (where the naive `new Date("2024-01-15")` UTC-midnight instant would slip
 * to Jan 14). Full ISO timestamps keep instant semantics and are formatted in
 * the viewer's local time zone.
 *
 * Date-only-shaped inputs are handled strictly: a value matching `YYYY-MM-DD`
 * never enters generic timestamp parsing. Valid ones render as their exact
 * local calendar date; impossible-but-in-range ones (e.g. `2024-02-31`) return
 * `null` rather than being silently normalized to a different month by lenient
 * `Date` parsing.
 */
export function formatEpisodeReleaseDate(
  episode: PodcastEpisode,
  locale?: string,
): string | null {
  const rawReleaseDate = episode.metadata?.release_date;
  if (!rawReleaseDate) return null;

  const dateFormatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  // Any date-only-shaped value is resolved entirely here and never falls
  // through to generic parsing, so invalid calendar dates return null.
  if (DATE_ONLY_PATTERN.test(rawReleaseDate)) {
    const dateOnlyParts = parseDateOnlyParts(rawReleaseDate);
    if (!dateOnlyParts) return null;
    const [year, month, day] = dateOnlyParts;
    // Build a local-time Date so the rendered calendar date matches the input.
    return buildLocalCalendarDate(year, month, day).toLocaleDateString(
      locale,
      dateFormatOptions,
    );
  }

  const releaseTime = getEpisodeReleaseTime(episode);
  if (releaseTime === null) return null;
  return new Date(releaseTime).toLocaleDateString(locale, dateFormatOptions);
}

/**
 * A stable, provider-independent identity for an episode used for
 * deduplication. Prefers the canonical `uri`; falls back to the
 * provider-qualified item id for feeds that omit a uri.
 */
export function getEpisodeIdentity(episode: PodcastEpisode): string {
  return episode.uri || `${episode.provider}:${episode.item_id}`;
}

/**
 * Comparator that orders episodes by release date (newest first) while keeping
 * undated episodes after every dated one. Undated episodes compare equal to
 * one another so a stable sort preserves their incoming (provider) order.
 */
function compareByReleaseDateDesc(
  first: PodcastEpisode,
  second: PodcastEpisode,
): number {
  const firstTime = getEpisodeReleaseTime(first);
  const secondTime = getEpisodeReleaseTime(second);
  if (firstTime === null && secondTime === null) return 0;
  if (firstTime === null) return 1;
  if (secondTime === null) return -1;
  return secondTime - firstTime;
}

/**
 * Take the newest `limit` episodes from a single podcast feed. Dated episodes
 * are ordered newest-first; undated episodes keep their provider order and are
 * only included once the dated ones are exhausted.
 */
export function takeNewestCandidates(
  episodes: PodcastEpisode[],
  limit: number = DEFAULT_CANDIDATES_PER_PODCAST,
): PodcastEpisode[] {
  if (limit <= 0) return [];
  // Copy before sorting so the caller's array is left untouched.
  return [...episodes].sort(compareByReleaseDateDesc).slice(0, limit);
}

/**
 * Remove duplicate episodes by stable identity, keeping the first occurrence
 * (which preserves the deterministic provider ordering of the input).
 */
export function dedupeEpisodes(episodes: PodcastEpisode[]): PodcastEpisode[] {
  const seenIdentities = new Set<string>();
  const uniqueEpisodes: PodcastEpisode[] = [];
  for (const episode of episodes) {
    const identity = getEpisodeIdentity(episode);
    if (seenIdentities.has(identity)) continue;
    seenIdentities.add(identity);
    uniqueEpisodes.push(episode);
  }
  return uniqueEpisodes;
}

/**
 * Globally order episodes newest-first, keeping undated episodes after dated
 * ones. Relies on a stable sort so undated episodes retain their input order.
 */
export function sortEpisodesByReleaseDate(
  episodes: PodcastEpisode[],
): PodcastEpisode[] {
  return [...episodes].sort(compareByReleaseDateDesc);
}

/**
 * Build the combined "latest episodes" listing from the per-podcast feeds.
 *
 * The input is an array of episode lists (one per podcast) in a deterministic
 * provider order. For each feed we take the newest `candidatesPerPodcast`
 * episodes, merge them, deduplicate by stable identity, sort globally by
 * release date (undated last, provider order preserved), and cap the result at
 * `maxResults`.
 */
export function buildLatestEpisodes(
  perPodcastEpisodeLists: PodcastEpisode[][],
  options: BuildLatestEpisodesOptions = {},
): PodcastEpisode[] {
  const candidatesPerPodcast =
    options.candidatesPerPodcast ?? DEFAULT_CANDIDATES_PER_PODCAST;
  const maxResults = options.maxResults ?? MAX_LATEST_EPISODES;

  const mergedCandidates: PodcastEpisode[] = [];
  for (const feedEpisodes of perPodcastEpisodeLists) {
    mergedCandidates.push(
      ...takeNewestCandidates(feedEpisodes, candidatesPerPodcast),
    );
  }

  const uniqueEpisodes = dedupeEpisodes(mergedCandidates);
  const sortedEpisodes = sortEpisodesByReleaseDate(uniqueEpisodes);
  return sortedEpisodes.slice(0, maxResults);
}
