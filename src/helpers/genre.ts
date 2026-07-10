import { Route } from "@lucide/vue";
import type { Component } from "vue";

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
  [MediaType.AUDIO_SOURCE]: "mdi-audio-input-rca",
  [MediaType.SOUND_EFFECT]: "mdi-waveform",
  [MediaType.AUDIOBOOK]: "mdi-book-music",
  [MediaType.PODCAST]: "mdi-podcast",
  [MediaType.GENRE]: GenreIcon,
  [MediaType.GENRE_ALIAS]: Route,
  [MediaType.PODCAST_EPISODE]: "mdi-podcast",
  [MediaType.FOLDER]: "mdi-folder",
  [MediaType.UNKNOWN]: "mdi-help-circle-outline",
};

// Icon marking which taxonomy a genre belongs to (null/undefined = music/general).
// Shown on each genre in the library list so same-named genres across taxonomies
// (e.g. a music "Comedy" vs a podcast "Comedy") are visually distinguishable.
export function genreContentTypeIcon(contentType?: MediaType | null): string {
  switch (contentType) {
    case MediaType.AUDIOBOOK:
      return "mdi-book-music";
    case MediaType.PODCAST:
      return "mdi-podcast";
    default:
      return "mdi-music";
  }
}

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
