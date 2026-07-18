import { MediaType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

type SourceLike = { media_type?: string | null };

// media types a Music Quiz source can be, in display order
const SOURCE_TYPES = [
  MediaType.TRACK,
  MediaType.PLAYLIST,
  MediaType.GENRE,
  MediaType.ALBUM,
  MediaType.ARTIST,
] as const;

type SourceType = (typeof SOURCE_TYPES)[number];

const SOURCE_TYPE_LABEL_KEYS: Record<SourceType, string> = {
  [MediaType.TRACK]: "providers.music_quiz.track",
  [MediaType.PLAYLIST]: "providers.music_quiz.playlist",
  [MediaType.GENRE]: "providers.music_quiz.genre",
  [MediaType.ALBUM]: "providers.music_quiz.album",
  [MediaType.ARTIST]: "providers.music_quiz.artist",
};

const SOURCE_TYPE_COUNT_KEYS: Record<
  SourceType,
  { single: string; multi: string }
> = {
  [MediaType.TRACK]: {
    single: "providers.music_quiz.track_count",
    multi: "providers.music_quiz.tracks_count",
  },
  [MediaType.PLAYLIST]: {
    single: "providers.music_quiz.playlist_count",
    multi: "providers.music_quiz.playlists_count",
  },
  [MediaType.GENRE]: {
    single: "providers.music_quiz.genre_count",
    multi: "providers.music_quiz.genres_count",
  },
  [MediaType.ALBUM]: {
    single: "providers.music_quiz.album_count",
    multi: "providers.music_quiz.albums_count",
  },
  [MediaType.ARTIST]: {
    single: "providers.music_quiz.artist_count",
    multi: "providers.music_quiz.artists_count",
  },
};

export function getMusicQuizSourceSummary(sources: SourceLike[]) {
  const counts = new Map<SourceType, number>();
  for (const source of sources) {
    const type = normalizeSourceType(source.media_type);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const parts = SOURCE_TYPES.filter((type) => counts.get(type)).map((type) => {
    const count = counts.get(type) ?? 0;
    const keys = SOURCE_TYPE_COUNT_KEYS[type];
    return $t(count === 1 ? keys.single : keys.multi, [count]);
  });
  return parts.join(", ") || $t("providers.music_quiz.tracks_count", [0]);
}

export function musicQuizSourceTypeLabel(mediaType?: string | null) {
  const type = SOURCE_TYPES.find((candidate) => candidate === mediaType);
  return type
    ? $t(SOURCE_TYPE_LABEL_KEYS[type])
    : $t("providers.music_quiz.source_music");
}

// sources of an unrecognized type (e.g. from an older client) count as tracks
function normalizeSourceType(mediaType?: string | null): SourceType {
  const type = SOURCE_TYPES.find((candidate) => candidate === mediaType);
  return type ?? MediaType.TRACK;
}
