// Everything that can be done to a provider instance from the settings surfaces: the
// menu on the sources list and the menu on the settings page of a source. Both build
// their menu from here so the two never drift apart.
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  canConfigureSourceAccess,
  canReconfigureSource,
  canToggleSource,
  managesAllSources,
} from "@/helpers/provider_permissions";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderFeature,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import router from "@/plugins/router";
import {
  BookOpen,
  CircleOff,
  Copy,
  KeyRound,
  Power,
  RefreshCw,
  RotateCw,
  Settings,
  Speaker,
  Trash2,
  Wrench,
} from "@lucide/vue";
import { markRaw } from "vue";

export interface ProviderSettingsMenuOptions {
  // include what the settings page of the source offers elsewhere on the page:
  // its options, access, library sync and players, reconfiguring and the
  // documentation; the page itself leaves these out
  includeSections?: boolean;
  onToggleEnabled: (config: ProviderConfig) => void;
  onReload: (instanceId: string) => void;
  onRemove: (config: ProviderConfig) => void;
  // only offered with includeSections
  onAccess?: (config: ProviderConfig) => void;
  onReconfigure?: (config: ProviderConfig) => void;
}

/** Which settings sections a provider instance has something to show for. */
export const getProviderSettingsSections = (config: ProviderConfig) => {
  const provider = api.getProvider(config.instance_id);
  return {
    access: canConfigureSourceAccess(config),
    sync:
      config.type === ProviderType.MUSIC &&
      managesAllSources() &&
      authManager.hasScope(Scope.LIBRARY_MANAGE) &&
      !!provider?.available,
    players: config.type === ProviderType.PLAYER && !!provider,
  };
};

/**
 * The translation key of the access action: an admin sets the owner and the
 * sharing, a member only shares its own source.
 */
export const getProviderAccessLabel = () =>
  managesAllSources()
    ? "settings.source_access.action"
    : "settings.source_access.share_action";

/**
 * Menu entries acting on a provider instance the viewer manages: its settings
 * sections, (re)configuring, enabling, reloading and removing it.
 */
export const getProviderSettingsMenuItems = (
  config: ProviderConfig,
  options: ProviderSettingsMenuOptions,
): ContextMenuItem[] => {
  const instanceId = config.instance_id;
  const manifest = api.providerManifests[config.domain];
  const provider = api.getProvider(instanceId);
  const sections = getProviderSettingsSections(config);
  const menuItems: ContextMenuItem[] = [];

  if (options.includeSections) {
    if (canReconfigureSource(config)) {
      menuItems.push({
        label: "settings.reconfigure",
        action: () => options.onReconfigure?.(config),
        icon: markRaw(Wrench),
      });
    }
    menuItems.push(
      {
        label: "settings.options",
        action: () => router.push(`/settings/editprovider/${instanceId}`),
        icon: markRaw(Settings),
      },
      {
        label: getProviderAccessLabel(),
        action: () => options.onAccess?.(config),
        icon: markRaw(KeyRound),
        hide: !sections.access,
      },
    );
  }

  menuItems.push({
    label: config.enabled ? "settings.disable" : "settings.enable",
    action: () => options.onToggleEnabled(config),
    icon: markRaw(config.enabled ? CircleOff : Power),
    // a provider that may not be disabled can still be enabled again
    disabled: config.enabled && !manifest?.allow_disable,
    hide: !canToggleSource(config),
  });

  if (options.includeSections) {
    menuItems.push(
      {
        label: "settings.documentation",
        action: () => openLinkInNewTab(manifest?.documentation || ""),
        icon: markRaw(BookOpen),
        disabled: !manifest?.documentation,
      },
      {
        label: "settings.sync",
        action: () => api.startSync(undefined, [instanceId]),
        icon: markRaw(RefreshCw),
        hide: !sections.sync,
      },
    );
  }

  menuItems.push({
    label: "settings.reload",
    action: () => options.onReload(instanceId),
    icon: markRaw(RotateCw),
  });

  if (options.includeSections && sections.players) {
    menuItems.push({
      label: "settings.view_players",
      action: () =>
        router.push({
          name: "playersettings",
          query: { providers: instanceId },
        }),
      icon: markRaw(Speaker),
    });
  }
  if (
    provider?.available &&
    provider.supported_features.includes(ProviderFeature.CREATE_GROUP_PLAYER) &&
    authManager.hasScope(Scope.CONFIG_PLAYERS_WRITE)
  ) {
    menuItems.push({
      label: "settings.add_group_player",
      action: () => router.push(`/settings/addgroup/${instanceId}`),
      icon: markRaw(Copy),
    });
  }
  menuItems.push({
    label: "settings.remove_provider",
    action: () => options.onRemove(config),
    icon: markRaw(Trash2),
    color: "error",
    hide: manifest?.builtin !== false,
  });

  return menuItems;
};
