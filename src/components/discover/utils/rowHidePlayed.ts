// Per-row "hide fully played" filter, keyed by row id -- mirrors rowProviderFilter.ts.
import { setUserPreference } from "@/composables/userPreferences";
import {
  RecommendationFolderType,
  type RecommendationFolder,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

const HIDE_PLAYED_PREFERENCE_PREFIX = "discover.hidePlayed.";

export function rowHidePlayedKey(rowId: string): string {
  return `${HIDE_PLAYED_PREFERENCE_PREFIX}${rowId}`;
}

/** Whether fully played items are hidden from the given row. */
export function getRowHidePlayed(rowId: string): boolean {
  return store.currentUser?.preferences?.[rowHidePlayedKey(rowId)] === true;
}

/** Set whether fully played items are hidden from the given row. */
export async function setRowHidePlayed(
  rowId: string,
  hidePlayed: boolean,
): Promise<void> {
  await setUserPreference(rowHidePlayedKey(rowId), hidePlayed);
}

/**
 * Whether a row's "hide fully played" switch should be offered: the server
 * marks the folder as supporting it, and the row renders through the shelf
 * rather than the timeline layout, which has no filter control.
 */
export function rowSupportsHidePlayed(folder: RecommendationFolder): boolean {
  return (
    !!folder.supports_hide_played &&
    folder.type !== RecommendationFolderType.TIMELINE
  );
}

/** Whether fully played items are left out of the given row's items. */
export function rowHidesPlayed(
  folder: RecommendationFolder,
  rowId: string,
): boolean {
  return rowSupportsHidePlayed(folder) && getRowHidePlayed(rowId);
}
