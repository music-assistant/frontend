// What the Discover tab of the Catalog suggests: the server's recommendations,
// matched with the Catalog entries, as rows and top picks.
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { isCommunityProvider } from "@/helpers/provider_config";
import {
  type CatalogRecommendation,
  CatalogRecommendationReason,
} from "@/plugins/api/interfaces";

/** How many suggestions a row shows at most. */
export const CATALOG_ROW_SIZE = 8;

/** How many top picks the Discover tab offers at most. */
export const TOP_PICK_COUNT = 4;

/** The user preference that lists the domains the user asked not to be suggested. */
export const DISMISSED_SUGGESTIONS_PREFERENCE = "catalog.dismissedSuggestions";

const DAY_MS = 24 * 60 * 60 * 1000;

const KNOWN_REASONS = new Set<string>(
  Object.values(CatalogRecommendationReason),
);

// the reasons that are about the user's own setup, which the user may let go
const PERSONAL_REASONS: readonly CatalogRecommendationReason[] = [
  CatalogRecommendationReason.DISCOVERED,
  CatalogRecommendationReason.COMPLEMENTS,
];

// where the top picks come from, in this order
const PICK_REASONS: readonly CatalogRecommendationReason[] = [
  ...PERSONAL_REASONS,
  CatalogRecommendationReason.POPULAR,
];

/** An entry the server suggests, and why. */
export interface CatalogSuggestion {
  entry: CatalogEntry;
  reason: CatalogRecommendationReason;
  // for complements: the name of what it goes well with
  pairedWith: string | null;
}

/** A row of suggestions to scroll through on the Discover tab. */
export interface CatalogRow {
  // names the row in its test id: catalog-<key>
  key: string;
  // the translation key of its title, which may name the version
  title: string;
  suggestions: CatalogSuggestion[];
}

interface RowDefinition {
  key: string;
  title: string;
  reason: CatalogRecommendationReason;
  // whether the row holds only entries of the community catalog, or none of them
  community?: boolean;
}

const ROWS: readonly RowDefinition[] = [
  {
    key: "discovered",
    title: "settings.catalog.discovered_title",
    reason: CatalogRecommendationReason.DISCOVERED,
  },
  {
    key: "complements",
    title: "settings.catalog.complements_title",
    reason: CatalogRecommendationReason.COMPLEMENTS,
  },
  {
    key: "popular",
    title: "settings.catalog.popular",
    reason: CatalogRecommendationReason.POPULAR,
  },
  {
    key: "new",
    title: "settings.catalog.new_in_version",
    reason: CatalogRecommendationReason.NEW,
    community: false,
  },
  {
    key: "community-new",
    title: "settings.catalog.community.new_title",
    reason: CatalogRecommendationReason.NEW,
    community: true,
  },
  {
    key: "community-updated",
    title: "settings.catalog.community.updated_title",
    reason: CatalogRecommendationReason.UPDATED,
    community: true,
  },
];

/**
 * The suggestions of the server that the Catalog has an entry for, in the
 * server's order. A reason or a domain the app does not know, an entry that
 * cannot be added (any more) and a dismissed domain are left out.
 *
 * @param entries - The Catalog entries.
 * @param recommendations - What the server suggests, as it sent it.
 * @param dismissed - The domains the user asked not to be suggested.
 * @param getName - The name of a provider by its domain, for what a suggestion goes well with.
 */
export const getCatalogSuggestions = (
  entries: readonly CatalogEntry[],
  recommendations: readonly CatalogRecommendation[],
  dismissed: readonly string[],
  getName: (domain: string) => string | undefined,
): CatalogSuggestion[] => {
  const byDomain = new Map(
    entries.map((entry) => [entry.manifest.domain, entry]),
  );
  const hidden = new Set(dismissed);
  return recommendations.flatMap(({ domain, reason, detail }) => {
    const entry = byDomain.get(domain);
    if (!entry?.canAdd || !KNOWN_REASONS.has(reason) || hidden.has(domain))
      return [];
    const pairedWith =
      reason === CatalogRecommendationReason.COMPLEMENTS && detail
        ? (getName(detail) ?? null)
        : null;
    return [{ entry, reason, pairedWith }];
  });
};

