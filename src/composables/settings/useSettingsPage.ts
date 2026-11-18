import { useConfigAction } from "@/composables/useConfigAction";
import {
  buildSettingsForm,
  changedValuesByOwner,
  storedValues,
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
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { ref, toRef } from "vue";

// how the settings of one kind of owner are read, saved and acted on
interface SettingsOwnerAdapter {
  load: (id: string) => Promise<Config>;
  save: (
    id: string,
    values: Record<string, ConfigValueType>,
  ) => Promise<Config>;
  invokeAction: (
    id: string,
    action: string,
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
};

/**
 * The settings a settings page shows, loaded from each of their owners, and
 * saved back to each owner separately. Nothing loads for a user who may not
 * change them.
 *
 * @param pageId - The settings page.
 */
export function useSettingsPage(pageId: SettingsPageId) {
  const { sources } = SETTINGS_PAGES[pageId];
  const canEdit = canEditSettingsPage(pageId, (scope) =>
    authManager.hasScope(scope),
  );

  // the config of each source of the page, in the order of the sources
  const configs = ref<Config[]>([]);
  const entries = ref<ConfigEntry[]>([]);
  const loaded = ref(false);
  const loadFailed = ref(false);
  const busy = ref(false);
  let owners = new Map<string, SettingsOwner>();
  // the values the server has, so a save only sends what changed
  let saved: Record<string, ConfigValueType> = {};

  /**
   * Save the values that changed, each owner its own. Resolves whether every
   * owner stored them.
   */
  const save = async function (
    values: Record<string, ConfigValueType>,
  ): Promise<boolean> {
    const changes = changedValuesByOwner(values, saved, owners);
    if (changes.length === 0) return true;
    busy.value = true;
    try {
      const outcomes = await Promise.allSettled(
        changes.map(async ({ owner, values: ownerValues }) => {
          const config = await OWNER_ADAPTERS[owner.kind].save(
            owner.id,
            ownerValues,
          );
          saved = { ...saved, ...storedValues(formEntriesOf(owner, config)) };
        }),
      );
      // the api reports a failed save itself
      return outcomes.every((outcome) => outcome.status === "fulfilled");
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
    const owner = entry && owners.get(entry.key);
    if (!owner) return;
    const index = sources.findIndex((source) =>
      isSameOwner(source.owner, owner),
    );
    const adapter = OWNER_ADAPTERS[owner.kind];
    const { onAction: invoke } = useConfigAction({
      config: toRef(configs.value, index),
      loading: busy,
      invokeAction: (name) => adapter.invokeAction(owner.id, name),
      saveValues: (raw) => adapter.save(owner.id, raw),
    });
    await invoke(action, values, immediateApply);
    rebuildForm();
    if (immediateApply) {
      saved = {
        ...saved,
        ...storedValues(formEntriesOf(owner, configs.value[index])),
      };
    }
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
    const form = buildSettingsForm(
      sources.map((source, index) => ({
        source,
        entries: Object.values(configs.value[index].values),
      })),
    );
    entries.value = form.entries;
    owners = form.owners;
  };

  // the entries of a config of an owner that the form shows
  const formEntriesOf = function (
    owner: SettingsOwner,
    config: Config,
  ): ConfigEntry[] {
    return Object.values(config.values).filter((entry) => {
      const entryOwner = owners.get(entry.key);
      return entryOwner !== undefined && isSameOwner(entryOwner, owner);
    });
  };

  if (canEdit) void load();

  return { entries, loaded, loadFailed, busy, canEdit, save, onAction };
}
