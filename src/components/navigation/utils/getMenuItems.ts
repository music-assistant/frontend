import ArtistIcon from "@/components/icons/ArtistIcon.vue";
import { DEFAULT_MENU_ITEMS } from "@/constants";
import { store } from "@/plugins/store";
import {
  BookAudio,
  Disc3,
  Folder,
  House,
  ListMusic,
  Music2,
  Podcast,
  Radio,
  Search,
  Settings,
  Tag,
} from "lucide-vue-next";
import { Component } from "vue";

export interface MenuItem {
  label: string;
  icon: Component;
  path: string;
  isLibraryNode: boolean;
  hidden?: boolean;
}

export const getMenuItems = function () {
  // TODO: Remove localStorage fallback once migration period is over (menu_items moved to user preferences)
  // Check user preferences first, then fall back to per-item localStorage keys
  const userMenuItems = store.currentUser?.preferences?.menu_items;

  let enabledItems: string[];
  if (userMenuItems) {
    // If user preferences has menu_items, use it (it could be array or comma-separated string)
    enabledItems = Array.isArray(userMenuItems)
      ? userMenuItems
      : userMenuItems.split(",");
  } else {
    // Fallback to per-item localStorage keys (main branch approach)
    enabledItems = DEFAULT_MENU_ITEMS.filter(
      (item) =>
        localStorage.getItem(
          `frontend.settings.menu_item_${item}_enabled`,
        ) !== "false",
    );
  }

  const items: MenuItem[] = [];
  // we loop through enabledItems to respect user's selection
  for (const enabledMenuItemStr of enabledItems) {
    if (enabledMenuItemStr === "home") {
      items.push({
        label: "home",
        icon: House,
        path: "/home",
        isLibraryNode: false,
      });
    }
    if (enabledMenuItemStr === "search") {
      items.push({
        label: "search",
        icon: Search,
        path: "/search",
        isLibraryNode: false,
      });
    }
    if (enabledMenuItemStr === "artists") {
      items.push({
        label: "artists",
        icon: ArtistIcon,
        path: "/artists",
        isLibraryNode: true,
        hidden: store.libraryArtistsCount === 0,
      });
    }
    if (enabledMenuItemStr === "albums") {
      items.push({
        label: "albums",
        icon: Disc3,
        path: "/albums",
        isLibraryNode: true,
        hidden: store.libraryAlbumsCount === 0,
      });
    }
    if (enabledMenuItemStr === "tracks") {
      items.push({
        label: "tracks",
        icon: Music2,
        path: "/tracks",
        isLibraryNode: true,
        hidden: store.libraryTracksCount === 0,
      });
    }
    if (enabledMenuItemStr === "playlists") {
      items.push({
        label: "playlists",
        icon: ListMusic,
        path: "/playlists",
        isLibraryNode: true,
        hidden: store.libraryPlaylistsCount === 0,
      });
    }
    if (enabledMenuItemStr === "audiobooks") {
      items.push({
        label: "audiobooks",
        icon: BookAudio,
        path: "/audiobooks",
        isLibraryNode: true,
        hidden: store.libraryAudiobooksCount === 0,
      });
    }
    if (enabledMenuItemStr === "podcasts") {
      items.push({
        label: "podcasts",
        icon: Podcast,
        path: "/podcasts",
        isLibraryNode: true,
        hidden: store.libraryPodcastsCount === 0,
      });
    }
    if (enabledMenuItemStr === "radios") {
      items.push({
        label: "radios",
        icon: Radio,
        path: "/radios",
        isLibraryNode: true,
        hidden: store.libraryRadiosCount === 0,
      });
    }
    if (enabledMenuItemStr === "genres") {
      items.push({
        label: "genres",
        icon: Tag,
        path: "/genres",
        isLibraryNode: true,
        hidden: store.libraryGenresCount === 0,
      });
    }
    if (enabledMenuItemStr === "browse") {
      items.push({
        label: "browse",
        icon: Folder,
        path: "/browse",
        isLibraryNode: true,
      });
    }
    if (enabledMenuItemStr === "settings") {
      items.push({
        label: "settings.settings",
        icon: Settings,
        path: "/settings",
        isLibraryNode: true,
      });
    }
  }
  return items;
};