/**
 * The top picks for the user, at most TOP_PICK_COUNT: what was found on the
 * network, then what goes well with what is set up, then what is popular, each
 * entry once. The pick of the day comes first: it moves on to the next one
 * every day, the order staying the same. Empty when there is nothing to pick.
 *
 * @param suggestions - The suggestions, in the server's order.
 * @param now - The current time, in milliseconds since the epoch.
 */
export const getTopPicks = (
  suggestions: readonly CatalogSuggestion[],
  now: number,
): CatalogSuggestion[] => {
  const picks: CatalogSuggestion[] = [];
  for (const reason of PICK_REASONS) {
    for (const suggestion of suggestions) {
      if (picks.length === TOP_PICK_COUNT) break;
      if (
        suggestion.reason === reason &&
        !picks.some((pick) => isSameEntry(pick, suggestion))
      )
        picks.push(suggestion);
    }
  }
  const first = picks.length ? getLocalDayNumber(now) % picks.length : 0;
  return [...picks.slice(first), ...picks.slice(0, first)];
};

/**
 * The rows of the Discover tab, in their order, each with at most
 * CATALOG_ROW_SIZE suggestions and only when it has any. The rows of the
 * community catalog only come while it is enabled for the user.
 *
 * @param suggestions - The suggestions, in the server's order.
 * @param withCommunity - Whether the community catalog is enabled for the user.
 * @param pick - The top pick shown above the rows, left out of the first row it is in.
 */
export const getSuggestionRows = (
  suggestions: readonly CatalogSuggestion[],
  withCommunity: boolean,
  pick?: CatalogSuggestion,
): CatalogRow[] => {
  let pickShown = !pick;
  const shown = withCommunity ? ROWS : ROWS.filter((row) => !row.community);
  return shown
    .map(({ key, title, reason, community }) => {
      let inRow = suggestions.filter(
        (suggestion) =>
          suggestion.reason === reason &&
          (community === undefined ||
            isFromCommunity(suggestion.entry) === community),
      );
      if (
        !pickShown &&
        inRow.some((suggestion) => isSameEntry(suggestion, pick!))
      ) {
        inRow = inRow.filter((suggestion) => !isSameEntry(suggestion, pick!));
        pickShown = true;
      }
      return { key, title, suggestions: inRow.slice(0, CATALOG_ROW_SIZE) };
    })
    .filter((row) => row.suggestions.length);
};

/** Whether a suggestion is about the user's own setup, so the user may let it go. */
export const isPersonalSuggestion = (suggestion: CatalogSuggestion): boolean =>
  PERSONAL_REASONS.includes(suggestion.reason);

/**
 * The domains a user preference holds, leaving out anything that is not one.
 *
 * @param value - The stored value of DISMISSED_SUGGESTIONS_PREFERENCE.
 */
export const readDismissedSuggestions = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((domain): domain is string => typeof domain === "string")
    : [];

/**
 * The release line of a server version, major.minor, as a user knows it; the
 * version as it is when it has none.
 *
 * @param version - The version the server reports, such as 2.11.0b3.
 */
export const getReleaseLine = (version: string): string =>
  /^(\d+\.\d+)/.exec(version)?.[1] ?? version;

function isSameEntry(a: CatalogSuggestion, b: CatalogSuggestion): boolean {
  return a.entry.manifest.domain === b.entry.manifest.domain;
}

function isFromCommunity(entry: CatalogEntry): boolean {
  return !!entry.community || isCommunityProvider(entry.manifest);
}

// days counted on the user's own calendar, so the pick changes at midnight
function getLocalDayNumber(now: number): number {
  const date = new Date(now);
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}
