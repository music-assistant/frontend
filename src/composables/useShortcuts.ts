import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "@/plugins/api";
import type {
  Album,
  Artist,
  Audiobook,
  EventMessage,
  Genre,
  ItemMapping,
  MediaItemTypeOrItemMapping,
  Playlist,
  Podcast,
  Radio,
  Track,
} from "@/plugins/api/interfaces";
import { EventType, MediaType } from "@/plugins/api/interfaces";
import {
  useUserPreferences,
  setUserPreference,
} from "@/composables/userPreferences";
import { store } from "@/plugins/store";

export type ShortcutItem =
  | Playlist
  | Artist
  | Album
  | Track
  | Radio
  | Podcast
  | Audiobook
  | Genre;

const SUPPORTED_TYPES = new Set([
  MediaType.PLAYLIST,
  MediaType.ARTIST,
  MediaType.ALBUM,
  MediaType.TRACK,
  MediaType.RADIO,
  MediaType.PODCAST,
  MediaType.AUDIOBOOK,
  MediaType.GENRE,
]);

const PREF_KEY = "sidebar.shortcuts";
export const MAX_SHORTCUTS = 50;

interface ParsedShortcutUri {
  provider: string;
  mediaType: string;
  itemId: string;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseShortcutUri(uri: string): ParsedShortcutUri | null {
  const sepIdx = uri.indexOf("://");
  if (sepIdx < 0) return null;
  const provider = safeDecode(uri.slice(0, sepIdx));
  const rest = uri.slice(sepIdx + 3);
  const slashIdx = rest.indexOf("/");
  if (slashIdx < 0) return null;
  const mediaType = safeDecode(rest.slice(0, slashIdx));
  return {
    provider,
    mediaType,
    itemId: safeDecode(rest.slice(slashIdx + 1)),
  };
}

export function getShortcutUri(item: ShortcutItem | ItemMapping): string {
  return `${item.provider}://${item.media_type}/${item.item_id}`;
}

// When right is a ShortcutItem, also matches by constructed MA URI so items
// whose uri is a non-MA URL (e.g. a podcast RSS <link> website) still match.
function isSameShortcutUri(
  left: string,
  right: string | ShortcutItem,
): boolean {
  const candidates: string[] =
    typeof right === "string"
      ? [right]
      : [getShortcutUri(right), ...(right.uri ? [right.uri] : [])];

  const a = parseShortcutUri(left);
  for (const candidate of candidates) {
    if (left === candidate) return true;
    if (!a) continue;
    const b = parseShortcutUri(candidate);
    if (
      b &&
      a.mediaType === b.mediaType &&
      a.provider === b.provider &&
      a.itemId === b.itemId
    )
      return true;
  }
  return false;
}

function getShortcutIdentities(
  item: ShortcutItem | ItemMapping,
): ParsedShortcutUri[] {
  const identities: ParsedShortcutUri[] = [
    {
      provider: safeDecode(item.provider),
      mediaType: item.media_type,
      itemId: safeDecode(item.item_id),
    },
  ];

  // Also match the provider domain form for instance-based provider ids.
  const baseProvider = safeDecode(item.provider.split("--")[0]);
  if (baseProvider && baseProvider !== safeDecode(item.provider)) {
    identities.push({
      provider: baseProvider,
      mediaType: item.media_type,
      itemId: safeDecode(item.item_id),
    });
  }

  if ("provider_mappings" in item && Array.isArray(item.provider_mappings)) {
    for (const mapping of item.provider_mappings) {
      identities.push({
        provider: safeDecode(mapping.provider_instance),
        mediaType: item.media_type,
        itemId: safeDecode(mapping.item_id),
      });
      // Some URIs store provider domain instead of provider instance.
      identities.push({
        provider: safeDecode(mapping.provider_domain),
        mediaType: item.media_type,
        itemId: safeDecode(mapping.item_id),
      });
    }
  }

  return identities;
}

function hasShortcutIdentityMatch(
  parsedUri: ParsedShortcutUri,
  identities: ParsedShortcutUri[],
): boolean {
  return identities.some(
    (identity) =>
      parsedUri.mediaType === identity.mediaType &&
      parsedUri.provider === identity.provider &&
      parsedUri.itemId === identity.itemId,
  );
}

function isUriMatchingItem(
  uri: string,
  item: ShortcutItem | ItemMapping,
): boolean {
  const parsed = parseShortcutUri(uri);
  if (!parsed) return false;
  const identities = getShortcutIdentities(item);
  return hasShortcutIdentityMatch(parsed, identities);
}

function findPinnedUriByIdentities(
  identities: ParsedShortcutUri[],
  pinnedUris: string[],
): string | null {
  for (const pinnedUri of pinnedUris) {
    const parsed = parseShortcutUri(pinnedUri);
    if (!parsed) continue;
    if (hasShortcutIdentityMatch(parsed, identities)) {
      return pinnedUri;
    }
  }
  return null;
}

/**
 * Type guard for items that can be pinned as a sidebar shortcut.
 */
export function isShortcutItem(
  item: MediaItemTypeOrItemMapping,
): item is ShortcutItem | ItemMapping {
  return SUPPORTED_TYPES.has(item.media_type);
}

// ---------------------------------------------------------------------------
// Standalone helpers — usable outside Vue component setup (e.g. context menus)
// ---------------------------------------------------------------------------

function _getPinnedUris(): string[] {
  return (store.currentUser?.preferences?.[PREF_KEY] as string[]) ?? [];
}

export function isShortcutPinned(uri: string): boolean {
  return _getPinnedUris().some((pinnedUri) =>
    isSameShortcutUri(pinnedUri, uri),
  );
}

export function isShortcutCapReached(): boolean {
  return _getPinnedUris().length >= MAX_SHORTCUTS;
}

export function isShortcutPinnedItem(
  item: ShortcutItem | ItemMapping,
): boolean {
  return _getPinnedUris().some((pinnedUri) =>
    isUriMatchingItem(pinnedUri, item),
  );
}

export async function unpinShortcutStandaloneItem(
  item: ShortcutItem | ItemMapping,
): Promise<void> {
  await setUserPreference(
    PREF_KEY,
    _getPinnedUris().filter((pinnedUri) => !isUriMatchingItem(pinnedUri, item)),
  );
}

export async function pinShortcutStandalone(
  item: ShortcutItem | ItemMapping,
): Promise<void> {
  if (!isShortcutItem(item)) return;
  const uris = _getPinnedUris();
  if (uris.length >= MAX_SHORTCUTS) return;
  if (uris.some((pinnedUri) => isUriMatchingItem(pinnedUri, item))) return;
  const maUri = getShortcutUri(item);
  await setUserPreference(PREF_KEY, [...uris, maUri]);
}

let _globalShortcutsSyncInitialized = false;

async function removePinnedUriIfPresent(uri: string): Promise<void> {
  const currentUris = _getPinnedUris();
  const nextUris = currentUris.filter((u) => !isSameShortcutUri(u, uri));
  if (nextUris.length !== currentUris.length) {
    await setUserPreference(PREF_KEY, nextUris);
  }
}

export function initGlobalShortcutsSync(): void {
  if (_globalShortcutsSyncInitialized) return;
  _globalShortcutsSyncInitialized = true;

  api.subscribe(EventType.MEDIA_ITEM_DELETED, (evt: EventMessage) => {
    // Keep sidebar preferences clean even when nav components are unmounted.
    void removePinnedUriIfPresent(evt.object_id as string);
  });
}

function reorderShortcutUris(
  uris: string[],
  sourceUri: string,
  targetUri: string,
): string[] | null {
  const fromIndex = uris.findIndex((uri) => isSameShortcutUri(uri, sourceUri));
  const toIndex = uris.findIndex((uri) => isSameShortcutUri(uri, targetUri));
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return null;
  }
  const nextUris = [...uris];
  const [movedUri] = nextUris.splice(fromIndex, 1);
  nextUris.splice(toIndex, 0, movedUri);
  return nextUris;
}

