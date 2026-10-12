import { inject, provide, ref, type InjectionKey, type Ref } from "vue";

const editedProviderNameKey: InjectionKey<Ref<string>> = Symbol(
  "edited-provider-name",
);

/**
 * Opens the channel that carries the name of the provider whose settings page
 * is open, and hands it back to read. Empty until that page publishes a name.
 */
export function provideEditedProviderName(): Ref<string> {
  const name = ref("");
  provide(editedProviderNameKey, name);
  return name;
}

/**
 * The channel a provider settings page publishes the name it shows into, so the
 * layout around it can name that provider the same way. A page mounted outside
 * that layout writes into a ref of its own that nobody reads.
 */
export function useEditedProviderName(): Ref<string> {
  return inject(editedProviderNameKey, ref(""));
}
