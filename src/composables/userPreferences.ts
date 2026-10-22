import { computed, ComputedRef, toRaw } from "vue";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";

export interface ItemsListingPreferences {
  viewMode?: string;
  sortBy?: string;
  favoriteFilter?: boolean;
  libraryFilter?: boolean;
  albumArtistsFilter?: boolean;
  hideEmptyFilter?: boolean | null;
  hideFullyPlayedFilter?: boolean;
  albumType?: string[];
  providerFilter?: string[];
  expand?: boolean;
  search?: string;
  collapseCollections?: boolean;
  activeTab?: string;
}

/**
 * Standalone helper — usable outside Vue component setup (e.g. composables).
 * Sets a single user preference key, deep-clones the value, and persists to the server.
 */
export async function setUserPreference(
  key: string,
  value: unknown,
): Promise<void> {
  const plainValue = JSON.parse(JSON.stringify(value));
  await updateUserPreferences((current) => ({ ...current, [key]: plainValue }));
}

// Each request replaces the whole preferences object. Serialize writes and
// user refreshes so an older response cannot overwrite a later change.
let pendingWrite: Promise<unknown> = Promise.resolve();

export async function runAfterPreferenceWrites<T>(
  task: () => Promise<T>,
): Promise<T> {
  const queued = pendingWrite.then(task);
  pendingWrite = queued.catch(() => {});
  return await queued;
}

async function updateUserPreferences(
  change: (current: Record<string, unknown>) => Record<string, unknown> | null,
): Promise<void> {
  const userId = store.currentUser?.user_id;
  await runAfterPreferenceWrites(async () => {
    const currentUser = store.currentUser;
    if (!currentUser || currentUser.user_id !== userId) return;
    const previous = currentUser.preferences ?? {};
    const updated = change(previous);
    if (!updated) return;
    currentUser.preferences = updated;
    try {
      await api.updateUser(currentUser.user_id, { preferences: updated });
    } catch (error) {
      const latest = store.currentUser;
      if (latest?.user_id === userId && toRaw(latest.preferences) === updated) {
        latest.preferences = previous;
      }
      console.error("Failed to update user preferences:", error);
    }
  });
}

/**
 * Composable for managing user preferences stored on the server
 */
export function useUserPreferences() {
  const currentUser = computed(() => store.currentUser);

  /**
   * Get a preference value from user preferences as a computed ref
   */
  function getPreference<T>(key: string, defaultValue: T): ComputedRef<T>;
  function getPreference<T>(key: string): ComputedRef<T | undefined>;
  function getPreference<T>(
    key: string,
    defaultValue?: T,
  ): ComputedRef<T | undefined> {
    return computed(() => {
      if (!store.currentUser?.preferences) {
        return defaultValue;
      }
      const value = store.currentUser.preferences[key] as T | undefined;
      return value !== undefined ? value : defaultValue;
    });
  }

  /**
   * Set a preference value in user preferences
   * Updates optimistically on the client and sends to server
   */
  async function setPreference(key: string, value: unknown): Promise<void> {
    await setUserPreference(key, value);
  }

  /**
   * Get ItemsListing preferences for a specific path/itemtype as a computed ref
   */
  function getItemsListingPreferences(
    path: string,
    itemtype: string,
  ): ComputedRef<ItemsListingPreferences> {
    const storKey = `${path}.${itemtype}`;
    return computed(() => {
      if (!store.currentUser?.preferences) {
        return {};
      }
      const value = store.currentUser.preferences[`itemsListing.${storKey}`];
      return (value as ItemsListingPreferences) || {};
    });
  }

  /**
   * Set ItemsListing preferences for a specific path/itemtype
   */
  async function setItemsListingPreference(
    path: string,
    itemtype: string,
    key: keyof ItemsListingPreferences,
    value: ItemsListingPreferences[keyof ItemsListingPreferences],
  ): Promise<void> {
    const storKey = `${path}.${itemtype}`;
    const prefKey = `itemsListing.${storKey}`;

    const plainValue = JSON.parse(JSON.stringify({ [key]: value }));
    await updateUserPreferences((current) => ({
      ...current,
      [prefKey]: {
        ...(current[prefKey] as ItemsListingPreferences | undefined),
        // Keep an undefined value so clearing a listing filter removes it.
        [key]: plainValue[key],
      },
    }));
  }

  return {
    currentUser,
    getPreference,
    setPreference,
    getItemsListingPreferences,
    setItemsListingPreference,
  };
}

/**
 * Drop ids from every itemsListing.*.providerFilter and
 * discover.hiddenProviders.* for providers that no longer have a config.
 * Writes once if anything changed.
 *
 * Keyed off configs rather than loaded instances (api.providers): a disabled,
 * failing, or still-starting provider keeps its config and so keeps its filter.
 * Only a removed provider has no config.
 */
export async function pruneStaleProviderFilters(): Promise<void> {
  if (!store.currentUser?.preferences) return;
  const userId = store.currentUser.user_id;

  let configuredIds: Set<string>;
  try {
    const configs = await api.getProviderConfigs();
    configuredIds = new Set(configs.map((config) => config.instance_id));
  } catch (error) {
    console.error("Failed to load provider configs for filter pruning:", error);
    return;
  }
  // No configs yet (server not ready): never wipe filters.
  if (configuredIds.size === 0) return;
  if (store.currentUser?.user_id !== userId) return;

  await updateUserPreferences((prefs) =>
    pruneProviderFilters(prefs, configuredIds),
  );
}

function pruneProviderFilters(
  prefs: Record<string, unknown>,
  configuredIds: Set<string>,
): Record<string, unknown> | null {
  const updatedPrefs: Record<string, unknown> = { ...prefs };
  let changed = false;

  for (const key of Object.keys(prefs)) {
    if (key.startsWith("itemsListing.")) {
      const value = prefs[key] as ItemsListingPreferences | undefined;
      if (!value || !Array.isArray(value.providerFilter)) continue;
      const pruned = value.providerFilter.filter((id) => configuredIds.has(id));
      if (pruned.length === value.providerFilter.length) continue;
      changed = true;
      const next: ItemsListingPreferences = { ...value };
      if (pruned.length === 0) {
        delete next.providerFilter;
      } else {
        next.providerFilter = pruned;
      }
      updatedPrefs[key] = next;
    } else if (key.startsWith("discover.hiddenProviders.")) {
      // matches rowHiddenProvidersKey's prefix in components/discover/utils/rowProviderFilter.ts
      const value = prefs[key];
      if (!Array.isArray(value)) continue;
      const pruned = (value as string[]).filter((id) => configuredIds.has(id));
      if (pruned.length === value.length) continue;
      changed = true;
      if (pruned.length === 0) {
        delete updatedPrefs[key];
      } else {
        updatedPrefs[key] = pruned;
      }
    }
  }

  return changed ? updatedPrefs : null;
}
