import {
  updateUserPreferences,
  useUserPreferences,
} from "@/composables/userPreferences";
import {
  DISMISSED_SUGGESTIONS_PREFERENCE,
  readDismissedSuggestions,
} from "@/helpers/catalog_recommendations";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import { toast } from "vue-sonner";

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
   * Stop suggesting a provider to the user, with a way to undo it.
   *
   * @param domain - The domain of the provider.
   * @param name - Its name, as the user knows it.
   */
  const dismiss = async (domain: string, name: string) => {
    const saved = await saveDomains((domains) =>
      domains.includes(domain) ? null : [...domains, domain],
    );
    if (!saved) {
      toast.error($t("settings.catalog.dont_suggest_failed", { name }));
      return;
    }
    toast.success($t("settings.catalog.not_suggested_toast", { name }), {
      action: {
        label: $t("settings.catalog.undo"),
        onClick: () => void undo(domain, name),
      },
    });
  };

  const undo = async (domain: string, name: string) => {
    const saved = await saveDomains((domains) =>
      domains.includes(domain)
        ? domains.filter((item) => item !== domain)
        : null,
    );
    if (saved) {
      toast.success($t("settings.catalog.suggested_again_toast", { name }));
    } else {
      toast.error($t("settings.catalog.suggest_again_failed", { name }));
    }
  };

  return { dismissed, dismiss };
}

// writes the list as it stands when its turn comes; the toasts here are the
// only message, so the api keeps its own away
async function saveDomains(
  change: (domains: string[]) => string[] | null,
): Promise<boolean> {
  return await updateUserPreferences(
    (current) => {
      const domains = change(
        readDismissedSuggestions(current[DISMISSED_SUGGESTIONS_PREFERENCE]),
      );
      return domains
        ? { ...current, [DISMISSED_SUGGESTIONS_PREFERENCE]: domains }
        : null;
    },
    { suppressGlobalError: true },
  );
}
