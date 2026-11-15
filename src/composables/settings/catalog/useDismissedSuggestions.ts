import {
  updateUserPreferences,
  useUserPreferences,
} from "@/composables/userPreferences";
import {
  DISMISSED_SUGGESTIONS_PREFERENCE,
  readDismissedSuggestions,
} from "@/helpers/catalog_recommendations";
import { computed } from "vue";

/**
 * The domains the user asked the Marketplace not to suggest, kept on the user's
 * profile so they stay away on every device.
 */
export function useDismissedSuggestions() {
  const stored = useUserPreferences().getPreference<unknown>(
    DISMISSED_SUGGESTIONS_PREFERENCE,
    [],
  );
  const dismissed = computed(() => readDismissedSuggestions(stored.value));

  /**
   * Stop suggesting a provider to the user.
   *
   * @param domain - The domain of the provider.
   */
  const dismiss = (domain: string) => {
    // the api reports a failed save itself, and the suggestion then comes back
    void updateUserPreferences((current) => {
      const domains = readDismissedSuggestions(
        current[DISMISSED_SUGGESTIONS_PREFERENCE],
      );
      return domains.includes(domain)
        ? null
        : {
            ...current,
            [DISMISSED_SUGGESTIONS_PREFERENCE]: [...domains, domain],
          };
    });
  };

  return { dismissed, dismiss };
}
