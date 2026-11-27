import { MCP_SERVER_DOMAIN } from "@/helpers/ai_engines";
import { HASS_DOMAIN } from "@/helpers/home_assistant";
import { isAudioSourcePlugin } from "@/helpers/provider_config";
import {
  type ConfigEntry,
  type ProviderOffering,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";

export type SettingsOwnerKind = "core" | "provider";

// what defines config entries; for a core owner the id is the controller
// domain, for a provider owner the domain of a provider with a single instance
export interface SettingsOwner {
  kind: SettingsOwnerKind;
  id: string;
}

export interface SettingsSource {
  owner: SettingsOwner;
  // the categories of the owner's entries the page shows; left out: all of them
  categories?: readonly string[];
  // the categories of the owner's entries the page leaves to other pages
  excludedCategories?: readonly string[];
  // the heading of the source's entries on a page with several sources; left
  // out: its entries show under their categories
  title?: string;
}

// the settings a settings page shows; the page of the settings menu under the
// same id gives its route and heading
export interface SettingsPage {
  // the domain of the provider the page is about: the page manages it, so the
  // lists of providers leave it out
  provider?: string;
  sources: readonly SettingsSource[];
}

export type SettingsPageId =
  | "ai"
  | "audio_analysis"
  | "background_tasks"
  | "diagnostics"
  | "home_assistant"
  | "library"
  | "metadata"
  | "network"
  | "playback"
  | "tap_and_play"
  | "users";

export const STREAMS_DOMAIN = "streams";
export const TASKS_DOMAIN = "tasks";
export const WEBSERVER_DOMAIN = "webserver";
export const DISCOVERY_DOMAIN = "discovery";
export const PLAYER_QUEUES_DOMAIN = "player_queues";
export const PLAYERS_DOMAIN = "players";
export const MUSIC_DOMAIN = "music";
export const METADATA_DOMAIN = "metadata";
export const CACHE_DOMAIN = "cache";
export const STATISTICS_DOMAIN = "statistics";
export const AI_DOMAIN = "ai";
export const AUDIO_ANALYSIS_CATEGORY = "audio_analysis";
export const ACCOUNT_ACCESS_CATEGORY = "account_access";
// the log level every core module has, which Diagnostics sets for every module
export const LOG_LEVEL_KEY = "log_level";
// the category of an entry that names none
const GENERIC_CATEGORY = "generic";
// the categories of the queue settings about what clicking or playing an item does
const TAP_AND_PLAY_CATEGORIES = [
  "click_actions",
  "default_enqueue_option",
  "items_to_select",
];

// the scope needed to change the settings of each kind of owner
const OWNER_WRITE_SCOPES: Readonly<Record<SettingsOwnerKind, Scope>> = {
  core: Scope.CONFIG_CORE_WRITE,
  provider: Scope.CONFIG_PROVIDERS_WRITE,
};

// the settings pages and the config entries each of them shows
export const SETTINGS_PAGES: Readonly<Record<SettingsPageId, SettingsPage>> = {
  ai: {
    // the page switches access for AI assistants on and off
    provider: MCP_SERVER_DOMAIN,
    sources: [{ owner: coreOwner(AI_DOMAIN) }],
  },
  audio_analysis: {
    sources: [
      {
        owner: coreOwner(STREAMS_DOMAIN),
        categories: [AUDIO_ANALYSIS_CATEGORY],
      },
    ],
  },
  background_tasks: {
    sources: [{ owner: coreOwner(TASKS_DOMAIN) }],
  },
  diagnostics: {
    sources: [
      {
        owner: coreOwner(CACHE_DOMAIN),
        title: "settings.core_module.cache.name",
      },
      // the statistics module has no settings besides its log level
      {
        owner: coreOwner(STATISTICS_DOMAIN),
        title: "settings.core_module.statistics.name",
      },
    ],
  },
  home_assistant: {
    provider: HASS_DOMAIN,
    sources: [
      {
        owner: providerOwner(HASS_DOMAIN),
        categories: ["player_controls"],
      },
    ],
  },
  library: {
    // the sections follow the order of the sources: which source plays leads
    sources: [
      {
        owner: coreOwner(STREAMS_DOMAIN),
        categories: ["source_selection"],
        title: "settings.library.source_selection",
      },
      {
        owner: coreOwner(MUSIC_DOMAIN),
        title: "settings.library.maintenance",
      },
    ],
  },
  metadata: {
    sources: [{ owner: coreOwner(METADATA_DOMAIN) }],
  },
  network: {
    sources: [
      {
        owner: coreOwner(WEBSERVER_DOMAIN),
        categories: [GENERIC_CATEGORY],
        title: "settings.network.web",
      },
      {
        owner: coreOwner(STREAMS_DOMAIN),
        categories: [GENERIC_CATEGORY],
        title: "settings.network.streaming",
      },
      {
        owner: coreOwner(DISCOVERY_DOMAIN),
        title: "settings.network.discovery",
      },
    ],
  },
  playback: {
    // the sections follow the order of the sources
    sources: [
      // a category of the queue settings Tap & play does not show lands here
      {
        owner: coreOwner(PLAYER_QUEUES_DOMAIN),
        excludedCategories: TAP_AND_PLAY_CATEGORIES,
      },
      {
        owner: coreOwner(STREAMS_DOMAIN),
        categories: ["playback", "crossfade", "volume_normalization"],
      },
      { owner: coreOwner(PLAYERS_DOMAIN) },
    ],
  },
  tap_and_play: {
    sources: [
      {
        owner: coreOwner(PLAYER_QUEUES_DOMAIN),
        categories: TAP_AND_PLAY_CATEGORIES,
      },
    ],
  },
  users: {
    sources: [
      {
        owner: coreOwner(WEBSERVER_DOMAIN),
        categories: [ACCOUNT_ACCESS_CATEGORY],
      },
    ],
  },
};

export function coreOwner(domain: string): SettingsOwner {
  return { kind: "core", id: domain };
}

export function providerOwner(domain: string): SettingsOwner {
  return { kind: "provider", id: domain };
}

/**
 * Whether a source shows the given entry of its owner. No source shows the log
 * level of its owner: Diagnostics sets the log level of every module, and the
 * page of a provider instance its own.
 */
export function sourceIncludesEntry(
  source: SettingsSource,
  entry: ConfigEntry,
): boolean {
  if (entry.key === LOG_LEVEL_KEY) return false;
  const category = entry.category || GENERIC_CATEGORY;
  return (
    (!source.categories || source.categories.includes(category)) &&
    !source.excludedCategories?.includes(category)
  );
}

/**
 * Whether a settings page shows settings of an owner, all of them or some.
 */
export function isKnownOwner(owner: SettingsOwner): boolean {
  return pageIds().some((id) =>
    SETTINGS_PAGES[id].sources.some((source) =>
      isSameOwner(source.owner, owner),
    ),
  );
}

/**
 * Whether the current user may change the settings a page shows.
 *
 * @param pageId - The settings page.
 * @param hasScope - Whether the role of the current user grants the given scope.
 */
export function canEditSettingsPage(
  pageId: SettingsPageId,
  hasScope: (scope: Scope) => boolean,
): boolean {
  return SETTINGS_PAGES[pageId].sources.every((source) =>
    hasScope(OWNER_WRITE_SCOPES[source.owner.kind]),
  );
}

/**
 * The settings page of its own a provider has, which manages it instead of a
 * list of providers.
 *
 * @param domain - The domain of the provider.
 */
export function providerSettingsPageId(
  domain: string,
): SettingsPageId | undefined {
  return pageIds().find((id) => SETTINGS_PAGES[id].provider === domain);
}

/**
 * The settings page showing the settings of a core module, the first of them
 * when several pages each show some of its settings.
 *
 * @param domain - The domain of the core module.
 */
export function coreSettingsPageId(domain: string): SettingsPageId | undefined {
  const owner = coreOwner(domain);
  return pageIds().find((id) =>
    SETTINGS_PAGES[id].sources.some((source) =>
      isSameOwner(source.owner, owner),
    ),
  );
}

/**
 * The list a provider shows in on the settings pages and in the Marketplace: a
 * plugin through which apps play audio into Music Assistant goes with the music
 * sources, any other provider with the providers of its type. A provider with a
 * settings page of its own is managed from that page instead of a list.
 *
 * @param type - The type of the provider.
 * @param provides - What its manifest says it provides.
 */
export function providerListType(
  type: ProviderType,
  provides?: readonly ProviderOffering[],
): ProviderType {
  return isAudioSourcePlugin({ type, provides }) ? ProviderType.MUSIC : type;
}

/**
 * The settings of a provider that its own settings page shows, in their given
 * order: the page of the provider instance leaves them out.
 *
 * @param domain - The domain of the provider.
 * @param entries - The settings of the provider instance.
 */
export function providerPageEntries<T extends ConfigEntry>(
  domain: string,
  entries: readonly T[],
): T[] {
  const owner = providerOwner(domain);
  const pageId = providerSettingsPageId(domain);
  const sources = (pageId ? SETTINGS_PAGES[pageId].sources : []).filter(
    (source) => isSameOwner(source.owner, owner),
  );
  return entries.filter((entry) =>
    sources.some((source) => sourceIncludesEntry(source, entry)),
  );
}

/**
 * The domain of the provider a page shows the settings of, when it shows no
 * other settings: the form of such a page keys them as the provider does.
 *
 * @param pageId - The settings page.
 */
export function settingsPageProviderDomain(
  pageId: SettingsPageId,
): string | undefined {
  const { sources } = SETTINGS_PAGES[pageId];
  const owner = sources.length === 1 ? sources[0].owner : undefined;
  return owner?.kind === "provider" ? owner.id : undefined;
}

/**
 * Whether two owners are the same.
 */
export function isSameOwner(a: SettingsOwner, b: SettingsOwner): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function pageIds(): SettingsPageId[] {
  return Object.keys(SETTINGS_PAGES) as SettingsPageId[];
}
