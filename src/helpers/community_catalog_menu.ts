// The options of the community catalog in the top right menu of the Catalog page.
import type { CommunityCatalogStatus } from "@/composables/settings/catalog/useCommunityCatalog";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { CircleAlert, Download, Power, PowerOff, RefreshCw } from "@lucide/vue";
import { markRaw } from "vue";

/** What the menu needs of the community catalog. */
export interface CommunityCatalogMenuState {
  status: CommunityCatalogStatus;
  enabled: boolean;
  saving: boolean;
  autoUpdate: boolean;
  savingAutoUpdate: boolean;
  refreshing: boolean;
  setEnabled: (value: boolean) => void;
  setAutoUpdate: (value: boolean) => void;
  refresh: () => void;
  retry: () => void;
}

/**
 * The menu entries for the community catalog: switching it on or off and, while
 * it is on, checking for changes and automatic updates. While it is not
 * available, they say so with a way to try again.
 *
 * @param catalog - The community catalog of an admin.
 */
export const getCommunityCatalogMenuItems = (
  catalog: CommunityCatalogMenuState,
): ContextMenuItem[] => {
  if (catalog.status === "unavailable") {
    return [
      {
        label: "settings.catalog.community.unavailable",
        icon: markRaw(CircleAlert),
        disabled: true,
      },
      {
        label: "settings.retry",
        icon: markRaw(RefreshCw),
        action: catalog.retry,
      },
    ];
  }
  const { enabled, autoUpdate } = catalog;
  const items: ContextMenuItem[] = enabled
    ? [
        {
          label: "settings.catalog.community.refresh",
          icon: markRaw(RefreshCw),
          disabled: catalog.refreshing,
          action: catalog.refresh,
        },
        {
          label: "settings.catalog.community.auto_update",
          icon: markRaw(Download),
          selected: autoUpdate,
          disabled: catalog.savingAutoUpdate,
          action: () => catalog.setAutoUpdate(!autoUpdate),
        },
      ]
    : [];
  items.push({
    label: enabled
      ? "settings.catalog.community.disable"
      : "settings.catalog.community.enable",
    icon: markRaw(enabled ? PowerOff : Power),
    disabled: catalog.saving,
    action: () => catalog.setEnabled(!enabled),
  });
  return items;
};
