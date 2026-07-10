import type {
  MusicQuizPhase,
  MusicQuizPlayer,
  MusicQuizPublicState,
} from "@/composables/useMusicQuiz";
import { $t, i18n } from "@/plugins/i18n";

const MUSIC_QUIZ_PLAYER_ID_KEY = "music_quiz_player_id";

/**
 * Store the player_id credential in localStorage (guest's PRIVATE credential).
 * NEVER render this in the UI — it's the guest's authentication token.
 */
export function storeMusicQuizPlayerId(playerId: string) {
  localStorage.setItem(MUSIC_QUIZ_PLAYER_ID_KEY, playerId);
}

/**
 * Retrieve the stored player_id credential.
 */
export function getStoredMusicQuizPlayerId(): string | null {
  return localStorage.getItem(MUSIC_QUIZ_PLAYER_ID_KEY);
}

/**
 * Clear the stored player_id (e.g. when leaving the game).
 */
export function clearStoredMusicQuizPlayerId() {
  localStorage.removeItem(MUSIC_QUIZ_PLAYER_ID_KEY);
}

export type RankedMusicQuizPlayer = MusicQuizPlayer & { rank: number };

export function rankMusicQuizPlayers(
  players: MusicQuizPlayer[],
): RankedMusicQuizPlayer[] {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  let rank = 0;
  let previousScore: number | undefined;
  return sorted.map((player) => {
    if (player.score !== previousScore) {
      rank += 1;
      previousScore = player.score;
    }
    return { ...player, rank };
  });
}

export function formatNameList(names: string[]) {
  return new Intl.ListFormat(i18n.global.locale.value, {
    style: "long",
    type: "conjunction",
  }).format(names);
}

export function getMusicQuizWinnerText(players: RankedMusicQuizPlayer[]) {
  const topScore = players[0]?.score ?? 0;
  if (topScore <= 0) return $t("providers.music_quiz.no_winner");
  const winners = players.filter((player) => player.rank === 1);
  const names = formatNameList(winners.map((player) => player.name));
  return winners.length === 1
    ? $t("providers.music_quiz.winner_single", [names, topScore])
    : $t("providers.music_quiz.winner_multiple", [names, topScore]);
}

export function isMusicQuizWinner(
  players: RankedMusicQuizPlayer[],
  playerName: string | undefined,
) {
  if (!playerName) return false;
  const topScore = players[0]?.score ?? 0;
  if (topScore <= 0) return false;
  return players.some(
    (player) => player.name === playerName && player.rank === 1,
  );
}

export function getMusicQuizRoundScoreLabel(
  state: MusicQuizPublicState,
  playerName: string,
) {
  if (state.phase !== "reveal" || !state.current_round) return "";
  const player = state.players.find((p) => p.name === playerName);
  if (!player) return "";
  if (
    player.active_from_round !== undefined &&
    player.active_from_round > state.current_round.round_index
  ) {
    return "";
  }
  if (player.last_answer && player.last_answer.points !== undefined) {
    return `(+${player.last_answer.points})`;
  }
  return "";
}

export function getMusicQuizErrorMessage(err: unknown, fallback = "") {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const details =
      "details" in err && typeof err.details === "string" ? err.details : "";
    const message =
      "message" in err && typeof err.message === "string" ? err.message : "";
    return details || message || fallback;
  }
  return fallback;
}

export function isNoActiveGameError(err: unknown) {
  if (typeof err === "string") {
    return err.toLowerCase().includes("no active");
  }
  if (err instanceof Error) {
    return err.message.toLowerCase().includes("no active");
  }
  if (!err || typeof err !== "object") return false;
  const message =
    "message" in err && typeof err.message === "string" ? err.message : "";
  const details =
    "details" in err && typeof err.details === "string" ? err.details : "";
  if (`${message} ${details}`.toLowerCase().includes("no active")) return true;

  const errorCode =
    "error_code" in err && typeof err.error_code === "string"
      ? err.error_code.toLowerCase()
      : "";
  const errorType =
    "type" in err && typeof err.type === "string" ? err.type.toLowerCase() : "";
  return (
    errorCode === "musicquiznogameerror" ||
    errorCode === "music_quiz_no_game" ||
    errorType === "musicquiznogameerror" ||
    errorType === "music_quiz_no_game"
  );
}

export function isMusicQuizPlayerNotFoundError(err: unknown) {
  const normalizedMessage = getMusicQuizErrorMessage(err).toLowerCase();
  if (normalizedMessage.includes("player not found")) return true;

  if (err && typeof err === "object") {
    const errorCode =
      "error_code" in err && typeof err.error_code === "string"
        ? err.error_code.toLowerCase()
        : "";
    return (
      errorCode.includes("player_not_found") && errorCode.includes("music_quiz")
    );
  }
  return false;
}
