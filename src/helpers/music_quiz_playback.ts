import type {
  MusicQuizMode,
  MusicQuizPlaybackOptions,
} from "@/composables/useMusicQuiz";

export interface MusicQuizPlaybackSelection {
  mode: MusicQuizMode | null;
  venuePlayerId: string | null;
}

export type MusicQuizExplicitPlaybackCreateFields =
  | {
      playback_mode: "venue";
      venue_player_id: string;
    }
  | {
      playback_mode: "remote";
      venue_player_id: null;
    };

export function getDefaultMusicQuizPlaybackSelection(
  options: MusicQuizPlaybackOptions,
): MusicQuizPlaybackSelection {
  return {
    mode: options.default_playback_mode,
    venuePlayerId: options.default_venue_player_id,
  };
}

export function getMusicQuizPlaybackCreateFields(
  selection: MusicQuizPlaybackSelection,
  options: MusicQuizPlaybackOptions,
): MusicQuizExplicitPlaybackCreateFields | null {
  if (selection.mode === "remote") {
    return options.remote_available
      ? { playback_mode: "remote", venue_player_id: null }
      : null;
  }

  if (
    selection.mode === "venue" &&
    options.venue_available &&
    selection.venuePlayerId &&
    options.venue_players.some(
      (player) => player.player_id === selection.venuePlayerId,
    )
  ) {
    return {
      playback_mode: "venue",
      venue_player_id: selection.venuePlayerId,
    };
  }

  return null;
}

export function isMusicQuizPlaybackSelectionValid(
  selection: MusicQuizPlaybackSelection,
  options: MusicQuizPlaybackOptions,
) {
  return getMusicQuizPlaybackCreateFields(selection, options) !== null;
}
