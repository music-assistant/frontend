// Per-row "hide these providers" filter, keyed by row id -- mirrors discoverRows.ts's per-row preference pattern.
import { setUserPreference } from "@/composables/userPreferences";
import { store } from "@/plugins/store";

const HIDDEN_PROVIDERS_PREFERENCE_PREFIX = "discover.hiddenProviders.";

export function rowHiddenProvidersKey(rowId: string): string {
  return `${HIDDEN_PROVIDERS_PREFERENCE_PREFIX}${rowId}`;
}

/** Provider instance ids currently hidden from the given row. */
export function getRowHiddenProviders(rowId: string): string[] {
  const pref = store.currentUser?.preferences?.[rowHiddenProvidersKey(rowId)];
  return Array.isArray(pref) ? (pref as string[]) : [];
}

/** Replace the set of provider instance ids hidden from the given row. */
export async function setRowHiddenProviders(
  rowId: string,
  providerIds: string[],
): Promise<void> {
  await setUserPreference(rowHiddenProvidersKey(rowId), providerIds);
}
