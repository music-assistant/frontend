import { computed, ref, type ComputedRef, type Ref } from "vue";

export function useTablePagination<T>(
  items: ComputedRef<T[]> | Ref<T[]>,
  rowsPerPageNum: ComputedRef<number> | Ref<number>,
) {
  const page = ref(1);

  const totalCount = computed(() => items.value.length);
  const totalPages = computed(() =>
    Math.max(1, Math.ceil(totalCount.value / rowsPerPageNum.value)),
  );
  const firstRow = computed(() =>
    totalCount.value === 0 ? 0 : (page.value - 1) * rowsPerPageNum.value + 1,
  );
  const lastRow = computed(() =>
    Math.min(page.value * rowsPerPageNum.value, totalCount.value),
  );
  const hasNextPage = computed(
    () => page.value * rowsPerPageNum.value < totalCount.value,
  );
  const pagedItems = computed(() => {
    const start = (page.value - 1) * rowsPerPageNum.value;
    return items.value.slice(start, start + rowsPerPageNum.value);
  });

  return {
    page,
    totalCount,
    totalPages,
    firstRow,
    lastRow,
    hasNextPage,
    pagedItems,
  };
}
