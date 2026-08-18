import type {
  MusicQuizPhase,
  MusicQuizPlayer,
  MusicQuizSupportedPublicState,
} from "@/composables/music-quiz/useMusicQuiz";
import type { ConnectionIdentity } from "@/helpers/connection_identity";
import { ApiCommandError } from "@/plugins/api/errors";
import { $t, canonicalizeLocale, i18n } from "@/plugins/i18n";

/** Error codes of the Music Quiz provider, as sent by the server. */
export enum MusicQuizErrorCode {
  NO_GAME = 1001,
  UNKNOWN_PLAYER = 1009,
}

const MUSIC_QUIZ_PLAYER_ID_KEY = "music_quiz_player_id";
const MUSIC_QUIZ_PLAYER_NAME_KEY = "music_quiz_player_name";
const MUSIC_QUIZ_LANDING_SEEN_KEY = "music_quiz_landing_seen";
const MUSIC_QUIZ_STORAGE_VERSION = 1;

export interface MusicQuizParticipantStorageContext {
  connectionIdentity: ConnectionIdentity;
  participantIdentity: string;
}

interface StoredMusicQuizPlayerId extends MusicQuizParticipantStorageContext {
  version: typeof MUSIC_QUIZ_STORAGE_VERSION;
  playerId: string;
}

interface StoredMusicQuizPlayerName extends MusicQuizParticipantStorageContext {
  version: typeof MUSIC_QUIZ_STORAGE_VERSION;
  playerName: string;
}

interface StoredMusicQuizLandingSeen extends MusicQuizParticipantStorageContext {
  version: typeof MUSIC_QUIZ_STORAGE_VERSION;
  playerId: string;
}

/**
 * Store the private player credential for this tab.
 *
 * NEVER render this in the UI — it's the participant's authentication token.
 */
export function storeMusicQuizPlayerId(
  playerId: string,
  context: MusicQuizParticipantStorageContext | undefined,
) {
  localStorage.removeItem(MUSIC_QUIZ_PLAYER_ID_KEY);
  if (!context) {
    sessionStorage.removeItem(MUSIC_QUIZ_PLAYER_ID_KEY);
    return;
  }
  const value: StoredMusicQuizPlayerId = {
    version: MUSIC_QUIZ_STORAGE_VERSION,
    ...context,
    playerId,
  };
  sessionStorage.setItem(MUSIC_QUIZ_PLAYER_ID_KEY, JSON.stringify(value));
}

/**
 * Retrieve the stored player_id credential.
 */
export function getStoredMusicQuizPlayerId(
  context: MusicQuizParticipantStorageContext | undefined,
): string | null {
  localStorage.removeItem(MUSIC_QUIZ_PLAYER_ID_KEY);
  if (!context) {
    sessionStorage.removeItem(MUSIC_QUIZ_PLAYER_ID_KEY);
    return null;
  }
  const storedValue = readStoredValue(
    MUSIC_QUIZ_PLAYER_ID_KEY,
    isStoredMusicQuizPlayerId,
  );
  if (!storedValue || !isMatchingStorageContext(storedValue, context)) {
    sessionStorage.removeItem(MUSIC_QUIZ_PLAYER_ID_KEY);
    return null;
  }
  return storedValue.playerId;
}

/**
 * Clear the stored player_id (e.g. when leaving the game).
 */
export function clearStoredMusicQuizPlayerId() {
  sessionStorage.removeItem(MUSIC_QUIZ_PLAYER_ID_KEY);
  localStorage.removeItem(MUSIC_QUIZ_PLAYER_ID_KEY);
}

export function storeMusicQuizPlayerName(
  name: string,
  context: MusicQuizParticipantStorageContext | undefined,
) {
  const trimmedName = name.trim();
  localStorage.removeItem(MUSIC_QUIZ_PLAYER_NAME_KEY);
  if (!trimmedName || !context) {
    sessionStorage.removeItem(MUSIC_QUIZ_PLAYER_NAME_KEY);
    return;
  }
  const value: StoredMusicQuizPlayerName = {
    version: MUSIC_QUIZ_STORAGE_VERSION,
    ...context,
    playerName: trimmedName,
  };
  sessionStorage.setItem(MUSIC_QUIZ_PLAYER_NAME_KEY, JSON.stringify(value));
}

export function getStoredMusicQuizPlayerName(
  context: MusicQuizParticipantStorageContext | undefined,
): string {
  if (!context) {
    clearStoredMusicQuizPlayerName();
    return "";
  }
  const storedValue = readStoredValue(
    MUSIC_QUIZ_PLAYER_NAME_KEY,
    isStoredMusicQuizPlayerName,
  );
  if (storedValue && isMatchingStorageContext(storedValue, context)) {
    return storedValue.playerName;
  }
  sessionStorage.removeItem(MUSIC_QUIZ_PLAYER_NAME_KEY);
  localStorage.removeItem(MUSIC_QUIZ_PLAYER_NAME_KEY);
  return "";
}

/**
 * Record that the player has seen the landing screen for this quiz session.
 */
