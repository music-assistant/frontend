import { useMediaQuery } from "@vueuse/core";
import { computed } from "vue";

export function useBreakpoint() {
  const smAndUp = useMediaQuery("(min-width: 340px)");
  const mdAndUp = useMediaQuery("(min-width: 540px)");
  const lgAndUp = useMediaQuery("(min-width: 800px)");
  const xlAndUp = useMediaQuery("(min-width: 1280px)");
  const mobile = computed(() => !mdAndUp.value);

  return { smAndUp, mdAndUp, lgAndUp, xlAndUp, mobile };
}
