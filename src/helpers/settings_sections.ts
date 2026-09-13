import { Scope } from "@/plugins/api/interfaces";
import type { RouteLocationRaw } from "vue-router";

export interface SettingsSection {
  name: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  route: RouteLocationRaw;
  // only a role granting this scope sees the section
  requiresScope?: Scope;
  minServerVersion?: string;
}

// the sections of the settings overview, in display order
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    name: "music_providers",
    label: "settings.music_sources",
    description: "settings.music_providers_description",
    icon: "mdi-music",
    color: "blue",
    route: { name: "providersettings", query: { types: "music" } },
    // a member holding the scope manages the music sources it owns here
    requiresScope: Scope.CONFIG_PROVIDERS_OWN,
  },
  {
    name: "player_providers",
    label: "settings.playerproviders",
    description: "settings.player_providers_description",
    icon: "mdi-speaker-multiple",
    color: "green",
    route: { name: "providersettings", query: { types: "player" } },
    // the provider types share the route a member opens for its own music
    // sources, managing any other type takes managing every provider
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
  },
  {
    name: "metadata_providers",
    label: "settings.metadataproviders",
    description: "settings.metadata_providers_description",
    icon: "mdi-file-code",
    color: "indigo",
    route: { name: "providersettings", query: { types: "metadata" } },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
  },
  {
    name: "plugin_providers",
    label: "settings.plugins",
    description: "settings.plugin_providers_description",
    icon: "mdi-puzzle",
    color: "deep-purple",
    route: { name: "providersettings", query: { types: "plugin" } },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
  },
  {
    name: "players",
    label: "settings.players",
    description: "settings.players_description",
    icon: "mdi-tune",
    color: "teal",
    route: { name: "playersettings" },
    requiresScope: Scope.CONFIG_PLAYERS_WRITE,
  },
  {
    name: "audio_analysis_providers",
    label: "settings.audio_analysis_providers",
    description: "settings.audio_analysis_providers_description",
    icon: "mdi-waveform",
    color: "blue",
    route: { name: "providersettings", query: { types: "audio_analysis" } },
    requiresScope: Scope.CONFIG_PROVIDERS_WRITE,
    minServerVersion: "2.9.0",
  },
  {
    name: "profile",
    label: "auth.profile",
    description: "settings.profile_description",
    icon: "mdi-account-cog",
    color: "indigo",
    route: { name: "profile" },
  },
  {
    name: "frontend",
    label: "settings.frontend",
    description: "settings.frontend_description",
    icon: "mdi-palette",
    color: "orange",
    route: { name: "frontendsettings" },
  },
  {
    name: "users",
    label: "auth.user_management",
    description: "settings.users_description",
    icon: "mdi-account-multiple",
    color: "teal",
    route: { name: "usersettings" },
    requiresScope: Scope.USERS_READ,
  },
  {
    name: "remote_access",
    label: "settings.remote_access",
    description: "settings.remote_access_description",
    icon: "mdi-cloud-lock",
    color: "deep-purple",
    route: { name: "remoteaccesssettings" },
    requiresScope: Scope.SYSTEM_MANAGE,
  },
  {
    name: "system",
    label: "settings.system",
    description: "settings.system_description",
    icon: "mdi-server",
    color: "purple",
    route: { name: "systemsettings" },
    requiresScope: Scope.CONFIG_CORE_WRITE,
  },
  {
    name: "about",
    label: "settings.about",
    description: "settings.about_description",
    icon: "mdi-information-outline",
    color: "grey-darken-1",
    route: { name: "aboutsettings" },
  },
];

/**
 * The settings sections the current user may open on the connected server.
 *
 * @param hasScope - Whether the role of the current user grants the given scope.
 * @param serverVersionAtLeast - Whether the connected server runs at least the given version.
 */
export function availableSettingsSections(
  hasScope: (scope: Scope) => boolean,
  serverVersionAtLeast: (version: string) => boolean,
): SettingsSection[] {
  return SETTINGS_SECTIONS.filter(
    (section) =>
      (!section.requiresScope || hasScope(section.requiresScope)) &&
      (!section.minServerVersion ||
        serverVersionAtLeast(section.minServerVersion)),
  );
}