export async function reorderShortcutStandalone(
  sourceUri: string,
  targetUri: string,
): Promise<void> {
  const currentUris = _getPinnedUris();
  const nextUris = reorderShortcutUris(currentUris, sourceUri, targetUri);
  if (!nextUris) return;
  await setUserPreference(PREF_KEY, nextUris);
}

export function findPinnedUriForItem(
  item: ShortcutItem | ItemMapping,
): string | null {
  const identities = getShortcutIdentities(item);
  return findPinnedUriByIdentities(identities, _getPinnedUris());
}

export function getShortcutMoveAvailability(item: ShortcutItem | ItemMapping): {
  canMoveUp: boolean;
  canMoveDown: boolean;
} {
  const uris = _getPinnedUris();
  const uri = findPinnedUriForItem(item);
  if (!uri) return { canMoveUp: false, canMoveDown: false };
  const index = uris.findIndex((pinnedUri) =>
    isSameShortcutUri(pinnedUri, uri),
  );
  if (index < 0) return { canMoveUp: false, canMoveDown: false };
  return {
    canMoveUp: index > 0,
    canMoveDown: index < uris.length - 1,
  };
}

export async function moveShortcutStandaloneItem(
  item: ShortcutItem | ItemMapping,
  direction: "up" | "down",
): Promise<void> {
  const uris = _getPinnedUris();
  const uri = findPinnedUriForItem(item);
  if (!uri) return;

  const index = uris.findIndex((pinnedUri) =>
    isSameShortcutUri(pinnedUri, uri),
  );
  if (index < 0) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= uris.length) return;

  await reorderShortcutStandalone(uri, uris[targetIndex]);
}

