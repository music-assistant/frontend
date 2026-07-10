import ArtistIcon from "@/components/icons/ArtistIcon.vue";
import GenreIcon from "@/components/icons/GenreIcon.vue";
import MusicQuizIcon from "@/components/icons/MusicQuizIcon.vue";
import { setUserPreference } from "@/composables/userPreferences";
import {
  DEFAULT_MENU_ITEMS,
  MENU_ITEMS_SEEN_PREFERENCE_KEY,
  PLUGIN_MENU_ITEMS,
} from "@/constants";
import { store } from "@/plugins/store";
import {
  BookAudio,
  Compass,
  Disc3,
  Folder,
  ListMusic,
  Music2,
  PartyPopper,
  Podcast,
  Radio,
  Search,
  Settings,
} from "@lucide/vue";
import { Component } from "vue";

export type MenuGroup = "explore" | "library" | "system";

// Sections that can be customized (renamed / label hidden) in menu edit mode.
export type MenuSectionId = MenuGroup | "shortcuts";

export interface MenuItem {
  id: string;
  label: string;
  icon: Component;
  path: string;
  isLibraryNode: boolean;
  group: MenuGroup;
  // User opted out of this item via menu edit mode.
  hidden: boolean;
  disabled?: boolean;
}

export interface MenuSectionConfig {
  // Custom (plain text) section label; falls back to the translated default.
  label?: string;
  // Hide the section header row (items remain visible).
  hide_label?: boolean;
}

// Per-user menu customization, stored as a single preference object.
// Visibility is an opt-out list: items are visible by default, so newly
// added menu items (e.g. from a new plugin) show up automatically.
export interface MenuConfig {
  hidden?: string[];
  order?: string[];
  sections?: Partial<Record<MenuSectionId, MenuSectionConfig>>;
}

export interface ResolvedMenuConfig {
  hidden: Set<string>;
  // Full order: contains every known menu item id exactly once.
  order: string[];
  sections: Partial<Record<MenuSectionId, MenuSectionConfig>>;
}

export const MENU_PREFERENCE_KEY = "sidebar.menu";

const MENU_ITEMS_STORAGE_KEY = "frontend.settings.menu_items";
const MENU_ITEMS_SEEN_STORAGE_KEY = "frontend.settings.menu_items_seen";
const pluginMenuItems = new Set(PLUGIN_MENU_ITEMS);

interface MenuItemDefinition {
  id: string;
  label: string;
  icon: Component;
  path: string;
  isLibraryNode: boolean;
  group: MenuGroup;
  // Runtime availability (e.g. plugin enabled); unavailable items are never
  // rendered, not even in edit mode.
  available?: () => boolean;
  disabled?: () => boolean;
}

// Registry order is the default menu order (matches DEFAULT_MENU_ITEMS).
const MENU_ITEM_REGISTRY: MenuItemDefinition[] = [
  {
    id: "discover",
    label: "discover",
    icon: Compass,
    path: "/discover",
    isLibraryNode: false,
    group: "explore",
  },
  {
    id: "search",
    label: "search",
    icon: Search,
    path: "/search",
    isLibraryNode: false,
    group: "explore",
  },
  {
    id: "browse",
    label: "browse",
    icon: Folder,
    path: "/browse",
    isLibraryNode: true,
    group: "explore",
  },
  {
    id: "party",
    label: "party_mode",
    icon: PartyPopper,
    path: "/party",
    isLibraryNode: false,
    group: "explore",
    available: () => store.enabledPlugins.has("party"),
  },
  {
    id: "music_quiz",
    label: "providers.music_quiz.title",
    icon: MusicQuizIcon,
    path: "/music-quiz",
    isLibraryNode: false,
    group: "explore",
    available: () => store.enabledPlugins.has("music_quiz"),
  },
  {
    id: "artists",
    label: "artists",
    icon: ArtistIcon,
    path: "/artists",
    isLibraryNode: true,
    group: "library",
  },
  {
    id: "albums",
    label: "albums",
    icon: Disc3,
    path: "/albums",
    isLibraryNode: true,
    group: "library",
  },
  {
    id: "tracks",
    label: "tracks",
    icon: Music2,
    path: "/tracks",
    isLibraryNode: true,
    group: "library",
  },
  {
    id: "playlists",
    label: "playlists",
    icon: ListMusic,
    path: "/playlists",
    isLibraryNode: true,
    group: "library",
  },
  {
    id: "audiobooks",
    label: "audiobooks",
    icon: BookAudio,
    path: "/audiobooks",
    isLibraryNode: true,
    group: "library",
    disabled: () => store.libraryAudiobooksCount === 0,
  },
  {
    id: "podcasts",
    label: "podcasts",
    icon: Podcast,
    path: "/podcasts",
    isLibraryNode: true,
    group: "library",
    disabled: () => store.libraryPodcastsCount === 0,
  },
  {
    id: "radios",
    label: "radios",
    icon: Radio,
    path: "/radios",
    isLibraryNode: true,
    group: "library",
  },
  {
    id: "genres",
    label: "genres",
    icon: GenreIcon,
    path: "/genres",
    isLibraryNode: true,
    group: "library",
  },
  {
    id: "settings",
    label: "settings.settings",
    icon: Settings,
    path: "/settings",
    isLibraryNode: true,
    group: "system",
  },
];

