import GenreIcon from "@/components/icons/GenreIcon.vue";
import type { SettingsColor } from "@/helpers/settings_colors";
import {
  providerListType,
  providerSettingsPageId,
  type SettingsPageId,
} from "@/helpers/settings_pages";
import {
  type ProviderConfig,
  type ProviderOffering,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import {
  AudioWaveform,
  Blocks,
  CirclePlay,
  CloudCog,
  FileCode,
  HardDrive,
  House,
  Info,
  Library,
  ListChecks,
  MonitorSmartphone,
  Music,
  Network,
  PanelsTopLeft,
  Puzzle,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Speaker,
  Stethoscope,
  UserCog,
  Users,
} from "@lucide/vue";
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

// a page of the settings menu: a section of the settings overview, or a page
// below one
export interface SettingsMenuPage {
  key: string;
  // the key of the page above it; left out on a section of the overview
  parent?: string;
  // the heading of the page, as its card or tile in the menu shows it
  label: string;
  description: string;
  icon: Component;
  color: SettingsColor;
  route: { name: string };
  // only a role granting this scope may open the page
  requiresScope?: Scope;
  // the type of the providers the page lists, whose tile says how many run
  providerType?: ProviderType;
}

// what heads a settings page
export type SettingsHeading = Pick<
  SettingsMenuPage,
  "label" | "description" | "icon" | "color"
>;

// the sections of the settings overview, in display order
export const SETTINGS_SECTIONS: readonly SettingsMenuPage[] = [
  {
    key: "catalog",
    label: "settings.catalog.title",
    description: "settings.catalog.description",
    icon: Blocks,
    color: "orange",
    route: { name: "catalog" },
    // a member adds music sources of its own from it
    requiresScope: Scope.CONFIG_PROVIDERS_OWN,
  },
  {
    key: "music",
    label: "settings.music",
    description: "settings.music_description",
    icon: Music,
    color: "blue",
    route: { name: "musicsettings" },
    // a member sees the music sources it may use here, and manages its own
    requiresScope: Scope.CONFIG_PROVIDERS_READ,
  },
  {
    key: "players",
    label: "settings.players",
    description: "settings.players_description",
    icon: SlidersHorizontal,
    color: "teal",
    route: { name: "playersettings" },
    requiresScope: Scope.CONFIG_PLAYERS_WRITE,
  },
  {
    key: "plugin_providers",
    label: "settings.plugins",
    description: "settings.plugin_providers_description",
    icon: Puzzle,
    color: "deep-purple",
    route: { name: "pluginproviders" },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
  },
  {
    key: "ai",
    label: "settings.ai.title",
    description: "settings.ai.description",
    icon: Sparkles,
    color: "pink",
    route: { name: "aisettings" },
    requiresScope: Scope.CONFIG_CORE_WRITE,
  },
  {
    key: "profile",
    label: "auth.profile",
    description: "settings.profile_description",
    icon: UserCog,
    color: "indigo",
    route: { name: "profile" },
  },
  {
    key: "users",
    label: "auth.user_management",
    description: "settings.users_description",
    icon: Users,
    color: "teal",
    route: { name: "usersettings" },
    requiresScope: Scope.USERS_READ,
  },
  {
    key: "system",
    label: "settings.system",
    description: "settings.system_description",
    icon: Server,
    color: "purple",
    route: { name: "systemsettings" },
    requiresScope: Scope.CONFIG_CORE_WRITE,
  },
  {
    key: "about",
    label: "settings.about",
    description: "settings.about_description",
    icon: Info,
    color: "grey-darken-1",
    route: { name: "aboutsettings" },
  },
];

// the pages below the sections, in the order the page above lists them. A
// settings page is listed under its SettingsPageId; a page the page above
// leads to with a row instead of a tile has the colour of that page.
export const SECTION_PAGES: readonly SettingsMenuPage[] = [
  {
    key: "library",
    parent: "music",
    icon: Library,
    color: "indigo",
    label: "settings.library.title",
    description: "settings.library.description",
    route: { name: "librarysettings" },
    requiresScope: Scope.CONFIG_CORE_WRITE,
  },
  {
    key: "genres",
    parent: "music",
    icon: GenreIcon,
    color: "pink",
    label: "settings.genre_management",
    description: "settings.genre_management_description",
    route: { name: "genremanagement" },
    requiresScope: Scope.LIBRARY_MANAGE,
  },
  {
    key: "metadata",
    parent: "music",
    icon: FileCode,
    color: "green",
    label: "metadata",
    description: "settings.metadata_description",
    route: { name: "metadataproviders" },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
    providerType: ProviderType.METADATA,
  },
  {
    key: "audio_analysis",
    parent: "music",
    icon: AudioWaveform,
    color: "orange",
    label: "settings.audio_analysis_providers",
    description: "settings.audio_analysis_description",
    route: { name: "audioanalysisproviders" },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
    providerType: ProviderType.AUDIO_ANALYSIS,
  },
  {
    key: "playback",
    parent: "players",
    icon: CirclePlay,
    color: "blue",
    label: "settings.playback.title",
    description: "settings.playback.description",
    route: { name: "playbacksettings" },
    requiresScope: Scope.CONFIG_CORE_WRITE,
  },
  {
    key: "player_support",
    parent: "players",
    icon: Speaker,
    color: "teal",
    label: "settings.playerproviders",
    description: "settings.player_providers_description",
    route: { name: "playerproviders" },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
    providerType: ProviderType.PLAYER,
  },
  {
    key: "network",
    parent: "system",
    icon: Network,
    color: "blue",
    label: "settings.network.title",
    description: "settings.network.description",
    route: { name: "networksettings" },
    requiresScope: Scope.CONFIG_CORE_WRITE,
  },
  {
    key: "remote_access",
    parent: "network",
    icon: CloudCog,
    color: "blue",
    label: "settings.remote_access",
    description: "settings.remote_access_description",
    route: { name: "remoteaccesssettings" },
    requiresScope: Scope.SYSTEM_MANAGE,
  },
  {
    key: "storage",
    parent: "system",
    icon: HardDrive,
    color: "orange",
    label: "settings.storage.title",
    description: "settings.storage.description",
    route: { name: "storagesettings" },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
  },
  {
    key: "home_assistant",
    parent: "system",
    icon: House,
    color: "cyan",
    label: "settings.home_assistant.title",
    description: "settings.home_assistant.description",
    route: { name: "homeassistantsettings" },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
  },
  {
    key: "background_tasks",
    parent: "system",
    icon: ListChecks,
    color: "green",
    label: "background_tasks.title",
    description: "background_tasks.description",
    route: { name: "backgroundtasks" },
    requiresScope: Scope.SYSTEM_READ,
  },
  {
    key: "diagnostics",
    parent: "system",
    icon: Stethoscope,
    color: "red",
    label: "settings.diagnostics",
    description: "settings.diagnostics_description",
    route: { name: "diagnostics" },
    requiresScope: Scope.SYSTEM_MANAGE,
  },
  {
    key: "interface",
    parent: "profile",
    icon: PanelsTopLeft,
    color: "indigo",
    label: "auth.profile_pages.interface",
    description: "auth.profile_pages.interface_description",
    route: { name: "profileinterface" },
  },
  {
    key: "device",
    parent: "profile",
    icon: MonitorSmartphone,
    color: "indigo",
    label: "auth.profile_pages.device",
    description: "auth.profile_pages.device_description",
    route: { name: "profiledevice" },
  },
  {
    key: "security",
    parent: "profile",
    icon: ShieldCheck,
    color: "indigo",
    label: "auth.profile_pages.security",
    description: "auth.profile_pages.security_description",
    route: { name: "profilesecurity" },
  },
];

// the settings sections that list the providers of a type themselves; a page
// below a section lists any other type
const PROVIDER_TYPE_SECTIONS: Readonly<Partial<Record<ProviderType, string>>> =
  {
    [ProviderType.MUSIC]: "music",
    [ProviderType.PLUGIN]: "plugin_providers",
  };

// the page listing the providers of a type no page lists
const DEFAULT_PROVIDER_LIST = "music";

/**
 * The settings sections the current user may open.
 *
 * @param hasScope - Whether the role of the current user grants the given scope.
 */
export function availableSettingsSections(
  hasScope: (scope: Scope) => boolean,
): SettingsMenuPage[] {
  return SETTINGS_SECTIONS.filter((section) => mayOpen(section, hasScope));
}

/**
 * The pages directly below a page of the settings menu that the current user
 * may open, in the order the page lists them.
 *
 * @param parent - The key of the page above them.
 * @param hasScope - Whether the role of the current user grants the given scope.
 */
export function sectionPages(
  parent: string | undefined,
  hasScope: (scope: Scope) => boolean,
): SettingsMenuPage[] {
  return SECTION_PAGES.filter(
    (page) => page.parent === parent && mayOpen(page, hasScope),
  );
}

/**
 * A page of the settings menu.
 *
 * @param key - The key of the page.
 */
export function settingsMenuPage(
  key: string | undefined,
): SettingsMenuPage | undefined {
  return menuPages().find((page) => page.key === key);
}

/**
 * The page of the settings menu a route shows.
 *
 * @param routeName - The name of the route.
 */
export function routeSettingsPage(
  routeName: string | undefined,
): SettingsMenuPage | undefined {
  return menuPages().find((page) => page.route.name === routeName);
}

/**
 * A page of the settings menu and every page above it, from its section of
 * the settings overview down to the page itself.
 *
 * @param key - The key of the page.
 */
export function settingsTrail(key: string | undefined): SettingsMenuPage[] {
  const trail: SettingsMenuPage[] = [];
  for (
    let page = settingsMenuPage(key);
    page;
    page = settingsMenuPage(page.parent)
  ) {
    trail.unshift(page);
  }
  return trail;
}

/**
 * The route of a settings page.
 *
 * @param id - The settings page.
 */
export function settingsPageRoute(id: SettingsPageId): RouteLocationRaw {
  // every settings page is a page of the menu under its own id
  return settingsMenuPage(id)!.route;
}

/**
 * The page below a settings section listing the providers of a type, for a
 * type no section lists itself.
 */
export function providerListPage(
  type: string | undefined,
): SettingsMenuPage | undefined {
  if (!type) return undefined;
  return SECTION_PAGES.find((page) => page.providerType === type);
}

/**
 * The key of the page listing the providers of a type, which the tiles on it
 * name: a settings section, or a page below one.
 */
export function providerListName(type: string | undefined): string | undefined {
  return typeSectionName(type) ?? providerListPage(type)?.key;
}

/**
 * The page showing a list of providers: its settings section, or the page
 * below one listing them. A type no page lists leads to the music sources.
 *
 * @param type - The list type, as `providerListType` gives it.
 */
export function providerListRoute(type: string): SettingsMenuPage["route"] {
  return settingsMenuPage(providerListName(type) ?? DEFAULT_PROVIDER_LIST)!
    .route;
}

/**
 * The settings page of its own a provider has, which manages it instead of a
 * list of providers.
 *
 * @param domain - The domain of the provider.
 */
export function providerOwnPage(domain: string): SettingsMenuPage | undefined {
  const pageId = providerSettingsPageId(domain);
  return pageId ? settingsMenuPage(pageId) : undefined;
}

/**
 * Where a provider is managed besides its own settings: the settings page of its
 * own, or the page showing its list.
 *
 * @param config - The provider instance.
 * @param provides - What its manifest says it provides.
 */
export function providerListingRoute(
  config: Pick<ProviderConfig, "domain" | "type">,
  provides?: readonly ProviderOffering[],
): RouteLocationRaw {
  return (
    providerOwnPage(config.domain)?.route ??
    providerListRoute(providerListType(config.type, provides))
  );
}

/**
 * The heading of a page of the settings menu, as its card on the settings
 * overview or its tile shows it.
 *
 * @param key - The key of the page.
 */
export function settingsHeading(
  key: string | undefined,
): SettingsHeading | undefined {
  return settingsMenuPage(key);
}

function menuPages(): readonly SettingsMenuPage[] {
  return [...SETTINGS_SECTIONS, ...SECTION_PAGES];
}

function mayOpen(
  page: SettingsMenuPage,
  hasScope: (scope: Scope) => boolean,
): boolean {
  return !page.requiresScope || hasScope(page.requiresScope);
}

function typeSectionName(type: string | undefined): string | undefined {
  return Object.entries(PROVIDER_TYPE_SECTIONS).find(
    ([providerType]) => providerType === type,
  )?.[1];
}
