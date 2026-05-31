import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "@/plugins/api";
import type {
  Album,
  Artist,
  Audiobook,
  EventMessage,
  Genre,
  ItemMapping,
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

export function isShortcutMediaType(mediaType: MediaType): boolean {
  return SUPPORTED_TYPES.has(mediaType);
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
  const identities = getShortcutIdentities(item);
  return _getPinnedUris().some((pinnedUri) => {
    const parsed = parseShortcutUri(pinnedUri);
    if (!parsed) return false;
    return hasShortcutIdentityMatch(parsed, identities);
  });
}

export async function unpinShortcutStandaloneItem(
  item: ShortcutItem | ItemMapping,
): Promise<void> {
  const identities = getShortcutIdentities(item);
  await setUserPreference(
    PREF_KEY,
    _getPinnedUris().filter((pinnedUri) => {
      const parsed = parseShortcutUri(pinnedUri);
      if (!parsed) return true;
      return !hasShortcutIdentityMatch(parsed, identities);
    }),
  );
}

export async function pinShortcutStandalone(
  item: ShortcutItem | ItemMapping,
): Promise<void> {
  if (!isShortcutMediaType(item.media_type)) return;
  const uris = _getPinnedUris();
  if (uris.length >= MAX_SHORTCUTS) return;
  // Always construct a proper MA URI from provider/media_type/item_id.
  // item.uri may be a non-MA URL (e.g. a podcast website link).
  const maUri = getShortcutUri(item);
  if (uris.some((pinnedUri) => isSameShortcutUri(pinnedUri, maUri))) return;
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

function findPinnedUriForItem(item: ShortcutItem | ItemMapping): string | null {
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
    // Always construct a proper MA URI from provider/media_type/item_id.
    // item.uri may be a non-MA URL (e.g. a podcast website link).
    const maUri = getShortcutUri(item);
    if (isPinned(maUri)) return;
    if (pinnedUris.value.length >= MAX_SHORTCUTS) return;
    // Add immediately for instant sidebar feedback; watch won't re-add (already present)
    resolvedItems.value = [...resolvedItems.value, item];
    await setPreference(PREF_KEY, [...pinnedUris.value, maUri]);
  }

  async function unpinItem(uri: string) {
    // Remove immediately; watch won't re-remove (already absent)
    resolvedItems.value = resolvedItems.value.filter(
      (p) => !isSameShortcutUri(uri, p),
    );
    await setPreference(
      PREF_KEY,
      pinnedUris.value.filter((u) => !isSameShortcutUri(u, uri)),
    );
  }

  async function reorderItems(
    sourceItem: ShortcutItem,
    targetItem: ShortcutItem,
  ) {
    const sourceUri = findPinnedUriByIdentities(
      getShortcutIdentities(sourceItem),
      pinnedUris.value,
    );
    const targetUri = findPinnedUriByIdentities(
      getShortcutIdentities(targetItem),
      pinnedUris.value,
    );
    if (!sourceUri || !targetUri) return;

    const nextUris = reorderShortcutUris(
      pinnedUris.value,
      sourceUri,
      targetUri,
    );
    if (!nextUris) return;

    // Keep local UI in sync immediately while preference update propagates.
    const fromItemIndex = resolvedItems.value.findIndex((item) =>
      isSameShortcutUri(sourceUri, item),
    );
    const toItemIndex = resolvedItems.value.findIndex((item) =>
      isSameShortcutUri(targetUri, item),
    );
    if (
      fromItemIndex >= 0 &&
      toItemIndex >= 0 &&
      fromItemIndex !== toItemIndex
    ) {
      const nextItems = [...resolvedItems.value];
      const [movedItem] = nextItems.splice(fromItemIndex, 1);
      nextItems.splice(toItemIndex, 0, movedItem);
      resolvedItems.value = nextItems;
    }

    await setPreference(PREF_KEY, nextUris);
  }

  // React to external changes (e.g. pinShortcutStandalone from the context menu)
  watch(pinnedUris, async (newUris) => {
    const currentItems = resolvedItems.value;

    // Remove items no longer in pinned list (smart URI matching avoids false removals
    // when API-returned URIs differ in encoding from stored preference URIs)
    resolvedItems.value = currentItems.filter((item) =>
      newUris.some((uri) => isSameShortcutUri(uri, item)),
    );

    // Fetch and add newly pinned items not yet resolved
    const toAdd = newUris.filter(
      (uri) => !currentItems.some((item) => isSameShortcutUri(uri, item)),
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

  onMounted(async () => {
    await loadShortcuts();

    _unsubscribeUpdated = api.subscribe(
      EventType.MEDIA_ITEM_UPDATED,
      (evt: EventMessage) => {
        const objectId = evt.object_id as string | undefined;
        if (!objectId) return;
        const idx = resolvedItems.value.findIndex((item) =>
          isSameShortcutUri(objectId, item),
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
    _unsubscribeUpdated?.();
  });

  return {
    // Derive display order from pinnedUris (insertion order) so that resolvedItems
    // being in any internal order doesn't cause sort-order regressions.
    pinnedItems: computed(() =>
      pinnedUris.value
        .map((uri) =>
          resolvedItems.value.find((item) => isSameShortcutUri(uri, item)),
        )
        .filter((item): item is ShortcutItem => item !== undefined),
    ),
    isLoading,
    pinnedCount: computed(() => pinnedUris.value.length),
    isPinned,
    pinItem,
    unpinItem,
    reorderItems,
  };
}