/**
 * All menu items in the user's order, with per-item state resolved.
 * Runtime-unavailable items (plugin not enabled) are excluded entirely;
 * user-hidden items are included with `hidden: true` so edit mode can
 * offer them back.
 */
export const getMenuItems = function (): MenuItem[] {
  const { hidden, order } = resolveMenuConfig();
  const definitions = new Map(MENU_ITEM_REGISTRY.map((def) => [def.id, def]));
  const items: MenuItem[] = [];
  for (const id of order) {
    const def = definitions.get(id);
    if (!def) continue;
    if (def.available && !def.available()) continue;
    items.push({
      id: def.id,
      label: def.label,
      icon: def.icon,
      path: def.path,
      isLibraryNode: def.isLibraryNode,
      group: def.group,
      hidden: hidden.has(id),
      disabled: def.disabled?.() || undefined,
    });
  }
  return items;
};

/**
 * The effective menu configuration for the current user.
 * Reads the `sidebar.menu` preference; when absent, derives the hidden list
 * from the legacy whitelist preferences (menu_items / menu_items_seen)
 * without writing anything — the first edit materializes the new format.
 */
export function resolveMenuConfig(): ResolvedMenuConfig {
  const knownIds = MENU_ITEM_REGISTRY.map((def) => def.id);
  const pref = store.currentUser?.preferences?.[MENU_PREFERENCE_KEY] as
    | MenuConfig
    | undefined;
  if (pref && typeof pref === "object") {
    const known = new Set(knownIds);
    const hidden = new Set(
      (Array.isArray(pref.hidden) ? pref.hidden : []).filter((id) =>
        known.has(id),
      ),
    );
    const order = mergeOrder(
      Array.isArray(pref.order) ? pref.order : [],
      knownIds,
    );
    const sections =
      pref.sections && typeof pref.sections === "object" ? pref.sections : {};
    return { hidden, order, sections };
  }
  return { hidden: legacyHiddenItems(), order: [...knownIds], sections: {} };
}

/** Resolved config for a single section. */
export function getMenuSectionConfig(
  section: MenuSectionId,
): MenuSectionConfig {
  return resolveMenuConfig().sections[section] ?? {};
}

/** Hide or unhide a single menu item. */
export async function setMenuItemHidden(
  id: string,
  hidden: boolean,
): Promise<void> {
  const cfg = resolveMenuConfig();
  if (hidden) cfg.hidden.add(id);
  else cfg.hidden.delete(id);
  await writeMenuConfig(cfg);
}

/**
 * Reorder a subset of menu items (typically one section's rendered items).
 * The given ids are rearranged within the positions they already occupy in
 * the full order; all other items keep their exact slots.
 */
export async function setMenuItemsOrder(orderedIds: string[]): Promise<void> {
  const cfg = resolveMenuConfig();
  const moving = new Set(orderedIds);
  if (moving.size !== orderedIds.length) return;
  const queue = [...orderedIds];
  const nextOrder = cfg.order.map((id) =>
    moving.has(id) ? queue.shift()! : id,
  );
  // Every given id must already exist in the full order.
  if (queue.length > 0) return;
  cfg.order = nextOrder;
  await writeMenuConfig(cfg);
}

