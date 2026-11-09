import type { LoadDataParams } from "@/composables/useItemsListing";
import {
  SortDirection,
  SortField,
  type LetterIndexEntry,
} from "@/plugins/api/interfaces";
import { computed, ref, watch, type Ref } from "vue";

export type LoadLetterIndexFn = (
  params: LoadDataParams,
) => Promise<LetterIndexEntry[]>;

export interface IndexLetter {
  label: string;
  // whether any item starts with this letter
  available: boolean;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
// numbers and symbols
const OTHER = "#";
const NAME_SORTS: (SortField | undefined)[] = [
  SortField.NAME,
  SortField.SORT_NAME,
];

/**
 * The letters of a listing sorted by name, each with the row its first item
 * is on. It follows the sort and filters the listing loaded, and holds no
 * letters for any other sort, while searching, or while it loads.
 */
export function useLetterIndex(
  loader: () => LoadLetterIndexFn | undefined,
  params: Ref<LoadDataParams>,
) {
  const entries = ref<LetterIndexEntry[]>([]);
  let latest = 0;

  // the paging and the sort picked but not loaded yet leave the index as it is
  const indexKey = computed(() =>
    JSON.stringify({
      ...params.value,
      offset: undefined,
      limit: undefined,
      refresh: undefined,
      randomSeed: undefined,
      sortBy: undefined,
    }),
  );

  /** Fetch the index again, dropping any request still on its way. */
  async function load() {
    const current = ++latest;
    entries.value = [];
    const loadIndex = loader();
    const p = params.value;
    if (!loadIndex || p.search || !NAME_SORTS.includes(p.sortField)) return;
    try {
      const result = await loadIndex({ ...p });
      if (current === latest) entries.value = result;
    } catch {
      // the api already reports the failure to the user
    }
  }

  watch(indexKey, load, { immediate: true });

  /** The full alphabet in listing order; "#" sorts before the letters. */
  const letters = computed<IndexLetter[]>(() => {
    const available = new Set(entries.value.map((entry) => entry.letter));
    const descending = params.value.sortDirection === SortDirection.DESC;
    const labels = descending ? [...ALPHABET].reverse() : [...ALPHABET];
    if (available.has(OTHER)) {
      if (descending) labels.push(OTHER);
      else labels.unshift(OTHER);
    }
    return labels.map((label) => ({ label, available: available.has(label) }));
  });

  /**
   * The row to jump to for a letter. A letter without items goes to the next
   * one that has items, or the one before it when none follows.
   */
  function rowFor(label: string): number | undefined {
    const list = letters.value;
    const at = list.findIndex((letter) => letter.label === label);
    if (at < 0) return undefined;
    const target =
      list.slice(at).find((letter) => letter.available) ??
      list
        .slice(0, at)
        .reverse()
        .find((letter) => letter.available);
    return entries.value.find((entry) => entry.letter === target?.label)
      ?.offset;
  }

  return { entries, letters, load, rowFor };
}
