import {
  inject,
  onBeforeUnmount,
  provide,
  shallowRef,
  type InjectionKey,
  type ShallowRef,
} from "vue";

/** Handles back on the page itself; returns whether it did. */
export type SettingsPageBack = () => boolean;

const settingsPageBackKey: InjectionKey<
  ShallowRef<SettingsPageBack | undefined>
> = Symbol("settings-page-back");

/**
 * Opens the channel through which the settings page on screen may handle back
 * itself, and hands it back. Empty while the page leaves back to the layout.
 */
export function provideSettingsPageBack(): ShallowRef<
  SettingsPageBack | undefined
> {
  const handler = shallowRef<SettingsPageBack>();
  provide(settingsPageBackKey, handler);
  return handler;
}

/**
 * Lets the calling settings page handle back itself while it is mounted, such
 * as closing a panel before the page is left. `handle` returns whether it did;
 * when it did not, back leaves the page as usual. A page mounted outside the
 * settings layout registers with nobody.
 */
export function useSettingsPageBack(handle: SettingsPageBack): void {
  const handler = inject(settingsPageBackKey, undefined);
  if (!handler) return;
  handler.value = handle;
  onBeforeUnmount(() => {
    if (handler.value === handle) handler.value = undefined;
  });
}
