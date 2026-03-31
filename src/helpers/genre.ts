import type { Component } from "vue";
import { Route } from "lucide-vue-next";

import GenreIcon from "@/components/icons/GenreIcon.vue";
import { api } from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";

// Module-level timer so the debounce survives component unmount / navigation.
let scanDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleGenreScan(delay = 10_000) {
  if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
  scanDebounceTimer = setTimeout(() => {
    scanDebounceTimer = null;
    api.triggerGenreScan().catch(() => {
      // fire-and-forget; GenreTable and LibraryGenres refresh via genre event subscription
    });
  }, delay);
}

// Icon mapping for different media types in genre overview
export const genreMediaTypeIconMap: Record<MediaType, string | Component> = {
  [MediaType.TRACK]: "mdi-music-note",
  [MediaType.ALBUM]: "mdi-album",
  [MediaType.ARTIST]: "mdi-account-music",
  [MediaType.PLAYLIST]: "mdi-playlist-music",
  [MediaType.RADIO]: "mdi-radio",
  [MediaType.AUDIOBOOK]: "mdi-book-music",
  [MediaType.PODCAST]: "mdi-podcast",
  [MediaType.GENRE]: GenreIcon,
  [MediaType.GENRE_ALIAS]: Route,
  [MediaType.PODCAST_EPISODE]: "mdi-podcast",
  [MediaType.FOLDER]: "mdi-folder",
  [MediaType.UNKNOWN]: "mdi-help-circle-outline",
};

// Map recommendation folder item_ids to library route names
export const folderIdToRoute: Record<string, string> = {
  genre_artist: "artists",
  genre_album: "albums",
  genre_track: "tracks",
  genre_playlist: "playlists",
  genre_radio: "radios",
  genre_podcast: "podcasts",
  genre_audiobook: "audiobooks",
};
