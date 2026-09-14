import { computed, ComputedRef } from "vue";
import { api, type CommandOptions } from "@/plugins/api";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
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
  await setUserPreferences({ [key]: value });
}

/**
 * What is in flight, whichever it is. Every write sends the whole preferences
 * object, so two of them on their way at once would have the one that lands
 * last overwrite whatever the other added — a member answering the welcome and
 * walking off to another page as it saves is exactly that. Everything that
 * reads and replaces the preferences waits here for what is ahead of it, and
 * only then reads what it is about to change.
 */
let pendingWrite: Promise<unknown> = Promise.resolve();

/**
 * Take a turn in that queue for something other than a write: refreshing the
 * signed-in user replaces their preferences wholesale, and a refresh that
 * overtook a write on its way out would put them back as they were before it —
 * for the next write to send on. Waits for what is already on its way, and
 * holds up what comes after until it is done.
 */
export async function runAfterPreferenceWrites<T>(
  task: () => Promise<T>,
): Promise<T> {
  const queued = pendingWrite.then(task);
  // something that went wrong is nothing for the next one to wait on forever
  pendingWrite = queued.catch(() => {});
  return await queued;
}

/**
 * The same for several keys at once, in a single update: settings that belong
 * to one answer are written together, so the account never ends up holding half
 * of it. Says whether the server took them, for the callers that have something
 * to tell the user when it did not — `options` is how such a caller keeps the
 * api's own error toast out of the way of its own.
 */
export async function setUserPreferences(
  values: Record<string, unknown>,
  options?: CommandOptions,
): Promise<boolean> {
  const plainValues = JSON.parse(JSON.stringify(values));
  return await updateUserPreferences(
    (current) => ({ ...current, ...plainValues }),
    options,
  );
}

/**
 * Change the signed-in user's preferences and persist them — the one way they
 * are written. `change` is handed the preferences as they stand when its turn
 * comes, and answers with what they should become, or `null` when there is
 * nothing to write after all. Says whether the server took them.
 */
export async function updateUserPreferences(
  change: (current: Record<string, unknown>) => Record<string, unknown> | null,
  options?: CommandOptions,
): Promise<boolean> {
  // whose preferences these are, read before the write queues: what it is
  // written onto has to be the account it was asked for
  const userId = store.currentUser?.user_id;
  return await runAfterPreferenceWrites(() =>
    writeUserPreferences(userId, change, options),
  );
}

async function writeUserPreferences(
  userId: string | undefined,
  change: (current: Record<string, unknown>) => Record<string, unknown> | null,
  options?: CommandOptions,
): Promise<boolean> {
  const currentUser = store.currentUser;
  if (!currentUser) {
    console.warn("Cannot set preference: no user logged in");
    return false;
  }
  // signing out and back in, or switching accounts, while this waited its turn
  // leaves it nothing to write onto: it belongs to the account that asked
  if (currentUser.user_id !== userId) {
    console.warn("Cannot set preference: the account changed since it was set");
    return false;
  }

  const previousPreferences = currentUser.preferences ?? {};
  const updatedPreferences = change(previousPreferences);
  // the change looked at what is there and found nothing to do
  if (!updatedPreferences) return true;

  currentUser.preferences = updatedPreferences;

  try {
    await api.updateUser(
      currentUser.user_id,
      { preferences: updatedPreferences },
      options,
    );
    return true;
  } catch (error) {
    console.error("Failed to update user preferences:", error);
    // put back what the account had: a value the server would not take must
    // not sit there looking saved, nor ride along on the next write. Unless
    // something has been written since, which is nobody's to undo
    const latest = store.currentUser;
    if (latest && latest.preferences === updatedPreferences) {
      latest.preferences = previousPreferences;
    }
    return false;
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
  // listing the configured providers takes a scope not every role holds
  if (!authManager.hasScope(Scope.CONFIG_PROVIDERS_READ)) return;
  const userId = store.currentUser.user_id;

  let configuredIds: Set<string>;
  try {
    const configs = await api.getProviderConfigs();
    configuredIds = new Set(configs.map((config) => config.instance_id));
  } catch (error) {
    console.error("Failed to load provider configs for filter pruning:", error);
    return;
  }
  // the configurations were listed for the account that asked, and so was the
  // scope check made on its behalf: whoever is signed in now may hold neither
  if (store.currentUser?.user_id !== userId) return;
  // No configs yet (server not ready): never wipe filters.
  if (configuredIds.size === 0) return;

  // through the queue like every other write: a prune that went out on its own
  // would land on top of whatever the user was just told had been saved
  await updateUserPreferences((current) =>
    pruneProviderFilters(current, configuredIds),
  );
}

/**
 * The preferences with every filter naming a provider that no longer has a
 * configuration dropped, or `null` when none of them does.
 */
function pruneProviderFilters(
  preferences: Record<string, unknown>,
  configuredIds: Set<string>,
): Record<string, unknown> | null {
  const updatedPrefs: Record<string, unknown> = { ...preferences };
  let changed = false;

  for (const key of Object.keys(preferences)) {
    if (key.startsWith("itemsListing.")) {
      const value = preferences[key] as ItemsListingPreferences | undefined;
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
      const value = preferences[key];
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
