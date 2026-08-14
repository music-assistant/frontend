import { $t } from "@/plugins/i18n";
import type { Component } from "vue";

// Menu item for the app-wide context menu (ItemContextMenu / eventbus
// "contextmenu" event). Lives in a plain .ts module (rather than being
// exported from the ItemContextMenu.vue SFC) so editors resolve it natively
// without going through the Vue language plugin's virtual files.
export interface ContextMenuItem {
  label: string;
  // positional for a `{0}` message, named for a `{name}` one
  labelArgs?: Array<string | number> | Record<string, string | number>;
  action?: () => void;
  icon?: string | Component;
  disabled?: boolean;
  hide?: boolean;
  selected?: boolean;
  subItems?: ContextMenuItem[];
  close_on_click?: boolean;
  color?: string;
  // Renders a custom control in place of the standard row (label/icon/action
  // are ignored except for the list key). Used for inline controls like the
  // lyrics-offset stepper.
  component?: Component;
}

/** The label to show for a menu item, with its arguments filled in. */
export const menuItemLabel = (
  item: Pick<ContextMenuItem, "label" | "labelArgs">,
): string =>
  Array.isArray(item.labelArgs)
    ? $t(item.label, item.labelArgs)
    : $t(item.label, item.labelArgs ?? {});
