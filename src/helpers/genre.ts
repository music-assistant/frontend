import {
  AudioLines,
  AudioWaveform,
  BookAudio,
  CircleHelp,
  Disc3,
  Folder,
  Library,
  ListMusic,
  Music,
  Music2,
  Podcast,
  Radio,
  Route,
  UserRound,
} from "@lucide/vue";
import type { Component } from "vue";

import GenreIcon from "@/components/icons/GenreIcon.vue";
import { api } from "@/plugins/api";
import type { Genre } from "@/plugins/api/interfaces";
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

// The genre's own name is stored in genre_aliases, so it is excluded here.
export function mappedAliases(genre: Genre): string[] {
  const genreName = genre.name?.toLowerCase();
  return (genre.genre_aliases || []).filter(
    (alias) => alias.toLowerCase() !== genreName,
  );
}

// Icon mapping for different media types in genre overview
export const genreMediaTypeIconMap: Record<MediaType, Component> = {
  [MediaType.TRACK]: Music2,
  [MediaType.ALBUM]: Disc3,
  [MediaType.ARTIST]: UserRound,
  [MediaType.PLAYLIST]: ListMusic,
  [MediaType.RADIO]: Radio,
  [MediaType.AUDIO_SOURCE]: AudioLines,
  [MediaType.SOUND_EFFECT]: AudioWaveform,
  [MediaType.AUDIOBOOK]: BookAudio,
  [MediaType.PODCAST]: Podcast,
  [MediaType.GENRE]: GenreIcon,
  [MediaType.GENRE_ALIAS]: Route,
  [MediaType.PODCAST_EPISODE]: Podcast,
  [MediaType.FOLDER]: Folder,
  [MediaType.COLLECTION]: Library,
  [MediaType.UNKNOWN]: CircleHelp,
};

// Icon marking which taxonomy a genre belongs to (null/undefined = music/general).
// Shown on each genre in the library list so same-named genres across taxonomies
// (e.g. a music "Comedy" vs a podcast "Comedy") are visually distinguishable.
export function genreContentTypeIcon(
  contentType?: MediaType | null,
): Component {
  switch (contentType) {
    case MediaType.AUDIOBOOK:
      return BookAudio;
    case MediaType.PODCAST:
      return Podcast;
    default:
      return Music;
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
