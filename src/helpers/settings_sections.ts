import GenreIcon from "@/components/icons/GenreIcon.vue";
import type { SettingsColor } from "@/helpers/settings_colors";
import {
  AUDIO_SOURCES,
  type ProviderListType,
  providerListType,
  providerSettingsPage,
  settingsSectionLinks,
} from "@/helpers/settings_pages";
import {
  type ProviderConfig,
  type ProviderFeature,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import {
  AudioWaveform,
  Blocks,
  FileCode,
  Info,
  Music,
  Puzzle,
  Server,
  SlidersHorizontal,
  Speaker,
  UserCog,
  Users,
} from "@lucide/vue";
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface SettingsSection {
  name: string;
  label: string;
  description: string;
  icon: Component;
  color: SettingsColor;
  route: RouteLocationRaw;
  // only a role granting this scope sees the section
  requiresScope?: Scope;
}

// a page below a settings section that is no settings page, with the tile
// leading to it
export interface SectionPage {
  key: string;
  // the SettingsSection name of the menu item showing the tile
  section: string;
  icon: Component;
  color: SettingsColor;
  label: string;
  description: string;
  route: RouteLocationRaw;
  // the scope the route of the page needs
  requiresScope: Scope;
  // the type of the providers the page lists, whose tile says how many run
  providerType?: ProviderType;
}

// the sections of the settings overview, in display order
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    name: "catalog",
    label: "settings.catalog.title",
    description: "settings.catalog.description",
    icon: Blocks,
    color: "orange",
    route: { name: "catalog" },
    // a member adds music sources of its own from it
    requiresScope: Scope.CONFIG_PROVIDERS_OWN,
  },
  {
    name: "music",
    label: "settings.music",
    description: "settings.music_description",
    icon: Music,
    color: "blue",
    route: { name: "providersettings", query: { types: "music" } },
    // a member sees the music sources it may use here, and manages its own
    requiresScope: Scope.CONFIG_PROVIDERS_READ,
  },
  {
    name: "players",
    label: "settings.players",
    description: "settings.players_description",
    icon: SlidersHorizontal,
    color: "teal",
    route: { name: "playersettings" },
    requiresScope: Scope.CONFIG_PLAYERS_WRITE,
  },
  {
    name: "plugin_providers",
    label: "settings.plugins",
    description: "settings.plugin_providers_description",
    icon: Puzzle,
    color: "deep-purple",
    route: { name: "providersettings", query: { types: "plugin" } },
    // the provider types share the route a member opens for its own music
    // sources, managing any other type takes managing every provider
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
  },
  {
    name: "profile",
    label: "auth.profile",
    description: "settings.profile_description",
    icon: UserCog,
    color: "indigo",
    route: { name: "profile" },
  },
  {
    name: "users",
    label: "auth.user_management",
    description: "settings.users_description",
    icon: Users,
    color: "teal",
    route: { name: "usersettings" },
    requiresScope: Scope.USERS_READ,
  },
  {
    name: "system",
    label: "settings.system",
    description: "settings.system_description",
    icon: Server,
    color: "purple",
    route: { name: "systemsettings" },
    requiresScope: Scope.CONFIG_CORE_WRITE,
  },
  {
    name: "about",
    label: "settings.about",
    description: "settings.about_description",
    icon: Info,
    color: "grey-darken-1",
    route: { name: "aboutsettings" },
  },
];

// the pages below the settings sections that are no settings page, in the
// order of their tiles, which follow the tiles of the settings pages
export const SECTION_PAGES: readonly SectionPage[] = [
  {
    key: "player_support",
    section: "players",
    icon: Speaker,
    color: "teal",
    label: "settings.playerproviders",
    description: "settings.player_providers_description",
    route: { name: "providersettings", query: { types: ProviderType.PLAYER } },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
    providerType: ProviderType.PLAYER,
  },
  {
    key: "genres",
    section: "music",
    icon: GenreIcon,
    color: "pink",
    label: "settings.genre_management",
    description: "settings.genre_management_description",
    route: { name: "genremanagement" },
    requiresScope: Scope.LIBRARY_MANAGE,
  },
  {
    key: "metadata_providers",
    section: "music",
    icon: FileCode,
    color: "green",
    label: "metadata",
    description: "settings.metadata_providers_description",
    route: {
      name: "providersettings",
      query: { types: ProviderType.METADATA },
    },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
    providerType: ProviderType.METADATA,
  },
  {
    key: "audio_analysis_providers",
    section: "music",
    icon: AudioWaveform,
    color: "orange",
    label: "settings.audio_analysis_providers",
    description: "settings.audio_analysis_providers_description",
    route: {
      name: "providersettings",
      query: { types: ProviderType.AUDIO_ANALYSIS },
    },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
    providerType: ProviderType.AUDIO_ANALYSIS,
  },
];

