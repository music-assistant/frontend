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

// When right is a ShortcutItem, also matches by constructed MA URI so items
// whose uri is a non-MA URL (e.g. a podcast RSS <link> website) still match.
function isSameShortcutUri(
  left: string,
  right: string | ShortcutItem,
): boolean {
  const candidates: string[] =
    typeof right === "string"
      ? [right]
      : [
          `${right.provider}://${right.media_type}/${right.item_id}`,
          ...(right.uri ? [right.uri] : []),
        ];

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
    return identities.some(
      (identity) =>
        parsed.mediaType === identity.mediaType &&
        parsed.provider === identity.provider &&
        parsed.itemId === identity.itemId,
    );
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
      return !identities.some(
        (identity) =>
          parsed.mediaType === identity.mediaType &&
          parsed.provider === identity.provider &&
          parsed.itemId === identity.itemId,
      );
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
  const maUri = `${item.provider}://${item.media_type}/${item.item_id}`;
  if (uris.some((pinnedUri) => isSameShortcutUri(pinnedUri, maUri))) return;
  await setUserPreference(PREF_KEY, [...uris, maUri]);
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
    const maUri = `${item.provider}://${item.media_type}/${item.item_id}`;
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
      pinnedUris.value.filter((u) => u !== uri),
    );
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
        // rejected = network error — don't prune, the URI stays pinned
      });
    }
  });

  let _unsubscribe: (() => void) | undefined;

  onMounted(async () => {
    await loadShortcuts();

    _unsubscribe = api.subscribe_multi(
      [EventType.MEDIA_ITEM_DELETED, EventType.MEDIA_ITEM_UPDATED],
      (evt: EventMessage) => {
        if (evt.event === EventType.MEDIA_ITEM_DELETED) {
          if (isPinned(evt.object_id as string)) {
            unpinItem(evt.object_id as string);
          }
        } else if (evt.event === EventType.MEDIA_ITEM_UPDATED) {
          const idx = resolvedItems.value.findIndex((p) =>
            isSameShortcutUri(evt.object_id as string, p),
          );
          if (idx >= 0) {
            resolvedItems.value[idx] = evt.data as ShortcutItem;
          }
        }
      },
    );
  });

  onUnmounted(() => {
    _unsubscribe?.();
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
  };
}
