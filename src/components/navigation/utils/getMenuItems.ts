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
  Compass,
} from "lucide-vue-next";
import { Component } from "vue";

export interface MenuItem {
  label: string;
  icon: Component;
  path: string;
  isLibraryNode: boolean;
  hidden?: boolean;
  disabled?: boolean;
}

export const getMenuItems = function () {
  const items: MenuItem[] = [];
  // we loop through DEFAULT_MENU_ITEMS to respect default order;
  // new items added to DEFAULT_MENU_ITEMS automatically appear unless explicitly disabled
  for (const enabledMenuItemStr of DEFAULT_MENU_ITEMS) {
    if (
      localStorage.getItem(
        `frontend.settings.menu_item_${enabledMenuItemStr}_enabled`,
      ) === "false"
    )
      continue;
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
      });
    }
    if (enabledMenuItemStr === "albums") {
      items.push({
        label: "albums",
        icon: Disc3,
        path: "/albums",
        isLibraryNode: true,
      });
    }
    if (enabledMenuItemStr === "tracks") {
      items.push({
        label: "tracks",
        icon: Music2,
        path: "/tracks",
        isLibraryNode: true,
      });
    }
    if (enabledMenuItemStr === "playlists") {
      items.push({
        label: "playlists",
        icon: ListMusic,
        path: "/playlists",
        isLibraryNode: true,
      });
    }
    if (enabledMenuItemStr === "audiobooks") {
      items.push({
        label: "audiobooks",
        icon: BookAudio,
        path: "/audiobooks",
        isLibraryNode: true,
        disabled: store.libraryAudiobooksCount === 0,
      });
    }
    if (enabledMenuItemStr === "podcasts") {
      items.push({
        label: "podcasts",
        icon: Podcast,
        path: "/podcasts",
        isLibraryNode: true,
        disabled: store.libraryPodcastsCount === 0,
      });
    }
    if (enabledMenuItemStr === "radios") {
      items.push({
        label: "radios",
        icon: Radio,
        path: "/radios",
        isLibraryNode: true,
      });
    }
    if (enabledMenuItemStr === "genres") {
      items.push({
        label: "genres",
        icon: Compass,
        path: "/genres",
        isLibraryNode: true,
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
