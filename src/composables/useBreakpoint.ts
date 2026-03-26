import { computed, toRef } from "vue";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { state } from "@/plugins/breakpoint";

/**
 * Composable wrapping the existing breakpoint plugin.
 * Uses the single global resize listener instead of @vueuse/core.
 */
export function useBreakpoint() {
  const width = toRef(state, "width");
  const height = toRef(state, "height");
  const smAndUp = computed(() => width.value >= 340);
  const mdAndUp = computed(() => width.value >= 540);
  const lgAndUp = computed(() => width.value >= 800);
  const xlAndUp = computed(() => width.value >= 1280);
  const mobile = computed(() => !mdAndUp.value);

  return { width, height, smAndUp, mdAndUp, lgAndUp, xlAndUp, mobile };
}
