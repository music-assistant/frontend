import { type ConfigEntry, Scope } from "@/plugins/api/interfaces";
import { Activity, CirclePlay, Library, Tags } from "@lucide/vue";
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

export type SettingsOwnerKind = "core";

// what defines config entries; for a core owner the id is the controller domain
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

// the row a settings section shows above its list, leading to the page
export interface SettingsPageLink {
  // the SettingsSection name of the menu item showing the row
  section: string;
  icon: Component;
  label: string;
  description: string;
  requiresScope?: Scope;
}

export interface SettingsPage {
  title: string;
  route: RouteLocationRaw;
  link?: SettingsPageLink;
  sources: readonly SettingsSource[];
}

export type SettingsPageId =
  | "audio_analysis"
  | "background_tasks"
  | "library"
  | "metadata"
  | "network"
  | "playback";

// a settings page with the row leading to it
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
export const AUDIO_ANALYSIS_CATEGORY = "audio_analysis";
// the category of an entry that names none
const GENERIC_CATEGORY = "generic";
// the log level every owner has, which follows the owner as a whole
const LOG_LEVEL_KEY = "log_level";

// the scope needed to change the settings of each kind of owner
const OWNER_WRITE_SCOPES: Readonly<Record<SettingsOwnerKind, Scope>> = {
  core: Scope.CONFIG_CORE_WRITE,
};

// the settings pages and the config entries each of them shows
export const SETTINGS_PAGES: Readonly<Record<SettingsPageId, SettingsPage>> = {
  audio_analysis: {
    title: "settings.audio_analysis_status.title",
    route: { name: "audioanalysissettings" },
    link: {
      section: "audio_analysis_providers",
      icon: Activity,
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
  background_tasks: {
    title: "background_tasks.title",
    route: { name: "backgroundtasks" },
    sources: [{ owner: coreOwner(TASKS_DOMAIN) }],
  },
  library: {
    title: "settings.library.title",
    route: { name: "librarysettings" },
    link: {
      section: "music_providers",
      icon: Library,
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
};

export function coreOwner(domain: string): SettingsOwner {
  return { kind: "core", id: domain };
}

/**
 * Whether a source shows the given entry of its owner. A source showing some
 * categories of its owner leaves out the log level of the owner.
 */
export function sourceIncludesEntry(
  source: SettingsSource,
  entry: ConfigEntry,
): boolean {
  if (!source.categories) return true;
  return (
    entry.key !== LOG_LEVEL_KEY &&
    source.categories.includes(entry.category || GENERIC_CATEGORY)
  );
}

/**
 * Whether a settings page shows the given entry of an owner.
 */
export function isEntryClaimed(
  owner: SettingsOwner,
  entry: ConfigEntry,
): boolean {
  return sourcesOf(owner).some((source) => sourceIncludesEntry(source, entry));
}

/**
 * The entries of an owner that a settings page shows, in their given order.
 */
export function claimedEntries<T extends ConfigEntry>(
  owner: SettingsOwner,
  entries: readonly T[],
): T[] {
  return entries.filter((entry) => isEntryClaimed(owner, entry));
}

/**
 * The settings page showing every entry of an owner, if any.
 */
export function pageOfWholeOwner(
  owner: SettingsOwner,
): SettingsPageId | undefined {
  return pageIds().find((id) =>
    SETTINGS_PAGES[id].sources.some(
      (source) => isSameOwner(source.owner, owner) && !source.categories,
    ),
  );
}

/**
 * Whether a settings page shows every entry of an owner.
 */
export function isOwnerFullyClaimed(owner: SettingsOwner): boolean {
  return pageOfWholeOwner(owner) !== undefined;
}

/**
 * The settings pages a settings section links to above its list.
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
 * Whether two owners are the same.
 */
export function isSameOwner(a: SettingsOwner, b: SettingsOwner): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function pageIds(): SettingsPageId[] {
  return Object.keys(SETTINGS_PAGES) as SettingsPageId[];
}

function sourcesOf(owner: SettingsOwner): SettingsSource[] {
  return pageIds().flatMap((id) =>
    SETTINGS_PAGES[id].sources.filter((source) =>
      isSameOwner(source.owner, owner),
    ),
  );
}