// the settings sections that show lists of providers themselves, in the order
// of their lists; a page below a section lists the providers of any other type
const PROVIDER_TYPE_SECTIONS: Readonly<
  Partial<Record<ProviderListType, string>>
> = {
  [ProviderType.MUSIC]: "music",
  [AUDIO_SOURCES]: "music",
  [ProviderType.PLUGIN]: "plugin_providers",
};

/**
 * The settings sections the current user may open.
 *
 * @param hasScope - Whether the role of the current user grants the given scope.
 */
export function availableSettingsSections(
  hasScope: (scope: Scope) => boolean,
): SettingsSection[] {
  return SETTINGS_SECTIONS.filter(
    (section) => !section.requiresScope || hasScope(section.requiresScope),
  );
}

/**
 * The pages below a settings section that the current user may open, in the
 * order of their tiles.
 *
 * @param sectionName - The name of the settings section.
 * @param hasScope - Whether the role of the current user grants the given scope.
 */
export function sectionPages(
  sectionName: string | undefined,
  hasScope: (scope: Scope) => boolean,
): SectionPage[] {
  return SECTION_PAGES.filter(
    (page) => page.section === sectionName && hasScope(page.requiresScope),
  );
}

/**
 * The page below a settings section listing the providers of a type, for a
 * type no section lists itself.
 */
export function providerListPage(
  type: string | undefined,
): SectionPage | undefined {
  if (!type) return undefined;
  return SECTION_PAGES.find((page) => page.providerType === type);
}

/**
 * The name of the page listing the providers of a type, which the tiles on it
 * name: a settings section, or the key of a page below one.
 */
export function providerListName(type: string | undefined): string | undefined {
  return typeSectionName(type) ?? providerListPage(type)?.key;
}

/**
 * The name of the settings section listing the providers of a type, or holding
 * the page that lists them.
 */
export function providerSettingsSectionName(
  type: string | undefined,
): string | undefined {
  return typeSectionName(type) ?? providerListPage(type)?.section;
}

/**
 * The lists of providers on the page listing the providers of a type, in
 * display order: every list of the settings section listing them, or the list
 * of the type alone on a page below a section.
 *
 * @param type - The provider type the route of the page names.
 */
export function pageProviderLists(type: string): string[] {
  const sectionName = typeSectionName(type);
  if (!sectionName) return [type];
  return Object.entries(PROVIDER_TYPE_SECTIONS)
    .filter(([, name]) => name === sectionName)
    .map(([listType]) => listType);
}

/**
 * The page showing a list of providers: its settings section, or the page
 * below one listing them.
 *
 * @param type - The list type, as `providerListType` gives it.
 */
export function providerListRoute(type: string): RouteLocationRaw {
  const name = providerListName(type);
  const page =
    SETTINGS_SECTIONS.find((section) => section.name === name) ??
    SECTION_PAGES.find((sectionPage) => sectionPage.key === name);
  return page?.route ?? { name: "providersettings", query: { types: type } };
}

/**
 * Where a provider is managed besides its own settings: the settings page of its
 * own, or the page showing its list.
 *
 * @param config - The provider instance.
 * @param features - The features its manifest says it always offers.
 */
export function providerListingRoute(
  config: Pick<ProviderConfig, "domain" | "type">,
  features?: readonly ProviderFeature[],
): RouteLocationRaw {
  return (
    providerSettingsPage(config.domain)?.route ??
    providerListRoute(providerListType(config.type, features))
  );
}

/**
 * The title and description of a settings section or of a page below one, as
 * its card on the settings page or its tile gives them.
 *
 * @param name - The name of the settings section, or the key of the page.
 */
export function settingsHeading(
  name: string | undefined,
): Pick<SettingsSection, "label" | "description"> | undefined {
  return (
    SETTINGS_SECTIONS.find((section) => section.name === name) ??
    SECTION_PAGES.find((page) => page.key === name)
  );
}

/**
 * Whether a settings section or a page below one is a hub: a page leading to
 * pages below it, whichever of them the current user may open.
 *
 * @param name - The name of the settings section, or the key of the page.
 */
export function isSettingsHub(name: string | undefined): boolean {
  return (
    SECTION_PAGES.some((page) => page.section === name) ||
    settingsSectionLinks(name, () => true).length > 0
  );
}

function typeSectionName(type: string | undefined): string | undefined {
  return Object.entries(PROVIDER_TYPE_SECTIONS).find(
    ([providerType]) => providerType === type,
  )?.[1];
}
