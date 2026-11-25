import { api, ApiCommandError } from "@/plugins/api";
import type {
  Config,
  ConfigEntry,
  ConfigValueType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

/** Where a config value is stored: a core module, or a provider instance. */
export type ConfigValueOwner =
  | { kind: "core"; domain: string }
  | { kind: "provider"; domain: string; instanceId: string };

// the save reports its own failure, so the api does not report it as well
const SAVE_OPTIONS = { suppressGlobalError: true };

/**
 * One config value of a core module or provider instance, with its entry as
 * the owner offers it: its label, options and default. Changing it saves that
 * value alone, confirms it with a toast, and reports a failure with a toast and
 * the stored value back in place.
 *
 * A provider restarts to apply a changed option; the value is busy until the
 * provider is loaded again.
 *
 * @param owner - The core module or provider instance storing the value.
 * @param key - The key of the value's config entry.
 */
export function useConfigValue(owner: ConfigValueOwner, key: string) {
  // the entry with the stored value; none until it loaded
  const entry = ref<ConfigEntry>();
  const loadFailed = ref(false);
  const saving = ref(false);
  let requestId = 0;

  // a provider that is not loaded, as while it restarts, offers no options
  const restarting = computed(
    () => owner.kind === "provider" && !(owner.instanceId in api.providers),
  );
  const busy = computed(() => saving.value || restarting.value);

  /**
   * Load the entry again, for options that changed on the owner. An owner that
   * offers no such entry right now, such as a provider that is restarting,
   * keeps the entry it had.
   */
  const reload = async function (): Promise<void> {
    const id = ++requestId;
    try {
      const loaded = (await loadConfig(owner)).values[key];
      if (id !== requestId) return;
      if (loaded) entry.value = loaded;
      loadFailed.value = !entry.value;
    } catch {
      // the api reports the failure itself
      if (id === requestId) loadFailed.value = !entry.value;
    }
  };

  /**
   * Save a new value. Resolves whether it was stored; an unchanged value is
   * not saved.
   *
   * @param value - The new value.
   */
  const save = async function (value: ConfigValueType): Promise<boolean> {
    const current = entry.value;
    if (!current || value === current.value) return false;
    const stored = current.value;
    // a load already on its way would bring back the value from before
    requestId++;
    current.value = value;
    saving.value = true;
    try {
      const saved = (await saveConfig(owner, { [key]: value })).values[key];
      if (saved) entry.value = saved;
      toast.success($t("settings.settings_saved"));
      return true;
    } catch (error) {
      current.value = stored;
      toast.error(
        error instanceof ApiCommandError && error.details
          ? error.details
          : $t("settings.save_failed"),
      );
      return false;
    } finally {
      saving.value = false;
    }
  };

  void reload();

  return { entry, loadFailed, busy, save, reload };
}

function loadConfig(owner: ConfigValueOwner): Promise<Config> {
  return owner.kind === "core"
    ? api.getCoreConfig(owner.domain)
    : api.getProviderConfig(owner.instanceId);
}

function saveConfig(
  owner: ConfigValueOwner,
  values: Record<string, ConfigValueType>,
): Promise<Config> {
  return owner.kind === "core"
    ? api.saveCoreConfig(owner.domain, values, SAVE_OPTIONS)
    : api.saveProviderConfig(
        owner.domain,
        values,
        owner.instanceId,
        SAVE_OPTIONS,
      );
}
