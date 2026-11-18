import { useConfigAction } from "@/composables/useConfigAction";
import {
  buildSettingsForm,
  changedValuesByOwner,
  storedValues,
  type OwnerChanges,
  type SettingsField,
  type SettingsForm,
} from "@/helpers/settings_form";
import {
  canEditSettingsPage,
  isSameOwner,
  SETTINGS_PAGES,
  type SettingsOwner,
  type SettingsOwnerKind,
  type SettingsPageId,
} from "@/helpers/settings_pages";
import { api } from "@/plugins/api";
import type {
  Config,
  ConfigActionResult,
  ConfigEntry,
  ConfigValueType,
  ProviderConfig,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { ref, toRef } from "vue";

// how the settings of one kind of owner are read, saved and acted on; a save
// and an action get the config the owner loaded
interface SettingsOwnerAdapter {
  // resolves nothing for an owner without settings to show
  load: (id: string) => Promise<Config | undefined>;
  save: (
    id: string,
    values: Record<string, ConfigValueType>,
    loaded: Config,
  ) => Promise<Config>;
  invokeAction: (
    id: string,
    action: string,
    loaded: Config,
  ) => Promise<ConfigEntry[] | ConfigActionResult>;
}

const OWNER_ADAPTERS: Readonly<
  Record<SettingsOwnerKind, SettingsOwnerAdapter>
> = {
  core: {
    load: (id) => api.getCoreConfig(id),
    // clears the cached core config values as well
    save: (id, values) => api.saveCoreConfig(id, values),
    invokeAction: (id, action) => api.invokeCoreConfigAction(id, action),
  },
  // the settings of the single instance of a provider; nothing while the
  // provider is not set up
  provider: {
    load: async (id) => {
      // the list of provider configs comes without their entries
      const [summary] = await api.getProviderConfigs(undefined, id);
      return summary && api.getProviderConfig(summary.instance_id);
    },
    save: (id, values, loaded) =>
      api.saveProviderConfig(id, values, instanceIdOf(loaded)),
    invokeAction: (_id, action, loaded) =>
      api.invokeProviderConfigAction(instanceIdOf(loaded), action),
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
  const { sources } = SETTINGS_PAGES[pageId];
  const canEdit = canEditSettingsPage(pageId, (scope) =>
    authManager.hasScope(scope),
  );

  // the config of each source of the page, in the order of the sources; none
  // for an owner without settings to show
  const configs = ref<(Config | undefined)[]>([]);
  const entries = ref<ConfigEntry[]>([]);
  const loaded = ref(false);
  const loadFailed = ref(false);
  const busy = ref(false);
  let fields = new Map<string, SettingsField>();
  // the values the server has, so a save only sends what changed
  let saved: Record<string, ConfigValueType> = {};

  /**
   * Save the values that changed, each owner its own. Resolves whether every
   * owner stored them.
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
        loadedConfigOf,
        (owner, config) => {
          saved = { ...saved, ...storedValues(formEntriesOf(owner, config)) };
        },
      );
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
      configs.value = await Promise.all(
        sources.map(({ owner }) => OWNER_ADAPTERS[owner.kind].load(owner.id)),
      );
      rebuildForm();
      saved = storedValues(entries.value);
      loaded.value = true;
    } catch {
      // the api reports the failure itself
      loadFailed.value = true;
    }
  };

  const rebuildForm = function (): void {
    const form = buildForm(configs.value);
    entries.value = form.entries;
    fields = form.fields;
  };

  // the form of the page from the given config of each source; a source
  // without one adds nothing
  const buildForm = function (
    pageConfigs: readonly (Config | undefined)[],
  ): SettingsForm {
    return buildSettingsForm(
      sources.map((source, index) => ({
        source,
        entries: Object.values(pageConfigs[index]?.values ?? {}),
      })),
      (key) => $t(key),
    );
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

  // the config of an owner with entries in the form, which only such an owner has
  const loadedConfigOf = function (owner: SettingsOwner): Config {
    return configs.value[sourceIndexOf(owner)]!;
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

/**
 * Save the changes of each owner to that owner. Resolves whether every owner
 * stored its changes; the api reports a failed save itself.
 *
 * @param changes - The changed values of each owner.
 * @param loadedConfigOf - Gives the config an owner loaded.
 * @param onSaved - Takes the config an owner stored.
 */
export async function saveOwnerChanges(
  changes: readonly OwnerChanges[],
  loadedConfigOf: (owner: SettingsOwner) => Config,
  onSaved: (owner: SettingsOwner, config: Config) => void,
): Promise<boolean> {
  const outcomes = await Promise.allSettled(
    changes.map(async ({ owner, values }) => {
      const adapter = OWNER_ADAPTERS[owner.kind];
      onSaved(
        owner,
        await adapter.save(owner.id, values, loadedConfigOf(owner)),
      );
    }),
  );
  return outcomes.every((outcome) => outcome.status === "fulfilled");
}

// the instance a provider owner loaded
function instanceIdOf(loaded: Config): string {
  return (loaded as ProviderConfig).instance_id;
}
