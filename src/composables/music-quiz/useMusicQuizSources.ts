import { getMusicQuizSourceSummary } from "@/helpers/music_quiz_sources";
import {
  MediaType,
  type Album,
  type Artist,
  type Genre,
  type MediaItemTypeOrItemMapping,
  type Playlist,
  type Track,
} from "@/plugins/api/interfaces";
import { computed, ref } from "vue";

export type MusicQuizSourceItem = Track | Playlist | Genre | Album | Artist;

// media types a Music Quiz can be played from, in display order
export const MUSIC_QUIZ_SOURCE_MEDIA_TYPES: MediaType[] = [
  MediaType.TRACK,
  MediaType.PLAYLIST,
  MediaType.GENRE,
  MediaType.ALBUM,
  MediaType.ARTIST,
];

// sensible default: a couple of large sources rather than picking single tracks
export const MUSIC_QUIZ_DEFAULT_SOURCE_MEDIA_TYPES: MediaType[] = [
  MediaType.PLAYLIST,
  MediaType.GENRE,
];

export function isMusicQuizSourceItem(
  item: MediaItemTypeOrItemMapping,
): item is MusicQuizSourceItem {
  return MUSIC_QUIZ_SOURCE_MEDIA_TYPES.includes(item.media_type);
}

/**
 * Selection management for the tracks/playlists/genres/albums/artists a
 * Music Quiz is played from. Searching happens in the MediaSearch component;
 * this only holds what the user picked.
 */
export function useMusicQuizSources() {
  const selected = ref<MusicQuizSourceItem[]>([]);

  const sourceUris = computed(() => selected.value.map((item) => item.uri));
  const summary = computed(() => getMusicQuizSourceSummary(selected.value));
  const canCreate = computed(() => sourceUris.value.length > 0);

  function add(item: MusicQuizSourceItem) {
    if (selected.value.some((source) => source.uri === item.uri)) return;
    selected.value.push(item);
  }

  function remove(uri: string) {
    selected.value = selected.value.filter((source) => source.uri !== uri);
  }

  return {
    selected,
    sourceUris,
    summary,
    canCreate,
    add,
    remove,
  };
}
