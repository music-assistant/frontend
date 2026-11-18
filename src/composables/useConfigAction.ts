/**
 * Shared handler for the action buttons on a settings config form.
 * Provider, player and core config forms all invoke an action the same way and
 * differ only in which API commands they talk to, so they pass those in.
 */

import type { Ref } from "vue";
import { toast } from "vue-sonner";
import { isRefusedActionUrl, showActionResult } from "@/helpers/action_result";
import { mergeActionEntries } from "@/helpers/config_entry_ui";
import { openActionUrlEntries } from "@/helpers/utils";
import {
  type Config,
  type ConfigActionResult,
  type ConfigEntry,
  ConfigEntryType,
  type ConfigValueType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

interface UseConfigActionOptions<T extends Config> {
  /** The form's config, refreshed in place with whatever the action returns. */
  config: Ref<T | undefined>;
  /** Toggled around the invoke so the form can show its loading overlay. */
  loading: Ref<boolean>;
  /** Runs the action on the server and returns the entries to re-render, or its result. */
  invokeAction: (action: string) => Promise<ConfigEntry[] | ConfigActionResult>;
  /** Persists the given raw values and returns the stored config. */
  saveValues: (values: Record<string, ConfigValueType>) => Promise<Config>;
  /** Domain or instance id of the provider that answers the given action, if a provider does. */
  answeredBy?: (action: string) => string | undefined;
}

/**
 * Build the `action` event handler for an EditConfig form.
 *
 * @param config - Ref holding the config the form renders.
 * @param loading - Ref driving the form's loading overlay.
 * @param invokeAction - Invokes the action for this config's flavour.
 * @param saveValues - Saves raw values for this config's flavour.
 * @param answeredBy - Names the provider that answers an action.
 */
export function useConfigAction<T extends Config>({
  config,
  loading,
  invokeAction,
  saveValues,
  answeredBy,
}: UseConfigActionOptions<T>) {
  const onAction = async function (
    action: string,
    _values: Record<string, ConfigValueType>,
    immediateApply: boolean,
  ) {
    loading.value = true;
    try {
      const response = await invokeAction(action);
      const provider = answeredBy?.(action);
      if (!Array.isArray(response)) {
        // A result only reports the outcome of the action: it never carries
        // values, so the form is left untouched.
        showActionResult(response, provider);
        return;
      }
      const allowed = response.filter(
        (entry) => !isRefusedUrlEntry(entry, provider),
      );
      const refused = allowed.length < response.length;
      if (refused) {
        toast.warning($t("settings.action_completed"), {
          description: $t("settings.action_link_refused"),
        });
      }
      const entries = openActionUrlEntries(allowed);
      // An empty response means the action was a one-off side effect with
      // nothing to re-render: leave the form untouched.
      if (entries.length === 0) {
        if (!refused) toast.success($t("settings.action_completed"));
        return;
      }
      config.value!.values = mergeActionEntries(config.value!.values, entries);
      if (immediateApply) {
        const rawValues: Record<string, ConfigValueType> = {};
        for (const entry of Object.values(config.value!.values)) {
          if (entry.value !== undefined) {
            rawValues[entry.key] = entry.value;
          }
        }
        const updatedConfig = await saveValues(rawValues);
        for (const [key, entry] of Object.entries(updatedConfig.values)) {
          config.value!.values[key] = entry;
        }
      }
    } catch {
      // the api reports the failure itself
    } finally {
      loading.value = false;
    }
  };

  return { onAction };
}

// a url entry opens once like an action's url, so it follows the same rule
const isRefusedUrlEntry = (entry: ConfigEntry, provider?: string): boolean => {
  const target = entry.value ?? entry.default_value;
  return (
    entry.type === ConfigEntryType.URL &&
    typeof target === "string" &&
    isRefusedActionUrl(target, provider)
  );
};
