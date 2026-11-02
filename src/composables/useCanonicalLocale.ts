import { canonicalizeLocale, i18n } from "@/plugins/i18n";
import { computed } from "vue";

/** The active UI locale as a BCP 47 tag, for `Intl` formatters. */
export function useCanonicalLocale() {
  return computed(() => canonicalizeLocale(i18n.global.locale.value));
}