export function storeMusicQuizLandingSeen(
  context: MusicQuizParticipantStorageContext | undefined,
  playerId: string,
): void {
  if (!context) {
    sessionStorage.removeItem(MUSIC_QUIZ_LANDING_SEEN_KEY);
    return;
  }
  const value: StoredMusicQuizLandingSeen = {
    version: MUSIC_QUIZ_STORAGE_VERSION,
    ...context,
    playerId,
  };
  sessionStorage.setItem(MUSIC_QUIZ_LANDING_SEEN_KEY, JSON.stringify(value));
}

/**
 * Whether the player has already seen the landing screen for this quiz session.
 */
export function hasSeenMusicQuizLanding(
  context: MusicQuizParticipantStorageContext | undefined,
  playerId: string,
): boolean {
  if (!context) {
    sessionStorage.removeItem(MUSIC_QUIZ_LANDING_SEEN_KEY);
    return false;
  }
  const storedValue = readStoredValue(
    MUSIC_QUIZ_LANDING_SEEN_KEY,
    isStoredMusicQuizLandingSeen,
  );
  if (
    storedValue &&
    isMatchingStorageContext(storedValue, context) &&
    storedValue.playerId === playerId
  ) {
    return true;
  }
  sessionStorage.removeItem(MUSIC_QUIZ_LANDING_SEEN_KEY);
  return false;
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

export function getMusicQuizRoundPlayers<T extends MusicQuizPlayer>(
  players: T[],
  roundIndex: number,
) {
  return players.filter((player) => player.active_from_round <= roundIndex);
}

export function formatNameList(names: string[]) {
  return new Intl.ListFormat(canonicalizeLocale(i18n.global.locale.value), {
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

export function getMusicQuizRoundScore(
  state: MusicQuizSupportedPublicState,
  playerName: string,
) {
  if (state.phase !== "reveal" || !state.current_round) return undefined;
  const player = state.players.find((p) => p.name === playerName);
  if (!player) return undefined;
  if (player.active_from_round > state.current_round.round_index) {
    return undefined;
  }
  if (!player.last_answer) return undefined;
  return "placement" in player.last_answer
    ? player.last_answer.placement.points +
        (player.last_answer.artist?.points ?? 0) +
        (player.last_answer.title?.points ?? 0)
    : player.last_answer.points;
}

export function getMusicQuizRoundScoreLabel(
  state: MusicQuizSupportedPublicState,
  playerName: string,
) {
  const points = getMusicQuizRoundScore(state, playerName);
  return points === undefined ? "" : `(+${points})`;
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

/** Whether the command failed because there is no active Music Quiz game. */
export function isNoActiveGameError(err: unknown): boolean {
  return hasMusicQuizErrorCode(err, MusicQuizErrorCode.NO_GAME);
}

/** Whether the command failed because the game does not know this player. */
export function isUnknownPlayerError(err: unknown): boolean {
  return hasMusicQuizErrorCode(err, MusicQuizErrorCode.UNKNOWN_PLAYER);
}

function hasMusicQuizErrorCode(
  err: unknown,
  code: MusicQuizErrorCode,
): boolean {
  return err instanceof ApiCommandError && err.error_code === code;
}

function clearStoredMusicQuizPlayerName(): void {
  sessionStorage.removeItem(MUSIC_QUIZ_PLAYER_NAME_KEY);
  localStorage.removeItem(MUSIC_QUIZ_PLAYER_NAME_KEY);
}

function isMatchingStorageContext(
  storedValue: MusicQuizParticipantStorageContext,
  context: MusicQuizParticipantStorageContext,
): boolean {
  return (
    storedValue.connectionIdentity === context.connectionIdentity &&
    storedValue.participantIdentity === context.participantIdentity
  );
}

function isStoredMusicQuizPlayerId(
  value: unknown,
): value is StoredMusicQuizPlayerId {
  return (
    isStoredMusicQuizParticipantValue(value) &&
    "playerId" in value &&
    typeof value.playerId === "string" &&
    value.playerId.length > 0
  );
}

function isStoredMusicQuizPlayerName(
  value: unknown,
): value is StoredMusicQuizPlayerName {
  return (
    isStoredMusicQuizParticipantValue(value) &&
    "playerName" in value &&
    typeof value.playerName === "string" &&
    value.playerName.length > 0
  );
}

function isStoredMusicQuizLandingSeen(
  value: unknown,
): value is StoredMusicQuizLandingSeen {
  return (
    isStoredMusicQuizParticipantValue(value) &&
    "playerId" in value &&
    typeof value.playerId === "string" &&
    value.playerId.length > 0
  );
}

function isStoredMusicQuizParticipantValue(value: unknown): value is Record<
  string,
  unknown
> &
  MusicQuizParticipantStorageContext & {
    version: typeof MUSIC_QUIZ_STORAGE_VERSION;
  } {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === MUSIC_QUIZ_STORAGE_VERSION &&
    "connectionIdentity" in value &&
    typeof value.connectionIdentity === "string" &&
    "participantIdentity" in value &&
    typeof value.participantIdentity === "string"
  );
}

function readStoredValue<T>(
  storageKey: string,
  guard: (value: unknown) => value is T,
): T | undefined {
  const rawValue = sessionStorage.getItem(storageKey);
  if (!rawValue) return undefined;
  try {
    const value: unknown = JSON.parse(rawValue);
    return guard(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
