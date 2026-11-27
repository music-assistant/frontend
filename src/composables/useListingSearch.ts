import type { LoadDataParams } from "@/composables/useItemsListing";
import { useDebounceFn } from "@vueuse/core";
import { computed, onScopeDispose, ref, type Ref } from "vue";

export const SEARCH_DELAY_MS = 300;

/**
 * The text in a listing's search box. Typing becomes the listing's search once
 * it pauses; emptying the box does so right away.
 */
export function useListingSearch(params: Ref<LoadDataParams>) {
  // what is typed but not searched yet: the search itself only changes along
  // with a load, so it always belongs to the rows on show or on their way
  const typedText = ref<string>();

  const applyTyped = () => {
    if (typedText.value === undefined) return;
    params.value.search = typedText.value;
    typedText.value = undefined;
  };
  const applyTypedSoon = useDebounceFn(applyTyped, SEARCH_DELAY_MS);

  const searchText = computed({
    get: () => typedText.value ?? params.value.search,
    set: (text: string) => {
      typedText.value = text;
      if (text) void applyTypedSoon();
      else applyTyped();
    },
  });

  /** Drop what is typed but not searched yet. */
  const discardTyped = () => {
    typedText.value = undefined;
  };

  // the params of a listing that was left belong to its cached visit
  onScopeDispose(discardTyped);

  return { searchText, discardTyped };
}
