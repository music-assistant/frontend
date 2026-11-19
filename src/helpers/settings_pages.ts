import { HASS_DOMAIN } from "@/helpers/home_assistant";
import type { SettingsColor } from "@/helpers/settings_colors";
import {
  type ConfigEntry,
  ProviderFeature,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import { Activity, CirclePlay, Library, Tags } from "@lucide/vue";
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

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
  // the heading of the source's entries on a page with several sources; left
  // out: its entries show under their categories
  title?: string;
}

// the tile a settings section shows above its lists, leading to the page
export interface SettingsPageLink {
  // the page showing the tile: the name of a SettingsSection, or the key of a
  // SectionPage below one
  section: string;
  icon: Component;
  color: SettingsColor;
  label: string;
  description: string;
  requiresScope?: Scope;
}

export interface SettingsPage {
  title: string;
  route: RouteLocationRaw;
  link?: SettingsPageLink;
  // the domain of the provider the page is about: the page manages it, so the
  // lists of providers leave it out
  provider?: string;
  sources: readonly SettingsSource[];
}

export type SettingsPageId =
  | "audio_analysis"
  | "diagnostics"
  | "home_assistant"
  | "library"
  | "metadata"
  | "network"
  | "playback"
  | "task_settings"
  | "user_management";

// the list of the plugins through which apps play audio into Music Assistant
export const AUDIO_SOURCES = ProviderFeature.AUDIO_SOURCE;

// the list a provider shows in: the providers of its type, or the audio sources
export type ProviderListType = ProviderType | typeof AUDIO_SOURCES;

// a settings page with the tile leading to it
export interface LinkedSettingsPage {
  id: SettingsPageId;
  route: RouteLocationRaw;
  link: SettingsPageLink;
}

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
export const AUDIO_ANALYSIS_CATEGORY = "audio_analysis";
export const ACCOUNT_ACCESS_CATEGORY = "account_access";
// the log level every core module has, which Diagnostics sets for every module
export const LOG_LEVEL_KEY = "log_level";
// the category of an entry that names none
const GENERIC_CATEGORY = "generic";

// the scope needed to change the settings of each kind of owner
const OWNER_WRITE_SCOPES: Readonly<Record<SettingsOwnerKind, Scope>> = {
  core: Scope.CONFIG_CORE_WRITE,
  provider: Scope.CONFIG_PROVIDERS_WRITE,
};

// the settings pages and the config entries each of them shows
export const SETTINGS_PAGES: Readonly<Record<SettingsPageId, SettingsPage>> = {
  audio_analysis: {
    title: "settings.audio_analysis_status.title",
    route: { name: "audioanalysissettings" },
    link: {
      section: "audio_analysis_providers",
      icon: Activity,
      color: "orange",
      label: "settings.audio_analysis_status.title",
      description: "settings.audio_analysis_status.description",
      requiresScope: Scope.SYSTEM_MANAGE,
    },
    sources: [
      {
        owner: coreOwner(STREAMS_DOMAIN),
        categories: [AUDIO_ANALYSIS_CATEGORY],
      },
    ],
  },
  diagnostics: {
    title: "settings.diagnostics",
    route: { name: "diagnostics" },
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
    title: "settings.home_assistant.title",
    route: { name: "homeassistantsettings" },
    provider: HASS_DOMAIN,
    sources: [
      {
        owner: providerOwner(HASS_DOMAIN),
        categories: ["player_controls"],
      },
    ],
  },
  library: {
    title: "settings.library.title",
    route: { name: "librarysettings" },
    link: {
      section: "music",
      icon: Library,
      color: "indigo",
      label: "settings.library.title",
      description: "settings.library.description",
      requiresScope: Scope.CONFIG_CORE_WRITE,
    },
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
    title: "settings.metadata.title",
    route: { name: "metadatasettings" },
    link: {
      section: "metadata_providers",
      icon: Tags,
      color: "green",
      label: "settings.metadata.title",
      description: "settings.metadata.description",
      requiresScope: Scope.CONFIG_CORE_WRITE,
    },
    sources: [{ owner: coreOwner(METADATA_DOMAIN) }],
  },
  network: {
    title: "settings.network.title",
    route: { name: "networksettings" },
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
    title: "settings.playback.title",
    route: { name: "playbacksettings" },
    link: {
      section: "players",
      icon: CirclePlay,
      color: "blue",
      label: "settings.playback.title",
      description: "settings.playback.description",
      requiresScope: Scope.CONFIG_CORE_WRITE,
    },
    // the sections follow the order of the sources
    sources: [
      { owner: coreOwner(PLAYER_QUEUES_DOMAIN) },
      {
        owner: coreOwner(STREAMS_DOMAIN),
        categories: ["playback", "crossfade", "volume_normalization"],
      },
      { owner: coreOwner(PLAYERS_DOMAIN) },
    ],
  },
  task_settings: {
    title: "background_tasks.settings.title",
    route: { name: "tasksettings" },
    sources: [{ owner: coreOwner(TASKS_DOMAIN) }],
  },
  user_management: {
    title: "auth.user_management",
    route: { name: "usersettings" },
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
  return (
    !source.categories ||
    source.categories.includes(entry.category || GENERIC_CATEGORY)
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
 * The settings pages a settings section links to above its lists.
 *
 * @param sectionName - The name of the settings section.
 * @param hasScope - Whether the role of the current user grants the given scope.
 */
export function settingsSectionLinks(
  sectionName: string | undefined,
  hasScope: (scope: Scope) => boolean,
): LinkedSettingsPage[] {
  const links: LinkedSettingsPage[] = [];
  for (const id of pageIds()) {
    const { route, link } = SETTINGS_PAGES[id];
    if (!link || link.section !== sectionName) continue;
    if (link.requiresScope && !hasScope(link.requiresScope)) continue;
    links.push({ id, route, link });
  }
  return links;
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
 * The page of a provider that has a settings page of its own.
 *
 * @param domain - The domain of the provider.
 */
export function providerSettingsPage(domain: string): SettingsPage | undefined {
  return pageIds()
    .map((id) => SETTINGS_PAGES[id])
    .find((page) => page.provider === domain);
}

/**
 * The list a provider shows in on the settings pages and in the Marketplace: a
 * plugin through which apps play audio into Music Assistant goes with the audio
 * sources, any other provider with the providers of its type. A provider with a
 * settings page of its own is managed from that page instead of a list.
 *
 * @param type - The type of the provider.
 * @param features - The features its manifest says it always offers.
 */
export function providerListType(
  type: ProviderType,
  features: readonly ProviderFeature[] = [],
): ProviderListType {
  return type === ProviderType.PLUGIN && features.includes(AUDIO_SOURCES)
    ? AUDIO_SOURCES
    : type;
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
  const sources = (providerSettingsPage(domain)?.sources ?? []).filter(
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
