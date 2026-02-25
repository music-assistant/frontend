import { computed, ComputedRef } from "vue";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";

export interface ItemsListingPreferences {
  viewMode?: string;
  sortBy?: string;
  favoriteFilter?: boolean;
  libraryFilter?: boolean;
  albumArtistsFilter?: boolean;
  hideEmptyFilter?: boolean;
  albumType?: string[];
  providerFilter?: string[];
  expand?: boolean;
  search?: string;
}

/**
 * Composable for managing user preferences stored on the server
 */
export function useUserPreferences() {
  const currentUser = computed(() => store.currentUser);

  /**
   * Get a preference value from user preferences as a computed ref
   */
  function getPreference<T>(
    key: string,
    defaultValue?: T,
  ): ComputedRef<T | undefined> {
    return computed(() => {
      if (!store.currentUser?.preferences) {
        return defaultValue;
      }
      const value = store.currentUser.preferences[key];
      return value !== undefined ? value : defaultValue;
    });
  }

  /**
   * Set a preference value in user preferences
   * Updates optimistically on the client and sends to server
   */
  async function setPreference(key: string, value: any): Promise<void> {
    if (!store.currentUser) {
      console.warn("Cannot set preference: no user logged in");
      return;
    }

    if (!store.currentUser.preferences) {
      store.currentUser.preferences = {};
    }

    // Deep clone to ensure we have plain objects, not reactive/computed refs
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
    value: any,
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