export function useShortcuts() {
  const { getPreference, setPreference } = useUserPreferences();

  const pinnedUris = getPreference<string[]>(PREF_KEY, []);
  const resolvedItems = ref<ShortcutItem[]>([]);
  // true whenever pinnedUris is non-empty but resolvedItems hasn't been populated yet
  const isLoading = ref(pinnedUris.value.length > 0);

  async function loadShortcuts() {
    const uris = pinnedUris.value;
    if (!uris.length) {
      resolvedItems.value = [];
      isLoading.value = false;
      return;
    }

    const results: ShortcutItem[] = [];
    const prunedUris: string[] = [];

    const settled = await Promise.allSettled(
      uris.map((uri) => api.getItemByUri(uri)),
    );
    settled.forEach((result, i) => {
      const uri = uris[i];
      if (result.status === "fulfilled") {
        const item = result.value;
        if (item && SUPPORTED_TYPES.has(item.media_type)) {
          results.push(item as ShortcutItem);
        } else {
          // Item explicitly gone (null / unsupported type) — prune.
          prunedUris.push(uri);
        }
      }
      // rejected = network/transport error — keep URI pinned, don't prune.
    });

    resolvedItems.value = results;
    isLoading.value = false;

    // Prune stale URIs from preferences using the current reactive value so that
    // any items pinned during the async fetch are not lost.
    if (prunedUris.length > 0) {
      await setPreference(
        PREF_KEY,
        pinnedUris.value.filter((u) => !prunedUris.includes(u)),
      );
    }
  }

  function isPinned(uri: string): boolean {
    return pinnedUris.value.some((pinnedUri) =>
      isSameShortcutUri(pinnedUri, uri),
    );
  }

  async function pinItem(item: ShortcutItem) {
    const maUri = getShortcutUri(item);
    const alreadyPinned = pinnedUris.value.some((pinnedUri) =>
      isUriMatchingItem(pinnedUri, item),
    );
    if (alreadyPinned) return;
    if (pinnedUris.value.length >= MAX_SHORTCUTS) return;
    // Add immediately for instant sidebar feedback; watch won't re-add (already present)
    resolvedItems.value = [...resolvedItems.value, item];
    await setPreference(PREF_KEY, [...pinnedUris.value, maUri]);
  }

  async function unpinItem(uri: string) {
    resolvedItems.value = resolvedItems.value.filter(
      (item) => !isUriMatchingItem(uri, item),
    );
    await setPreference(
      PREF_KEY,
      pinnedUris.value.filter((u) => !isSameShortcutUri(u, uri)),
    );
  }

  // React to external changes (e.g. pinShortcutStandalone from the context menu)
  watch(pinnedUris, async (newUris) => {
    const currentItems = resolvedItems.value;

    // Remove items no longer in pinned list
    resolvedItems.value = currentItems.filter((item) =>
      newUris.some((uri) => isUriMatchingItem(uri, item)),
    );

    // Fetch and add newly pinned items not yet resolved
    const toAdd = newUris.filter(
      (uri) => !currentItems.some((item) => isUriMatchingItem(uri, item)),
    );
    if (toAdd.length > 0) {
      const settled = await Promise.allSettled(
        toAdd.map((uri) => api.getItemByUri(uri)),
      );
      settled.forEach((result) => {
        if (
          result.status === "fulfilled" &&
          result.value &&
          SUPPORTED_TYPES.has(result.value.media_type)
        ) {
          resolvedItems.value = [
            ...resolvedItems.value,
            result.value as ShortcutItem,
          ];
        }
        // rejected = network/backend error — don't mutate pinned URIs here.
      });
    }
  });

  let _unsubscribeUpdated: (() => void) | undefined;
  let unmounted = false;

  onMounted(async () => {
    await loadShortcuts();
    // The load can outlast the component, and the cleanup hook has already run
    // by then with nothing to unsubscribe.
    if (unmounted) return;

    _unsubscribeUpdated = api.subscribe(
      EventType.MEDIA_ITEM_UPDATED,
      (evt: EventMessage) => {
        const objectId = evt.object_id as string | undefined;
        if (!objectId) return;

        const idx = resolvedItems.value.findIndex((item) =>
          isUriMatchingItem(objectId, item),
        );
        if (
          idx >= 0 &&
          evt.data &&
          SUPPORTED_TYPES.has((evt.data as ShortcutItem).media_type)
        ) {
          resolvedItems.value[idx] = evt.data as ShortcutItem;
        }
      },
    );
  });

  onUnmounted(() => {
    unmounted = true;
    _unsubscribeUpdated?.();
  });

  return {
    // Derive display order from pinnedUris (insertion order) so that resolvedItems
    // being in any internal order doesn't cause sort-order regressions.
    pinnedItems: computed(() => {
      const seen = new Set<ShortcutItem>();
      return pinnedUris.value
        .map((uri) =>
          resolvedItems.value.find((item) => isUriMatchingItem(uri, item)),
        )
        .filter((item): item is ShortcutItem => {
          if (!item || seen.has(item)) return false;
          seen.add(item);
          return true;
        });
    }),
    isLoading,
    pinnedCount: computed(() => pinnedUris.value.length),
    isPinned,
    pinItem,
    unpinItem,
  };
}
