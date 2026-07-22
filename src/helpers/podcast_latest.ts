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
 * Parse an episode's `metadata.release_date` into a numeric timestamp (ms).
 * Returns `null` when the field is missing or not a valid date, which callers
 * use to push undated episodes to the end of the listing.
 */
export function getEpisodeReleaseTime(episode: PodcastEpisode): number | null {
  const rawReleaseDate = episode.metadata?.release_date;
  if (!rawReleaseDate) return null;
  const parsedTime = new Date(rawReleaseDate).getTime();
  return Number.isNaN(parsedTime) ? null : parsedTime;
}

/**
 * Format an episode's release date as a localized date string, or return
 * `null` when the episode has no valid release date. Pure wrapper around
 * `getEpisodeReleaseTime` so the component template stays declarative.
 */
export function formatEpisodeReleaseDate(
  episode: PodcastEpisode,
  locale?: string,
): string | null {
  const releaseTime = getEpisodeReleaseTime(episode);
  if (releaseTime === null) return null;
  return new Date(releaseTime).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
