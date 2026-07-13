import type {
  MusicQuizMode,
  MusicQuizPlaybackOptions,
} from "@/composables/music-quiz/useMusicQuiz";

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
    venuePlayerId: isVenuePlayerAvailable(
      options.default_venue_player_id,
      options,
    )
      ? options.default_venue_player_id
      : null,
  };
}

export function reconcileMusicQuizPlaybackSelection(
  selection: MusicQuizPlaybackSelection,
  options: MusicQuizPlaybackOptions,
): MusicQuizPlaybackSelection {
  const defaults = getDefaultMusicQuizPlaybackSelection(options);
  const mode = isPlaybackModeAvailable(selection.mode, options)
    ? selection.mode
    : defaults.mode;
  const venuePlayerId = isVenuePlayerAvailable(selection.venuePlayerId, options)
    ? selection.venuePlayerId
    : defaults.venuePlayerId;

  return mode === selection.mode && venuePlayerId === selection.venuePlayerId
    ? selection
    : { mode, venuePlayerId };
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

function isPlaybackModeAvailable(
  mode: MusicQuizMode | null,
  options: MusicQuizPlaybackOptions,
) {
  if (mode === "remote") return options.remote_available;
  if (mode === "venue") {
    return options.venue_available && options.venue_players.length > 0;
  }
  return false;
}

function isVenuePlayerAvailable(
  playerId: string | null,
  options: MusicQuizPlaybackOptions,
) {
  return (
    playerId !== null &&
    options.venue_players.some((player) => player.player_id === playerId)
  );
}
