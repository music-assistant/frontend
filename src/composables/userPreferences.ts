import { computed } from "vue";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";

export interface ItemsListingPreferences {
  viewMode?: string;
  sortBy?: string;
  favoriteFilter?: boolean;
  libraryFilter?: boolean;
  albumArtistsFilter?: boolean;
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
   * Get a preference value from user preferences
   */
  function getPreference<T>(key: string, defaultValue?: T): T | undefined {
    if (!currentUser.value?.preferences) {
      return defaultValue;
    }
    const value = currentUser.value.preferences[key];
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set a preference value in user preferences
   * Updates optimistically on the client and sends to server
   */
  async function setPreference(key: string, value: any): Promise<void> {
    if (!currentUser.value) {
      console.warn("Cannot set preference: no user logged in");
      return;
    }

    // Optimistically update the local preferences
    const updatedPreferences = {
      ...currentUser.value.preferences,
      [key]: value,
    };

    // Update locally first (optimistic)
    currentUser.value.preferences = updatedPreferences;

    // Send to server in the background
    try {
      await api.updateUser(currentUser.value.user_id, {
        preferences: updatedPreferences,
      });
    } catch (error) {
      console.error("Failed to update user preferences:", error);
      // TODO: Consider reverting the optimistic update on error
    }
  }

  /**
   * Get ItemsListing preferences for a specific path/itemtype
   */
  function getItemsListingPreferences(
    path: string,
    itemtype: string,
  ): ItemsListingPreferences {
    const storKey = `${path}.${itemtype}`;
    return getPreference<ItemsListingPreferences>(
      `itemsListing.${storKey}`,
      {},
    ) || {};
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
      ...currentPrefs,
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
