/**
 * Shared handler for the action buttons on a settings config form.
 * Provider, player and core config forms all invoke an action the same way and
 * differ only in which API commands they talk to, so they pass those in.
 */

import type { Ref } from "vue";
import { toast } from "vue-sonner";
import { mergeActionEntries } from "@/helpers/config_entry_ui";
import { openActionResultUrl, openActionUrlEntries } from "@/helpers/utils";
import type {
  Config,
  ConfigActionResult,
  ConfigEntry,
  ConfigValueType,
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
}

/**
 * Build the `action` event handler for an EditConfig form.
 *
 * @param config - Ref holding the config the form renders.
 * @param loading - Ref driving the form's loading overlay.
 * @param invokeAction - Invokes the action for this config's flavour.
 * @param saveValues - Saves raw values for this config's flavour.
 */
export function useConfigAction<T extends Config>({
  config,
  loading,
  invokeAction,
  saveValues,
}: UseConfigActionOptions<T>) {
  const onAction = async function (
    action: string,
    _values: Record<string, ConfigValueType>,
    immediateApply: boolean,
  ) {
    loading.value = true;
    try {
      const response = await invokeAction(action);
      if (!Array.isArray(response)) {
        // A result only reports the outcome of the action: it never carries
        // values, so the form is left untouched.
        openActionResultUrl(response.open_url);
        toast.success(response.message || $t("settings.action_completed"));
        return;
      }
      const entries = openActionUrlEntries(response);
      // An empty response means the action was a one-off side effect with
      // nothing to re-render: leave the form untouched.
      if (entries.length === 0) {
        toast.success($t("settings.action_completed"));
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
    } catch (err) {
      // the api rejects with a plain string, but a dropped connection rejects
      // with an Error whose name would otherwise be prefixed onto the toast
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      loading.value = false;
    }
  };

  return { onAction };
}
