import { computed, ref } from "vue";

/**
 * State for a pair of YearRangeFilter boxes: the raw strings to bind to it,
 * plus a predicate that tests a year against whatever the boxes hold.
 */
export function useYearRange() {
  const from = ref("");
  const to = ref("");

  // Bounds are read low-to-high whichever box they were typed into, which keeps
  // results sensible while a year is still half typed.
  const bounds = computed(() => {
    const low = from.value ? Number(from.value) : undefined;
    const high = to.value ? Number(to.value) : undefined;
    if (low !== undefined && high !== undefined)
      return { low: Math.min(low, high), high: Math.max(low, high) };
    return { low, high };
  });

  const isActive = computed(
    () => bounds.value.low !== undefined || bounds.value.high !== undefined,
  );

  const matches = (year?: number | null): boolean => {
    const { low, high } = bounds.value;
    if (!isActive.value) return true;
    // A year that isn't on file can't be placed in the range, so it drops out
    // as soon as either bound is set.
    if (typeof year !== "number") return false;
    return (
      (low === undefined || year >= low) && (high === undefined || year <= high)
    );
  };

  const clear = () => {
    from.value = "";
    to.value = "";
  };

  return { from, to, isActive, matches, clear };
}

/**
 * Earliest and latest year in a list, for the filter's placeholder text.
 * Both are absent when no year is on file.
 */
export function yearBounds(years: Array<number | null | undefined>): {
  earliest?: number;
  latest?: number;
} {
  const known = years.filter((y): y is number => typeof y === "number");
  if (!known.length) return {};
  return { earliest: Math.min(...known), latest: Math.max(...known) };
}
