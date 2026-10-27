import { ref } from "vue";

/**
 * A library page's item count. Every new count supersedes the ones before it,
 * so one still on its way when the filters changed is dropped rather than
 * shown beside the new results.
 */
export function useListingTotal(initial?: number) {
  const total = ref<number | undefined>(initial);
  let latest = 0;

  function setTotal(value: number | undefined) {
    latest++;
    total.value = value;
  }

  async function loadTotal(request: Promise<number>) {
    const current = ++latest;
    // the old count belongs to the old filters: nothing beats a wrong number
    total.value = undefined;
    const value = await request;
    if (current === latest) total.value = value;
  }

  return { total, setTotal, loadTotal };
}
