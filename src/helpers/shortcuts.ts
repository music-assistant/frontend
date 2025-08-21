import { reactive } from "vue";
import { MediaType, MediaItem } from "@/plugins/api/interfaces";
import api from "@/plugins/api";

export interface Shortcut extends MediaItem {
  id: string;
  name: string;
  icon: string;
  itemType: MediaType;
  itemId: string;
  provider: string;
  uri: string;
}

// Reactive shortcuts store
export const shortcuts = reactive<Shortcut[]>(
  JSON.parse(localStorage.getItem('shortcuts') || '[]')
);

// Helper function to get icon for media type
function getIconForMediaType(type: MediaType): string {
  switch (type) {
    case MediaType.TRACK:
      return 'mdi-music-note';
    case MediaType.ALBUM:
      return 'mdi-album';
    case MediaType.ARTIST:
      return 'mdi-account-music';
    case MediaType.PLAYLIST:
      return 'mdi-playlist-music';
    case MediaType.RADIO:
      return 'mdi-radio';
    case MediaType.PODCAST:
      return 'mdi-podcast';
    case MediaType.AUDIOBOOK:
      return 'mdi-book-open-variant';
    default:
      return 'mdi-bookmark';
  }
}

// Helper function to save shortcuts to localStorage
function saveShortcuts() {
  localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
}

// Add a new shortcut
export async function addShortcut(item: MediaItem): Promise<void> {
  // Resolve a full item from library or provider to ensure images are present
  let fullItem: MediaItem = item;
  try {
    const fromLibrary = await api.getLibraryItem(item.media_type, item.item_id, item.provider);
    if (fromLibrary) fullItem = fromLibrary as MediaItem;
    if (!fullItem.metadata?.images || fullItem.metadata.images.length === 0) {
      const fromProvider = await api.getItem(item.media_type, item.item_id, item.provider);
      if (fromProvider) fullItem = fromProvider as MediaItem;
    }
    if (!fullItem.metadata?.images || fullItem.metadata.images.length === 0) {
      fullItem = (await api.updateMetadata(fullItem, true)) as MediaItem;
    }
  } catch (err) {
    // ignore resolution errors; we'll fallback to the provided item
    fullItem = item;
  }

  const completeItem = { ...fullItem } as any;
  if ('album' in fullItem) completeItem.album = (fullItem as any).album;
  if ('artists' in fullItem) completeItem.artists = (fullItem as any).artists;

  const shortcut: Shortcut = {
    ...completeItem,
    id: `${item.media_type}-${item.item_id}`,
    name: item.name,
    icon: getIconForMediaType(item.media_type),
    itemType: item.media_type,
    itemId: item.item_id,
    provider: item.provider,
    uri: item.uri
  };

  if (!shortcuts.some(s => s.id === shortcut.id)) {
    shortcuts.push(shortcut);
    saveShortcuts();
  }
}

// Remove a shortcut
export function removeShortcut(id: string): void {
  const index = shortcuts.findIndex(s => s.id === id);
  if (index !== -1) {
    shortcuts.splice(index, 1);
    saveShortcuts();
  }
}

// Hydrate shortcuts with missing images
export async function hydrateShortcutsImages(): Promise<void> {
  try {
    for (let i = 0; i < shortcuts.length; i++) {
      const sc = shortcuts[i] as any;
      const hasImages = sc?.metadata?.images && sc.metadata.images.length > 0;
      if (hasImages) continue;
      try {
        let fullItem = (await api.getLibraryItem(sc.media_type || sc.itemType, sc.item_id || sc.itemId, sc.provider)) as any;
        if (!fullItem) {
          fullItem = (await api.getItem(sc.media_type || sc.itemType, sc.item_id || sc.itemId, sc.provider)) as any;
        }
        if (fullItem && (!fullItem.metadata?.images || fullItem.metadata.images.length === 0)) {
          fullItem = (await api.updateMetadata(fullItem, true)) as any;
        }
        if (fullItem) {
          const merged = { ...sc, ...fullItem };
          // preserve shortcut fields
          merged.id = sc.id;
          merged.itemType = sc.itemType || fullItem.media_type;
          merged.itemId = sc.itemId || fullItem.item_id;
          merged.provider = sc.provider || fullItem.provider;
          merged.uri = sc.uri || fullItem.uri;
          shortcuts[i] = merged;
        }
      } catch (_e) {
        // ignore per-item failures
      }
    }
    localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
  } catch (_err) {
    // ignore
  }
}

// Check if an item is already in shortcuts
export function isInShortcuts(mediaType: MediaType, itemId: string): boolean {
  return shortcuts.some(s => s.id === `${mediaType}-${itemId}`);
}

// Get shortcuts filtered by media type
export function getShortcutsByType(type: MediaType): Shortcut[] {
  return shortcuts.filter(shortcut => shortcut.itemType === type);
}

// Clear all shortcuts
export function clearShortcuts(): void {
  shortcuts.splice(0, shortcuts.length);
  saveShortcuts();
}