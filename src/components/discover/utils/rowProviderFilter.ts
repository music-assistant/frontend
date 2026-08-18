// Per-row "hide these providers" filter, keyed by row id -- mirrors discoverRows.ts's per-row preference pattern.
import { setUserPreference } from "@/composables/userPreferences";
import {
  ProviderType,
  RecommendationFolderType,
  type ProviderInstance,
  type RecommendationFolder,
} from "@/plugins/api/interfaces";
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

/**
 * Music providers a user may filter recommendation rows by: configured music
 * providers, restricted to the user's own `provider_filter` when they have one
 * (mirrors ItemsListing's provider selector).
 */
export function eligibleFilterProviders(
  providers: ProviderInstance[],
  userProviderFilter: string[],
): ProviderInstance[] {
  return providers.filter(
    (provider) =>
      provider.type === ProviderType.MUSIC &&
      (userProviderFilter.length === 0 ||
        userProviderFilter.includes(provider.instance_id)),
  );
}

/**
 * The `providers` argument to send the server for a row, given the providers
 * eligible for filtering and the ones the user hid: `undefined` (omit the
 * filter) when nothing is hidden, otherwise the allowed (non-hidden) ids --
 * an empty array if every eligible provider is hidden.
 */
export function resolveProviderFilterParam(
  eligibleProviderIds: string[],
  hiddenProviderIds: string[],
): string[] | undefined {
  if (hiddenProviderIds.length === 0) return undefined;
  const hidden = new Set(hiddenProviderIds);
  return eligibleProviderIds.filter((id) => !hidden.has(id));
}

/**
 * Whether a row's provider filter should be offered: the server marks the
 * folder as supporting it, and the row renders through the shelf rather than
 * the timeline layout, which has no filter control.
 */
export function rowSupportsProviderFilter(
  folder: RecommendationFolder,
): boolean {
  return (
    folder.supports_provider_filter &&
    folder.type !== RecommendationFolderType.TIMELINE
  );
}
