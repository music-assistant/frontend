import type { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

const settingsPageMenuKey: InjectionKey<Ref<ToolBarMenuItem[]>> =
  Symbol("settings-page-menu");

/**
 * Opens the channel that carries the items of the menu in the header of the
 * settings page on screen, and hands it back. Empty until the page publishes
 * items.
 */
export function provideSettingsPageMenu(): Ref<ToolBarMenuItem[]> {
  const items = ref<ToolBarMenuItem[]>([]);
  provide(settingsPageMenuKey, items);
  return items;
}

/**
 * The channel a settings page publishes the items of its menu into, which its
 * header shows; the page empties it again when it closes. A page mounted
 * outside the settings layout writes into a ref of its own that nobody reads.
 */
export function useSettingsPageMenu(): Ref<ToolBarMenuItem[]> {
  return inject(settingsPageMenuKey, ref([]));
}
