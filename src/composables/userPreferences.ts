import { computed, ComputedRef } from "vue";
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
}

/**
 * Standalone helper — usable outside Vue component setup (e.g. composables).
 * Sets a single user preference key, deep-clones the value, and persists to the server.
 */
export async function setUserPreference(
  key: string,
  value: unknown,
): Promise<void> {
  if (!store.currentUser) {
    console.warn("Cannot set preference: no user logged in");
    return;
  }

  if (!store.currentUser.preferences) {
    store.currentUser.preferences = {};
  }

  const plainValue = JSON.parse(JSON.stringify(value));

  const updatedPreferences = {
    ...store.currentUser.preferences,
    [key]: plainValue,
  };

  store.currentUser.preferences = updatedPreferences;

  try {
    await api.updateUser(store.currentUser.user_id, {
      preferences: updatedPreferences,
    });
  } catch (error) {
    console.error("Failed to update user preferences:", error);
  }
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

    const currentPrefs = getItemsListingPreferences(path, itemtype);
    const updatedPrefs = {
      ...currentPrefs.value,
      [key]: value,
    };

    await setPreference(prefKey, updatedPrefs);
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
 * Drop ids from every itemsListing.*.providerFilter for providers that no
 * longer have a config. Writes once if anything changed.
 *
 * Keyed off configs rather than loaded instances (api.providers): a disabled,
 * failing, or still-starting provider keeps its config and so keeps its filter.
 * Only a removed provider has no config.
 */
export async function pruneStaleProviderFilters(): Promise<void> {
  if (!store.currentUser?.preferences) return;

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

  const prefs = store.currentUser.preferences;
  const updatedPrefs: Record<string, unknown> = { ...prefs };
  let changed = false;

  for (const key of Object.keys(prefs)) {
    if (!key.startsWith("itemsListing.")) continue;
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
  }

  if (!changed) return;

  store.currentUser.preferences = updatedPrefs;
  try {
    await api.updateUser(store.currentUser.user_id, {
      preferences: updatedPrefs,
    });
  } catch (error) {
    console.error("Failed to prune stale provider filters:", error);
  }
}
