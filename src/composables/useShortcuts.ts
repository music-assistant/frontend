import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "@/plugins/api";
import type {
  Album,
  Artist,
  Audiobook,
  EventMessage,
  Genre,
  ItemMapping,
  MediaItemType,
  Playlist,
  Podcast,
  Radio,
  Track,
} from "@/plugins/api/interfaces";
import { EventType, MediaType } from "@/plugins/api/interfaces";
import { useUserPreferences } from "@/composables/userPreferences";
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

interface ParsedShortcutUri {
  provider: string;
  mediaType: string;
  itemId: string;
}

interface ShortcutIdentity {
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

function isSameShortcutUri(left: string, right: string): boolean {
  if (left === right) return true;
  const a = parseShortcutUri(left);
  const b = parseShortcutUri(right);
  if (!a || !b) return false;
  return (
    a.mediaType === b.mediaType &&
    a.provider === b.provider &&
    a.itemId === b.itemId
  );
}

function getShortcutIdentities(
  item: ShortcutItem | ItemMapping,
): ShortcutIdentity[] {
  const identities: ShortcutIdentity[] = [
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

async function _setPinnedUris(uris: string[]): Promise<void> {
  if (!store.currentUser) return;
  if (!store.currentUser.preferences) store.currentUser.preferences = {};
  const updated = { ...store.currentUser.preferences, [PREF_KEY]: uris };
  store.currentUser.preferences = updated;
  await api.updateUser(store.currentUser.user_id, { preferences: updated });
}

export function isShortcutPinned(uri: string): boolean {
  return _getPinnedUris().some((pinnedUri) =>
    isSameShortcutUri(pinnedUri, uri),
  );
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
  await _setPinnedUris(
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
  if (uris.some((pinnedUri) => isSameShortcutUri(pinnedUri, item.uri))) return;
  await _setPinnedUris([...uris, item.uri]);
}

export function useShortcuts() {
  const { getPreference, setPreference } = useUserPreferences();

  const pinnedUris = getPreference<string[]>(PREF_KEY, []);
  const resolvedItems = ref<ShortcutItem[]>([]);

  async function loadShortcuts() {
    const uris = pinnedUris.value;
    if (!uris.length) {
      resolvedItems.value = [];
      return;
    }

    const results: ShortcutItem[] = [];
    const validUris: string[] = [];

    for (const uri of uris) {
      try {
        const item = await api.getItemByUri(uri);
        if (item && SUPPORTED_TYPES.has(item.media_type)) {
          results.push(item as ShortcutItem);
          validUris.push(uri);
        }
      } catch {
        // Item no longer exists — will be pruned below
      }
    }

    resolvedItems.value = results;

    // Prune stale URIs from preferences
    if (validUris.length !== uris.length) {
      await setPreference(PREF_KEY, validUris);
    }
  }

  function isPinned(uri: string): boolean {
    return pinnedUris.value.includes(uri);
  }

  async function pinItem(item: ShortcutItem) {
    const uri = item.uri;
    if (isPinned(uri)) return;
    // Add immediately for instant sidebar feedback; watch won't re-add (already present)
    resolvedItems.value = [...resolvedItems.value, item];
    await setPreference(PREF_KEY, [...pinnedUris.value, uri]);
  }

  async function unpinItem(uri: string) {
    // Remove immediately; watch won't re-remove (already absent)
    resolvedItems.value = resolvedItems.value.filter((p) => p.uri !== uri);
    await setPreference(
      PREF_KEY,
      pinnedUris.value.filter((u) => u !== uri),
    );
  }

  // React to external changes (e.g. pinShortcutStandalone from the context menu)
  watch(pinnedUris, async (newUris) => {
    const currentUris = resolvedItems.value.map((p) => p.uri);

    // Remove items no longer in pinned list
    const toRemove = currentUris.filter((uri) => !newUris.includes(uri));
    if (toRemove.length > 0) {
      resolvedItems.value = resolvedItems.value.filter(
        (p) => !toRemove.includes(p.uri),
      );
    }

    // Fetch and add newly pinned items not yet resolved
    const toAdd = newUris.filter((uri) => !currentUris.includes(uri));
    for (const uri of toAdd) {
      try {
        const item = await api.getItemByUri(uri);
        if (item && SUPPORTED_TYPES.has(item.media_type)) {
          resolvedItems.value = [...resolvedItems.value, item as ShortcutItem];
        }
      } catch {
        // Stale URI — prune from preferences
        await setPreference(
          PREF_KEY,
          pinnedUris.value.filter((u) => u !== uri),
        );
      }
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
          const idx = resolvedItems.value.findIndex(
            (p) => p.uri === evt.object_id,
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
    pinnedItems: computed(() => resolvedItems.value),
    isPinned,
    pinItem,
    unpinItem,
  };
}
