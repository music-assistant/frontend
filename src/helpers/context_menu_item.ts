import { $t } from "@/plugins/i18n";
import type { Component } from "vue";

// Menu item for the app-wide context menu (ItemContextMenu / eventbus
// "contextmenu" event). Lives in a plain .ts module (rather than being
// exported from the ItemContextMenu.vue SFC) so editors resolve it natively
// without going through the Vue language plugin's virtual files.
export interface ContextMenuItem {
  // a translation key; with text it only names the entry, which keeps it unique
  label: string;
  // shown as it is in place of the label, for text that arrives ready to show
  text?: string;
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
  // Submenu popout rendered as this component instead of a subItems list.
  subComponent?: Component;
  // Props passed through to `component` or `subComponent`.
  componentProps?: Record<string, unknown>;
}

/** The label to show for a menu item: its text, or its label translated with its arguments. */
export const menuItemLabel = (
  item: Pick<ContextMenuItem, "label" | "labelArgs" | "text">,
): string => {
  if (item.text !== undefined) return item.text;
  return Array.isArray(item.labelArgs)
    ? $t(item.label, item.labelArgs)
    : $t(item.label, item.labelArgs ?? {});
};
