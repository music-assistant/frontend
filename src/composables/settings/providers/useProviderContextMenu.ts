import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderFeature,
  ProviderType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { type MaybeRefOrGetter, toValue } from "vue";
import { useRouter } from "vue-router";

interface UseProviderContextMenuOptions {
  managesAllSources: MaybeRefOrGetter<boolean>;
  canConfigureAccess: (item: ProviderConfig) => boolean;
  canReconfigure: (item: ProviderConfig) => boolean;
  onOptions: (instanceId: string) => void;
  onAccess: (item: ProviderConfig) => void;
  onToggleEnabled: (item: ProviderConfig) => void;
  onRemove: (item: ProviderConfig) => void;
  onReload: (instanceId: string) => void;
  onReconfigure: (instanceId: string) => void;
}

/**
 * Builds the per-source context menu and opens it at the pointer, gating each
 * action on what the viewer may do with the source.
 */
export function useProviderContextMenu(options: UseProviderContextMenuOptions) {
  const router = useRouter();

  const openMenu = function (evt: Event, item: ProviderConfig) {
    const providerManifest = api.providerManifests[item.domain];
    // Guard against race condition where providerManifests aren't loaded yet
    if (!providerManifest) {
      console.warn("Provider manifest not yet loaded for:", item.domain);
      return;
    }
    const managesAll = toValue(options.managesAllSources);
    const providerInstance = api.getProvider(item.instance_id);
    const menuItems: ContextMenuItem[] = [
      {
        label: "settings.options",
        labelArgs: [],
        action: () => {
          options.onOptions(item.instance_id);
        },
        icon: "mdi-cog",
      },
      {
        // an admin sets owner and sharing, a member only shares its own source
        label: managesAll
          ? "settings.source_access.action"
          : "settings.source_access.share_action",
        labelArgs: [],
        action: () => {
          options.onAccess(item);
        },
        icon: "mdi-account-key",
        hide: !options.canConfigureAccess(item),
      },
      {
        label: item.enabled ? "settings.disable" : "settings.enable",
        labelArgs: [],
        action: () => {
          options.onToggleEnabled(item);
        },
        icon: "mdi-cancel",
        disabled: !providerManifest.allow_disable,
        hide: !managesAll,
      },
      {
        label: "settings.documentation",
        labelArgs: [],
        action: () => {
          openLinkInNewTab(providerManifest.documentation!);
        },
        icon: "mdi-bookshelf",
        disabled: !providerManifest.documentation,
      },
      {
        label: "settings.sync",
        labelArgs: [],
        action: () => {
          api.startSync(undefined, [item.instance_id]);
        },
        icon: "mdi-sync",
        hide:
          !managesAll ||
          !providerInstance?.available ||
          item.type != ProviderType.MUSIC,
      },
      {
        label: "settings.remove_provider",
        labelArgs: [],
        action: () => {
          options.onRemove(item);
        },
        icon: "mdi-delete",
        hide: providerManifest.builtin,
      },
      {
        label: "settings.reload",
        labelArgs: [],
        action: () => {
          options.onReload(item.instance_id);
        },
        icon: "mdi-refresh",
      },
    ];

    if (options.canReconfigure(item)) {
      menuItems.unshift({
        label: "settings.reconfigure",
        labelArgs: [],
        action: () => {
          options.onReconfigure(item.instance_id);
        },
        icon: "mdi-cog-refresh",
      });
    }

    if (item.type === ProviderType.PLAYER && providerInstance) {
      menuItems.push({
        label: "settings.view_players",
        labelArgs: [],
        action: () => {
          router.push({
            name: "playersettings",
            query: { providers: providerInstance.instance_id },
          });
        },
        icon: "mdi-speaker",
      });
    }
    if (
      providerInstance?.available &&
      providerInstance.supported_features.includes(
        ProviderFeature.CREATE_GROUP_PLAYER,
      )
    ) {
      menuItems.push({
        label: "settings.add_group_player",
        labelArgs: [],
        action: () => {
          router.push(`/settings/addgroup/${providerInstance.instance_id}`);
        },
        icon: "mdi-speaker-multiple",
      });
    }
    eventbus.emit("contextmenu", {
      items: menuItems,
      posX: (evt as PointerEvent).clientX,
      posY: (evt as PointerEvent).clientY,
    });
  };

  return { openMenu };
}
