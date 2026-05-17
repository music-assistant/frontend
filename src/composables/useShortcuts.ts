import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { api } from "@/plugins/api";
import type {
  Album,
  Artist,
  EventMessage,
  MediaItemType,
  Playlist,
  Radio,
  Track,
} from "@/plugins/api/interfaces";
import { EventType, MediaType } from "@/plugins/api/interfaces";
import { useUserPreferences } from "@/composables/userPreferences";
import { store } from "@/plugins/store";

export type ShortcutItem = Playlist | Artist | Album | Track | Radio;

const SUPPORTED_TYPES = new Set([
  MediaType.PLAYLIST,
  MediaType.ARTIST,
  MediaType.ALBUM,
  MediaType.TRACK,
  MediaType.RADIO,
]);

const PREF_KEY = "sidebar.shortcuts";

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
  return _getPinnedUris().includes(uri);
}

export async function pinShortcutStandalone(item: ShortcutItem): Promise<void> {
  const uris = _getPinnedUris();
  if (uris.includes(item.uri)) return;
  await _setPinnedUris([...uris, item.uri]);
}

export async function unpinShortcutStandalone(uri: string): Promise<void> {
  await _setPinnedUris(_getPinnedUris().filter((u) => u !== uri));
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
