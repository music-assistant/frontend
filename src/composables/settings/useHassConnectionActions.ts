import { useSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { providerDisplayName } from "@/helpers/provider_config";
import {
  canReconfigureSource,
  canToggleSource,
} from "@/helpers/provider_permissions";
import { confirmProviderRemoval } from "@/helpers/provider_removal";
import { getProviderSettingsMenuItems } from "@/helpers/provider_settings_actions";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { ProviderConfig } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { BookOpen } from "@lucide/vue";
import { computed, markRaw, onBeforeUnmount, ref, type Ref, watch } from "vue";
import { toast } from "vue-sonner";

export type HassConnectionAction = "reconfigure" | "enable";

/**
 * What can be done with the connection with Home Assistant: the action its row
 * offers, and the menu of the settings page holding the rest, from disabling
 * and reloading it to its documentation and removing it. The provider's
 * changes reach the page through the provider events.
 *
 * @param config - The config of the Home Assistant provider, while it is set up.
 */
export function useHassConnectionActions(
  config: Ref<ProviderConfig | undefined>,
) {
  const busy = ref(false);

  // the add-on makes the connection itself, so there is nothing to reconfigure
  const action = computed<HassConnectionAction | undefined>(() => {
    const current = config.value;
    if (!current) return undefined;
    if (!current.enabled) {
      return canToggleSource(current) ? "enable" : undefined;
    }
    if (api.serverInfo.value?.homeassistant_addon) return undefined;
    return canReconfigureSource(current) ? "reconfigure" : undefined;
  });

  /**
   * Run the action the row of the connection offers.
   */
  const runAction = function () {
    const current = config.value;
    if (!current) return;
    if (action.value === "enable") void setEnabled(current, true);
    else if (action.value === "reconfigure") reconfigure(current);
  };

  const reconfigure = function (current: ProviderConfig) {
    eventbus.emit("setupFlowDialog", {
      kind: "reconfigure",
      instanceId: current.instance_id,
      name: nameOf(current),
    });
  };

  const setEnabled = async function (
    current: ProviderConfig,
    enabled: boolean,
  ) {
    busy.value = true;
    try {
      await api.saveProviderConfig(
        current.domain,
        { enabled },
        current.instance_id,
      );
      toast.success($t("settings.provider_saved"));
    } catch {
      // the api reports the failure itself
    } finally {
      busy.value = false;
    }
  };

  const reload = function (instanceId: string) {
    api
      .reloadProvider(instanceId)
      .then(() => toast.success($t("settings.provider_reloading")))
      // the api reports a failing reload itself
      .catch(() => {});
  };

  const remove = function (current: ProviderConfig) {
    const name = nameOf(current);
    confirmProviderRemoval(current, name, async () => {
      try {
        await api.removeProviderConfig(current.instance_id);
        toast.success($t("settings.provider_removed", [name]));
      } catch (err) {
        toast.error(String(err));
      }
    });
  };

  const menuItems = function (current: ProviderConfig): ContextMenuItem[] {
    const items = getProviderSettingsMenuItems(current, {
      onToggleEnabled: (toggled) => void setEnabled(toggled, !toggled.enabled),
      onReload: reload,
      onRemove: remove,
    });
    const documentation =
      api.providerManifests[current.domain]?.documentation ?? "";
    // the documentation goes before removing, which ends the menu
    const removeAt = items.findIndex(
      (item) => item.label === "settings.remove_provider",
    );
    items.splice(removeAt < 0 ? items.length : removeAt, 0, {
      label: "settings.documentation",
      action: () => openLinkInNewTab(documentation),
      icon: markRaw(BookOpen),
      hide: !documentation,
    });
    return items;
  };

  const pageMenu = useSettingsPageMenu();
  watch(
    config,
    (current) => {
      pageMenu.value = current ? menuItems(current) : [];
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    pageMenu.value = [];
  });

  return { action, busy, runAction };
}

function nameOf(config: ProviderConfig): string {
  return providerDisplayName(
    config,
    api.getProvider(config.instance_id),
    api.providerManifests[config.domain],
  );
}
