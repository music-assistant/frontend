import { MediaType } from "@/plugins/api/interfaces";
import { Tag, Tags } from "lucide-vue-next";
import type { Component } from "vue";

// Icon mapping for different media types in genre overview
export const genreMediaTypeIconMap: Record<MediaType, string | Component> = {
  [MediaType.TRACK]: "mdi-music-note",
  [MediaType.ALBUM]: "mdi-album",
  [MediaType.ARTIST]: "mdi-account-music",
  [MediaType.PLAYLIST]: "mdi-playlist-music",
  [MediaType.RADIO]: "mdi-radio",
  [MediaType.AUDIOBOOK]: "mdi-book-music",
  [MediaType.PODCAST]: "mdi-podcast",
  [MediaType.GENRE]: Tag,
  [MediaType.GENRE_ALIAS]: Tags,
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
};
