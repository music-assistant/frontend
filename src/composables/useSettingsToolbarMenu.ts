import type { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

const settingsToolbarMenuKey: InjectionKey<Ref<ToolBarMenuItem[]>> = Symbol(
  "settings-toolbar-menu",
);

/**
 * Opens the channel that carries the items of the settings toolbar's overflow
 * menu, and hands it back to read. Empty until the open page publishes items.
 */
export function provideSettingsToolbarMenu(): Ref<ToolBarMenuItem[]> {
  const items = ref<ToolBarMenuItem[]>([]);
  provide(settingsToolbarMenuKey, items);
  return items;
}

/**
 * The channel a settings page publishes the items of the toolbar's overflow
 * menu into; the page empties it again when it closes. A page mounted outside
 * the settings layout writes into a ref of its own that nobody reads.
 */
export function useSettingsToolbarMenu(): Ref<ToolBarMenuItem[]> {
  return inject(settingsToolbarMenuKey, ref([]));
}
