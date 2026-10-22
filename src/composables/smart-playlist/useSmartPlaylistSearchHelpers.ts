import { watch } from "vue";
import type { Ref } from "vue";
import { useDebounceFn } from "@vueuse/core";

interface DebouncedSearchOptions<T> {
  query: Ref<string>;
  results: Ref<T[]>;
  isSearching: Ref<boolean>;
  searchFn: (query: string) => Promise<T[]>;
  minLength?: number;
  debounceMs?: number;
}

export function setupDebouncedSearch<T>({
  query,
  results,
  isSearching,
  searchFn,
  minLength = 2,
  debounceMs = 400,
}: DebouncedSearchOptions<T>) {
  const runSearch = useDebounceFn(async (q: string) => {
    if (q.length < minLength) {
      results.value = [];
      isSearching.value = false;
      return;
    }

    try {
      const resolved = await searchFn(q);
      if (query.value === q) {
        results.value = resolved;
      }
    } finally {
      if (query.value === q) {
        isSearching.value = false;
      }
    }
  }, debounceMs);

  watch(query, (q) => {
    if (q.length < minLength) {
      results.value = [];
      isSearching.value = false;
      return;
    }

    isSearching.value = true;
    runSearch(q);
  });
}
