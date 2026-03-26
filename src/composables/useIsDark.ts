import { useDark } from "@vueuse/core";

export function useIsDark() {
  const isDark = useDark();
  return { isDark };
}
