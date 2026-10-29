import { useUserPreferences } from "@/composables/userPreferences";

/**
 * A listing's own settings saves, and the restores they hold back. While one
 * is on its way, the settings an earlier save hands back can predate an edit
 * made since, so a restore waits; once the last save has settled, `onSettled`
 * runs to catch up on what waited.
 */
export function useListingSaves(onSettled: () => void) {
  const {
    setItemsListingPreference: writeListingPreference,
    setItemsListingPreferences: writeListingPreferences,
  } = useUserPreferences();

  let pendingSaves = 0;
  let restoreHeld = false;

  const trackSave = async (save: Promise<void>) => {
    pendingSaves++;
    try {
      await save;
    } finally {
      pendingSaves--;
      if (pendingSaves === 0 && restoreHeld) {
        restoreHeld = false;
        onSettled();
      }
    }
  };

  const setItemsListingPreference: typeof writeListingPreference = (...args) =>
    trackSave(writeListingPreference(...args));
  const setItemsListingPreferences: typeof writeListingPreferences = (
    ...args
  ) => trackSave(writeListingPreferences(...args));

  /** Whether a restore has to wait for the saves; one that does runs later. */
  const holdRestore = () => {
    if (pendingSaves === 0) return false;
    restoreHeld = true;
    return true;
  };

  return { setItemsListingPreference, setItemsListingPreferences, holdRestore };
}
