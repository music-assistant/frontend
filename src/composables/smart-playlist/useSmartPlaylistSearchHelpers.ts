import { computed, ref, watch } from "vue";
import type { Ref } from "vue";

interface SubmitSearchOptions<T> {
  query: Ref<string>;
  results: Ref<T[]>;
  isSearching: Ref<boolean>;
  searchFn: (query: string) => Promise<T[]>;
  minLength?: number;
}

/**
 * Search only when `submit` is called, never while the query is typed.
 * Editing the query after a submit clears the results and ignores the response
 * of a search still running.
 * `isSubmitted` tells whether the results belong to the current query.
 */
export function setupSubmitSearch<T>({
  query,
  results,
  isSearching,
  searchFn,
  minLength = 2,
}: SubmitSearchOptions<T>) {
  // the trimmed term the shown results or the running search belong to
  const submittedQuery = ref("");
  // a response only lands while its request is still the latest one
  let latest = 0;

  async function submit() {
    const q = query.value.trim();
    if (q.length < minLength) return;
    const request = ++latest;
    submittedQuery.value = q;
    results.value = [];
    isSearching.value = true;
    try {
      const resolved = await searchFn(q);
      if (request === latest) results.value = resolved;
    } catch (err) {
      // a failed search can be submitted again
      if (request === latest) submittedQuery.value = "";
      throw err;
    } finally {
      if (request === latest) isSearching.value = false;
    }
  }

  watch(query, (q) => {
    if (q.trim() === submittedQuery.value) return;
    latest++;
    submittedQuery.value = "";
    results.value = [];
    isSearching.value = false;
  });

  const isSubmitted = computed(() => submittedQuery.value !== "");

  return { submit, isSubmitted };
}
