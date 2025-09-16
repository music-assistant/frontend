import { DEFAULT_MENU_ITEMS } from "@/constants";
import { store } from "@/plugins/store";

export interface MenuItem {
  label: string;
  icon: string;
  path: string;
  isLibraryNode: boolean;
  hidden?: boolean;
}

export const getMenuItems = function () {
  const storedMenuConf = localStorage.getItem("frontend.settings.menu_items");
  const enabledItems: string[] = storedMenuConf
    ? storedMenuConf.split(",")
    : DEFAULT_MENU_ITEMS;
  const items: MenuItem[] = [];
  // we loop through the enabled items list so we can respect the order
  for (const enabledMenuItemStr of enabledItems) {
    if (enabledMenuItemStr === "home") {
      items.push({
        label: "home",
        icon: "mdi-home-outline",
        path: "/home",
        isLibraryNode: false,
      });
    }
    if (enabledMenuItemStr === "search") {
      items.push({
        label: "search",
        icon: "mdi-magnify",
        path: "/search",
        isLibraryNode: false,
      });
    }
    if (enabledMenuItemStr === "artists") {
      items.push({
        label: "artists",
        icon: "mdi-account-outline",
        path: "/artists",
        isLibraryNode: true,
        hidden: store.libraryArtistsCount === 0,
      });
    }
    if (enabledMenuItemStr === "albums") {
      items.push({
        label: "albums",
        icon: "md:album",
        path: "/albums",
        isLibraryNode: true,
        hidden: store.libraryAlbumsCount === 0,
      });
    }
    if (enabledMenuItemStr === "tracks") {
      items.push({
        label: "tracks",
        icon: "mdi-music-note",
        path: "/tracks",
        isLibraryNode: true,
        hidden: store.libraryTracksCount === 0,
      });
    }
    if (enabledMenuItemStr === "playlists") {
      items.push({
        label: "playlists",
        icon: "md:playlist_play",
        path: "/playlists",
        isLibraryNode: true,
        hidden: store.libraryPlaylistsCount === 0,
      });
    }
    if (enabledMenuItemStr === "podcasts") {
      items.push({
        label: "podcasts",
        icon: "mdi-podcast",
        path: "/podcasts",
        isLibraryNode: true,
        hidden: store.libraryPodcastsCount === 0,
      });
    }
    if (enabledMenuItemStr === "audiobooks") {
      items.push({
        label: "audiobooks",
        icon: "mdi-book-play-outline",
        path: "/audiobooks",
        isLibraryNode: true,
        hidden: store.libraryAudiobooksCount === 0,
      });
    }
    if (enabledMenuItemStr === "radios") {
      items.push({
        label: "radios",
        icon: "mdi-access-point",
        path: "/radios",
        isLibraryNode: true,
        hidden: store.libraryRadiosCount === 0,
      });
    }
    if (enabledMenuItemStr === "browse") {
      items.push({
        label: "browse",
        icon: "mdi-folder-outline",
        path: "/browse",
        isLibraryNode: true,
      });
    }
    if (enabledMenuItemStr === "settings") {
      items.push({
        label: "settings.settings",
        icon: "mdi-cog-outline",
        path: "/settings",
        isLibraryNode: true,
      });
    }
  }
  return items;
};
