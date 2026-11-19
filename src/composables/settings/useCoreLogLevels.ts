import { saveOwnerChanges } from "@/composables/settings/useSettingsPage";
import { coreModuleName } from "@/helpers/core_modules";
import {
  buildLogLevelForm,
  changedValuesByOwner,
  storedValues,
  type SettingsField,
  type SettingsForm,
} from "@/helpers/settings_form";
import { api } from "@/plugins/api";
import {
  Scope,
  type ConfigEntry,
  type ConfigValueType,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";

/**
 * The log level of each core module the server reports, as the entries of one
 * form, each saved to its own module. Nothing loads for a user who may not
 * change them.
 */
export function useCoreLogLevels() {
  const canEdit = authManager.hasScope(Scope.CONFIG_CORE_WRITE);
  const entries = ref<ConfigEntry[]>([]);
  const loaded = ref(false);
  const loadFailed = ref(false);
  const busy = ref(false);
  let fields = new Map<string, SettingsField>();
  let configs: CoreConfig[] = [];
  // the values the server has, so a save only sends what changed
  let saved: Record<string, ConfigValueType> = {};

  /**
   * Save the log levels that changed, each module its own. Resolves whether
   * every module stored them.
   */
  const save = async function (
    values: Record<string, ConfigValueType>,
  ): Promise<boolean> {
    const changes = changedValuesByOwner(values, saved, fields);
    if (changes.length === 0) return true;
    busy.value = true;
    try {
      return await saveOwnerChanges(
        changes,
        (owner) => configs.find(({ domain }) => domain === owner.id)!,
        (owner, config) => {
          const form = buildForm([{ domain: owner.id, values: config.values }]);
          saved = { ...saved, ...storedValues(form.entries) };
        },
      );
    } finally {
      busy.value = false;
    }
  };

  const load = async function (): Promise<void> {
    try {
      configs = await api.getCoreConfigs(true);
      const form = buildForm(configs);
      entries.value = form.entries;
      fields = form.fields;
      saved = storedValues(form.entries);
      loaded.value = true;
    } catch {
      // the api reports the failure itself
      loadFailed.value = true;
    }
  };

  const buildForm = function (
    configs: readonly Pick<CoreConfig, "domain" | "values">[],
  ): SettingsForm {
    return buildLogLevelForm(
      configs,
      (domain) =>
        coreModuleName(
          domain,
          (key) => $t(key),
          api.providerManifests[domain]?.name,
        ),
      $t("settings.log_levels"),
    );
  };

  if (canEdit) void load();

  return { entries, loaded, loadFailed, busy, canEdit, save };
}
