import { useConfigAction } from "@/composables/useConfigAction";
import { coreModuleName } from "@/helpers/core_modules";
import {
  buildLogLevelForm,
  buildSettingsForm,
  changedValuesByOwner,
  storedValues,
  type OwnerChanges,
  type SettingsField,
  type SettingsForm,
} from "@/helpers/settings_form";
import {
  canEditSettingsPage,
  coreOwner,
  isSameOwner,
  SETTINGS_PAGES,
  type SettingsOwner,
  type SettingsOwnerKind,
  type SettingsPageId,
} from "@/helpers/settings_pages";
import { api } from "@/plugins/api";
import type { CommandOptions } from "@/plugins/api/commandOptions";
import type {
  Config,
  ConfigActionResult,
  ConfigEntry,
  ConfigValueType,
  CoreConfig,
  ProviderConfig,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { ref, toRef } from "vue";
import { toast } from "vue-sonner";

// what a save of the settings of a page stored
export interface SettingsSaveResult {
  // the given values, but for those of an owner that did not store its changes
  stored: Record<string, ConfigValueType>;
  // whether every owner stored its changes
  complete: boolean;
}

// the domain and entries of a core module, as the form of the log levels takes them
type ModuleConfig = Pick<CoreConfig, "domain" | "values">;

// how the settings of one kind of owner are read, saved and acted on; a save
// and an action get the config the owner loaded
interface SettingsOwnerAdapter {
  // resolves nothing for an owner without settings to show
  load: (id: string) => Promise<Config | undefined>;
  save: (
    id: string,
    values: Record<string, ConfigValueType>,
    loaded: Config,
    options?: CommandOptions,
  ) => Promise<Config>;
  invokeAction: (
    id: string,
    action: string,
    loaded: Config,
  ) => Promise<ConfigEntry[] | ConfigActionResult>;
  // the name the user knows the owner by
  name: (id: string) => string;
}

const OWNER_ADAPTERS: Readonly<
  Record<SettingsOwnerKind, SettingsOwnerAdapter>
> = {
  core: {
    load: (id) => api.getCoreConfig(id),
    // clears the cached core config values as well
    save: (id, values, _loaded, options) =>
      api.saveCoreConfig(id, values, options),
    invokeAction: (id, action) => api.invokeCoreConfigAction(id, action),
    name: (id) =>
      coreModuleName(id, (key) => $t(key), api.providerManifests[id]?.name),
  },
  // the settings of the single instance of a provider; nothing while the
  // provider is not set up
  provider: {
    load: async (id) => {
      // the list of provider configs comes without their entries
      const [summary] = await api.getProviderConfigs(undefined, id);
      return summary && api.getProviderConfig(summary.instance_id);
    },
    save: (id, values, loaded, options) =>
      api.saveProviderConfig(id, values, instanceIdOf(loaded), options),
    invokeAction: (_id, action, loaded) =>
      api.invokeProviderConfigAction(instanceIdOf(loaded), action),
    name: (id) => api.providerManifests[id]?.name ?? id,
  },
};

/**
 * The settings a settings page shows, loaded from each of their owners, and
 * saved back to each owner separately. Nothing loads for a user who may not
 * change them.
 *
 * The entries are keyed the way the form of the page holds them, which on a
 * page with several sources qualifies them by their owner.
 *
 * @param pageId - The settings page.
 */
export function useSettingsPage(pageId: SettingsPageId) {
  const { sources, logLevels } = SETTINGS_PAGES[pageId];
  const canEdit = canEditSettingsPage(pageId, (scope) =>
    authManager.hasScope(scope),
  );

  // the config of each source of the page, in the order of the sources; none
  // for an owner without settings to show
  const configs = ref<(Config | undefined)[]>([]);
  // the config of every core module, on a page that sets their log levels
  let moduleConfigs: CoreConfig[] = [];
  const entries = ref<ConfigEntry[]>([]);
  const loaded = ref(false);
  const loadFailed = ref(false);
  const busy = ref(false);
  let fields = new Map<string, SettingsField>();
  // the values the server has, so a save only sends what changed
  let saved: Record<string, ConfigValueType> = {};

  /**
   * Save the values that changed, each owner its own. The changes of one owner
   * land or fail together, apart from those of the others; a toast names the
   * owners that did not store theirs.
   */
  const save = async function (
    values: Record<string, ConfigValueType>,
  ): Promise<SettingsSaveResult> {
    const changes = changedValuesByOwner(values, saved, fields);
    if (changes.length === 0) return { stored: values, complete: true };
    busy.value = true;
    try {
      const failed = await saveOwnerChanges(
        changes,
        loadedConfigOf,
        (owner, config) => {
          saved = { ...saved, ...storedValues(formEntriesOf(owner, config)) };
        },
      );
      const stored = Object.fromEntries(
        Object.entries(values).filter(([formKey]) => {
          const owner = fields.get(formKey)?.owner;
          return !owner || !failed.some((f) => isSameOwner(f, owner));
        }),
      );
      return { stored, complete: failed.length === 0 };
    } finally {
      busy.value = false;
    }
  };

  /**
   * Run the action of an entry on its owner, and show the entries it returns.
   */
  const onAction = async function (
    action: string,
    values: Record<string, ConfigValueType>,
    immediateApply: boolean,
  ): Promise<void> {
    const entry = entries.value.find((e) => (e.action || e.key) === action);
    const field = entry && fields.get(entry.key);
    if (!field) return;
    const { owner } = field;
    const index = sourceIndexOf(owner);
    const loaded = loadedConfigOf(owner);
    const ownerEntry = loaded.values[field.key];
    // the form is rebuilt from the configs afterwards, so they take what was typed
    keepFormValues(values);
    const adapter = OWNER_ADAPTERS[owner.kind];
    const { onAction: invoke } = useConfigAction({
      config: toRef(configs.value, index),
      loading: busy,
      invokeAction: (name) => adapter.invokeAction(owner.id, name, loaded),
      saveValues: (raw) => adapter.save(owner.id, raw, loaded),
    });
    await invoke(ownerEntry.action || ownerEntry.key, values, immediateApply);
    rebuildForm();
    if (immediateApply) {
      saved = {
        ...saved,
        ...storedValues(formEntriesOf(owner, loadedConfigOf(owner))),
      };
    }
  };

  /**
   * The entry of the form holding a setting of an owner, if the page shows it.
   */
  const entryOf = function (
    owner: SettingsOwner,
    key: string,
  ): ConfigEntry | undefined {
    return entries.value.find((entry) => {
      const field = fields.get(entry.key);
      return field?.key === key && isSameOwner(field.owner, owner);
    });
  };

  const load = async function (): Promise<void> {
    try {
      [configs.value, moduleConfigs] = await Promise.all([
        Promise.all(
          sources.map(({ owner }) => OWNER_ADAPTERS[owner.kind].load(owner.id)),
        ),
        // the configs carry their entries only on request
        logLevels ? api.getCoreConfigs(true) : [],
      ]);
      rebuildForm();
      saved = storedValues(entries.value);
      loaded.value = true;
    } catch {
      // the api reports the failure itself
      loadFailed.value = true;
    }
  };

  const rebuildForm = function (): void {
    // a module that is a source of the page keeps its log level in the config
    // of that source, where an action leaves what was typed
    const form = buildForm(
      configs.value,
      moduleConfigs.map(({ domain }) => ({
        domain,
        values: loadedConfigOf(coreOwner(domain)).values,
      })),
    );
    entries.value = form.entries;
    fields = form.fields;
  };

  // the form of the page from the given config of each source, led by the log
  // levels of the given core modules on a page that sets them; a source
  // without a config adds nothing
  const buildForm = function (
    pageConfigs: readonly (Config | undefined)[],
    logLevelConfigs: readonly ModuleConfig[],
  ): SettingsForm {
    const form = buildSettingsForm(
      sources.map((source, index) => ({
        source,
        entries: Object.values(pageConfigs[index]?.values ?? {}),
      })),
      (key) => $t(key),
    );
    if (!logLevels) return form;
    const levels = buildLogLevelForm(
      logLevelConfigs,
      OWNER_ADAPTERS.core.name,
      $t("settings.log_levels"),
    );
    return {
      entries: [...levels.entries, ...form.entries],
      fields: new Map([...levels.fields, ...form.fields]),
    };
  };

  // the entries of a config of an owner as the form shows them
  const formEntriesOf = function (
    owner: SettingsOwner,
    config: Config,
  ): ConfigEntry[] {
    return buildForm(
      sources.map((source) =>
        isSameOwner(source.owner, owner) ? config : undefined,
      ),
      owner.kind === "core"
        ? [{ domain: owner.id, values: config.values }]
        : [],
    ).entries;
  };

  // copies the values of the form into the configs it is built from
  const keepFormValues = function (
    values: Record<string, ConfigValueType>,
  ): void {
    for (const [formKey, value] of Object.entries(values)) {
      const field = fields.get(formKey);
      if (!field) continue;
      const entry = loadedConfigOf(field.owner).values[field.key];
      if (entry) entry.value = value;
    }
  };

  const sourceIndexOf = function (owner: SettingsOwner): number {
    return sources.findIndex((source) => isSameOwner(source.owner, owner));
  };

  // the config of an owner with entries in the form, which only such an owner
  // has: that of its source, else that of a core module with only its log level
  // in the form
  const loadedConfigOf = function (owner: SettingsOwner): Config {
    return (
      configs.value[sourceIndexOf(owner)] ??
      moduleConfigs.find(
        ({ domain }) => owner.kind === "core" && domain === owner.id,
      )!
    );
  };

  if (canEdit) void load();

  return {
    entries,
    loaded,
    loadFailed,
    busy,
    canEdit,
    save,
    onAction,
    entryOf,
  };
}

// saves the changes of each owner to that owner, and resolves the owners that
// did not store theirs, after naming them in a toast with the reasons the
// server gave
async function saveOwnerChanges(
  changes: readonly OwnerChanges[],
  loadedConfigOf: (owner: SettingsOwner) => Config,
  onSaved: (owner: SettingsOwner, config: Config) => void,
): Promise<SettingsOwner[]> {
  const outcomes = await Promise.allSettled(
    changes.map(async ({ owner, values }) => {
      const adapter = OWNER_ADAPTERS[owner.kind];
      // the toast below reports the failure along with the owner it hit
      const options = { suppressGlobalError: true };
      onSaved(
        owner,
        await adapter.save(owner.id, values, loadedConfigOf(owner), options),
      );
    }),
  );
  const failed: SettingsOwner[] = [];
  const reasons = new Set<string>();
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") return;
    failed.push(changes[index].owner);
    if (outcome.reason instanceof Error) reasons.add(outcome.reason.message);
  });
  if (failed.length > 0) {
    const names = failed.map(({ kind, id }) => OWNER_ADAPTERS[kind].name(id));
    toast.error($t("settings.settings_save_failed_for", [names.join(", ")]), {
      description: [...reasons].join("; ") || undefined,
    });
  }
  return failed;
}

// the instance a provider owner loaded
function instanceIdOf(loaded: Config): string {
  return (loaded as ProviderConfig).instance_id;
}
