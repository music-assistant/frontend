import { MediaType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

type SourceLike = { media_type?: string | null };

export function getMusicQuizSourceSummary(sources: SourceLike[]) {
  const counts = sources.reduce(
    (acc, source) => {
      if (isPlaylistSource(source)) {
        acc.playlists += 1;
      } else {
        acc.tracks += 1;
      }
      return acc;
    },
    { tracks: 0, playlists: 0 },
  );
  const parts: string[] = [];
  if (counts.tracks > 0) {
    parts.push(
      $t(
        counts.tracks === 1
          ? "providers.music_quiz.track_count"
          : "providers.music_quiz.tracks_count",
        [counts.tracks],
      ),
    );
  }
  if (counts.playlists > 0) {
    parts.push(
      $t(
        counts.playlists === 1
          ? "providers.music_quiz.playlist_count"
          : "providers.music_quiz.playlists_count",
        [counts.playlists],
      ),
    );
  }
  return parts.join(", ") || $t("providers.music_quiz.tracks_count", [0]);
}

export function musicQuizSourceTypeLabel(mediaType?: string | null) {
  if (mediaType === MediaType.PLAYLIST || mediaType === "playlist") {
    return $t("providers.music_quiz.playlist");
  }
  if (mediaType === MediaType.TRACK || mediaType === "track") {
    return $t("providers.music_quiz.track");
  }
  return $t("providers.music_quiz.source_music");
}

function isPlaylistSource(source: SourceLike) {
  return (
    source.media_type === MediaType.PLAYLIST || source.media_type === "playlist"
  );
}