/** Merge a partial section config (custom label / hidden label) and persist. */
export async function updateMenuSectionConfig(
  section: MenuSectionId,
  patch: MenuSectionConfig,
): Promise<void> {
  const cfg = resolveMenuConfig();
  const merged: MenuSectionConfig = { ...cfg.sections[section], ...patch };
  const clean: MenuSectionConfig = {};
  const label = merged.label?.trim();
  if (label) clean.label = label;
  if (merged.hide_label) clean.hide_label = true;
  const sections = { ...cfg.sections };
  if (Object.keys(clean).length > 0) sections[section] = clean;
  else delete sections[section];
  cfg.sections = sections;
  await writeMenuConfig(cfg);
}

async function writeMenuConfig(cfg: ResolvedMenuConfig): Promise<void> {
  const pref: MenuConfig = {
    hidden: [...cfg.hidden],
    order: cfg.order,
    sections: cfg.sections,
  };
  await setUserPreference(MENU_PREFERENCE_KEY, pref);
}

/**
 * Merge the user's saved order with the known ids: drop stale ids, then give
 * every id the user hasn't ordered yet (newly added menu items) its default
 * position — right after its nearest preceding default sibling.
 */
function mergeOrder(userOrder: string[], knownIds: string[]): string[] {
  const known = new Set(knownIds);
  const order = userOrder.filter(
    (id, index) => known.has(id) && userOrder.indexOf(id) === index,
  );
  for (let i = 0; i < knownIds.length; i++) {
    const id = knownIds[i];
    if (order.includes(id)) continue;
    let insertAt = 0;
    for (let j = i - 1; j >= 0; j--) {
      const prevIndex = order.indexOf(knownIds[j]);
      if (prevIndex >= 0) {
        insertAt = prevIndex + 1;
        break;
      }
    }
    order.splice(insertAt, 0, id);
  }
  return order;
}

function parseMenuItemsPreference(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : value.split(",");
}

/**
 * Derive the opt-out list from the legacy whitelist model: an item is hidden
 * when it was not in the enabled list but had been seen by the user (the old
 * "seen" mechanism kept newly added defaults visible despite the whitelist).
 */
function legacyHiddenItems(): Set<string> {
  // TODO: Remove localStorage fallback once migration period is over (menu_items moved to user preferences)
  const userMenuItems = store.currentUser?.preferences?.menu_items as
    | string
    | string[]
    | undefined;
  const storedMenuConf = localStorage.getItem(MENU_ITEMS_STORAGE_KEY);

  let enabledItems: string[];
  if (userMenuItems !== undefined && userMenuItems !== null) {
    enabledItems = parseMenuItemsPreference(userMenuItems);
  } else if (storedMenuConf) {
    enabledItems = storedMenuConf.split(",");
  } else {
    // No legacy customization at all: everything visible.
    return new Set();
  }

  const enabled = new Set(enabledItems);
  // Foolproof guard: a whitelist that matches none of the standard items is
  // stale or malformed (empty value, ids from another frontend version,
  // double-encoded json, ...). Deriving from it would hide the entire menu,
  // so ignore it and show the defaults instead — with the opt-out model the
  // safe failure is showing too much, never locking the user out.
  if (
    !DEFAULT_MENU_ITEMS.some(
      (id) => !pluginMenuItems.has(id) && enabled.has(id),
    )
  ) {
    console.warn(
      "Ignoring legacy menu_items preference (no recognized menu items):",
      JSON.stringify(userMenuItems ?? storedMenuConf),
    );
    return new Set();
  }

  const seen = getSeenMenuItems(enabledItems);
  const hidden = new Set<string>();
  for (const id of DEFAULT_MENU_ITEMS) {
    if (!enabled.has(id) && seen.has(id)) hidden.add(id);
  }
  return hidden;
}

function getSeenMenuItems(enabledItems: string[]): Set<string> {
  const userSeenMenuItems = parseMenuItemsPreference(
    store.currentUser?.preferences?.[MENU_ITEMS_SEEN_PREFERENCE_KEY] as
      | string
      | string[]
      | undefined,
  );
  if (userSeenMenuItems.length > 0) {
    return new Set(userSeenMenuItems);
  }

  const storedSeenMenuItems = parseMenuItemsPreference(
    localStorage.getItem(MENU_ITEMS_SEEN_STORAGE_KEY) ?? undefined,
  );
  if (storedSeenMenuItems.length > 0) {
    return new Set(storedSeenMenuItems);
  }

  const seededSeenItems = new Set(enabledItems);
  for (const menuItem of DEFAULT_MENU_ITEMS) {
    if (!pluginMenuItems.has(menuItem)) {
      seededSeenItems.add(menuItem);
    }
  }
  return seededSeenItems;
}
