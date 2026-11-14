// How the app reads the community catalog: what is installed, whether it runs,
// and how its state reads.
import {
  type CommunityProvider,
  CommunityProviderState,
} from "@/plugins/api/interfaces";

/** The core controller that holds the switch of the community catalog. */
export const COMMUNITY_CATALOG_DOMAIN = "community_catalog";

/** The setting of the switch, a hidden setting of that controller. */
export const COMMUNITY_CATALOG_ENABLED_KEY = "catalog_enabled";

/** The setting that installs updates by themselves, next to the switch. */
export const COMMUNITY_CATALOG_AUTO_UPDATE_KEY = "auto_update";

/** The notice of one the server installed by itself because it moved to the community catalog. */
export const COMMUNITY_NOTICE_MOVED = "moved";

// installed and running, as far as this app tells them apart
const RUNNING_STATES: readonly CommunityProviderState[] = [
  CommunityProviderState.INSTALLED,
  CommunityProviderState.UPDATE_AVAILABLE,
  CommunityProviderState.RESTART_REQUIRED,
];

// the states that stop it from running
const PROBLEM_STATES: readonly CommunityProviderState[] = [
  CommunityProviderState.BLOCKED,
  CommunityProviderState.UNAVAILABLE,
];

const STATE_LABELS: Partial<Record<CommunityProviderState, string>> = {
  [CommunityProviderState.RESTART_REQUIRED]:
    "settings.catalog.community.state.restart_required",
  [CommunityProviderState.BLOCKED]: "settings.catalog.community.state.blocked",
  [CommunityProviderState.UNAVAILABLE]:
    "settings.catalog.community.state.unavailable",
  [CommunityProviderState.WITHDRAWN]:
    "settings.catalog.community.state.withdrawn",
};

/** Whether it is installed on this server, running or not. */
export const isCommunityInstalled = (provider: CommunityProvider): boolean =>
  provider.state !== CommunityProviderState.AVAILABLE;

/** Whether it is installed and runs, so it can be added like any other. */
export const isCommunityRunning = (provider: CommunityProvider): boolean =>
  RUNNING_STATES.includes(provider.state);

/** Whether it is installed but does not run: blocked, or not available on this server. */
export const isCommunityProblem = (provider: CommunityProvider): boolean =>
  PROBLEM_STATES.includes(provider.state);

/** Whether a newer version is on offer for one that is installed. */
export const hasCommunityUpdate = (provider: CommunityProvider): boolean =>
  provider.state === CommunityProviderState.UPDATE_AVAILABLE;

/**
 * Whether the version on offer is one that failed to load here, so it can be
 * tried again.
 */
export const canRetryCommunityVersion = (
  provider: CommunityProvider,
): boolean =>
  provider.state === CommunityProviderState.INSTALLED &&
  !!provider.failed_version &&
  provider.failed_version === provider.latest_version;

/** How an update ended: the new version runs, waits for a restart, or failed. */
export type CommunityUpdateOutcome = "updated" | "restart" | "failed";

/**
 * How an update to a version ended, by what the community catalog lists after it.
 * One that did not load and was put back on its previous version has failed.
 *
 * @param provider - The installed one after the update, undefined when no longer listed.
 * @param version - The version it was to get.
 */
export const getCommunityUpdateOutcome = (
  provider: CommunityProvider | undefined,
  version: string | null,
): CommunityUpdateOutcome => {
  if (
    provider?.state === CommunityProviderState.RESTART_REQUIRED &&
    provider.pending_version === version
  ) {
    return "restart";
  }
  return provider?.installed_version === version ? "updated" : "failed";
};

/**
 * The translation key of the state an installed one shows, or undefined for one
 * that runs as it should.
 */
export const getCommunityStateLabel = (
  provider: CommunityProvider,
): string | undefined => STATE_LABELS[provider.state];

/**
 * Why it does not run, or what the catalog says about it: the server's message,
 * else the reason the catalog gives. Empty when there is nothing to say.
 */
export const getCommunityStateText = (provider: CommunityProvider): string =>
  provider.error?.message ?? provider.reason ?? "";

/** The installed ones, by name. */
export const getInstalledCommunityProviders = (
  providers: readonly CommunityProvider[],
): CommunityProvider[] =>
  providers.filter(isCommunityInstalled).sort((a, b) =>
    a.manifest.name.localeCompare(b.manifest.name, undefined, {
      sensitivity: "base",
    }),
  );

/** The page of a repository on GitHub, by its `owner/name`. */
export const getRepositoryUrl = (repository: string): string =>
  `https://github.com/${repository}`;

/**
 * A link the community catalog or a community manifest gives: only an https
 * address, else undefined.
 */
export const getCommunityLinkUrl = (
  url?: string | null,
): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
};

/**
 * A date the catalog gives, such as when a version was released, for display in
 * UTC; empty when it is not a date.
 *
 * @param isoDate - An ISO 8601 date.
 * @param locale - A BCP 47 locale tag.
 */
export const formatCatalogDate = (isoDate: string, locale: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
};
