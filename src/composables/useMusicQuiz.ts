import api from "@/plugins/api";

export type MusicQuizPhase = "lobby" | "answering" | "reveal" | "finished";
export type MusicQuizMode = "venue" | "remote";
export type MusicQuizDifficulty = "easy" | "normal" | "hard";
export type MusicQuizType = "guess_the_song";
export type MusicQuizAnswerType = "multiple_choice";

declare const unsupportedMusicQuizType: unique symbol;
export type MusicQuizUnsupportedType = string & {
  readonly [unsupportedMusicQuizType]: true;
};
declare const unsupportedMusicQuizAnswerType: unique symbol;
export type MusicQuizUnsupportedAnswerType = string & {
  readonly [unsupportedMusicQuizAnswerType]: true;
};
export type MusicQuizRuntimeType = MusicQuizType | MusicQuizUnsupportedType;
export type MusicQuizRuntimeAnswerType =
  | MusicQuizAnswerType
  | MusicQuizUnsupportedAnswerType;

interface MusicQuizStateIdentity<
  TQuizType extends MusicQuizRuntimeType = MusicQuizRuntimeType,
  TAnswerType extends MusicQuizRuntimeAnswerType = MusicQuizRuntimeAnswerType,
> {
  quiz_type: TQuizType;
  answer_type: TAnswerType;
  phase: MusicQuizPhase;
  name: string | null;
}

interface MusicQuizSupportedStateBase extends MusicQuizStateIdentity {
  quiz_type: "guess_the_song";
  answer_type: "multiple_choice";
  round_count: number;
  suggestion_count: number;
  answer_duration: number;
  mode: MusicQuizMode;
  players: MusicQuizPlayer[];
  current_round?: MusicQuizCurrentRound | null;
}

export type MusicQuizSupportedPublicState = MusicQuizSupportedStateBase;

type MusicQuizUnsupportedStateIdentity =
  | MusicQuizStateIdentity<MusicQuizUnsupportedType, MusicQuizRuntimeAnswerType>
  | MusicQuizStateIdentity<MusicQuizType, MusicQuizUnsupportedAnswerType>;

export type MusicQuizUnsupportedPublicState = MusicQuizUnsupportedStateIdentity;

export type MusicQuizPublicState =
  | MusicQuizSupportedPublicState
  | MusicQuizUnsupportedPublicState;

export interface MusicQuizSupportedPersonalizedState extends MusicQuizSupportedStateBase {
  you: MusicQuizYou;
}

export type MusicQuizUnsupportedPersonalizedState =
  MusicQuizUnsupportedPublicState;

export type MusicQuizPersonalizedState =
  | MusicQuizSupportedPersonalizedState
  | MusicQuizUnsupportedPersonalizedState;

export interface MusicQuizSupportedHostState extends MusicQuizSupportedStateBase {
  created_at: number;
  sources: MusicQuizSource[];
  join_url: string;
  rounds: MusicQuizRound[];
}

export type MusicQuizUnsupportedHostState = MusicQuizUnsupportedPublicState;

export type MusicQuizHostState =
  | MusicQuizSupportedHostState
  | MusicQuizUnsupportedHostState;

export interface MusicQuizSupportedInfo extends MusicQuizStateIdentity {
  quiz_type: "guess_the_song";
  answer_type: "multiple_choice";
  player_count: number;
  round_count: number;
  mode: MusicQuizMode;
}

export type MusicQuizUnsupportedInfo = MusicQuizUnsupportedStateIdentity;

export type MusicQuizInfo = MusicQuizSupportedInfo | MusicQuizUnsupportedInfo;

export interface MusicQuizPlayer {
  name: string;
  score: number;
  ready: boolean;
  answered: boolean;
  active_from_round?: number;
  last_answer?: MusicQuizPlayerLastAnswer;
}

export interface MusicQuizPlayerLastAnswer {
  suggestion_id: string;
  correct?: boolean;
  points?: number;
}

export interface MusicQuizYou {
  name: string;
  score: number;
  ready: boolean;
  active_from_round: number;
  answer?: MusicQuizYourAnswer;
}

export interface MusicQuizYourAnswer {
  suggestion_id: string;
  answered_at: number;
  correct?: boolean;
  points?: number;
}

export interface MusicQuizCurrentRound {
  question: string | null;
  round_index: number;
  started_at: number;
  deadline: number;
  suggestions: MusicQuizSuggestion[];
  // post-reveal fields:
  correct_suggestion_id?: string;
  answer_label?: string;
  track_uri?: string | null;
  image_url?: string | null;
  duration?: number | null;
  ended_at?: number;
}

export type MusicQuizRound = MusicQuizCurrentRound;

export interface MusicQuizSuggestion {
  suggestion_id: string;
  label: string;
}

export interface MusicQuizSource {
  uri: string;
  name: string;
  media_type?: string | null;
}

export interface MusicQuizJoinResult {
  player_id: string;
  state: MusicQuizPersonalizedState;
}

export interface MusicQuizGuessTheSongConfig {
  round_count: number;
  suggestion_count: number;
  answer_duration: number;
  difficulty: MusicQuizDifficulty;
  source_uris: string[];
  name: string;
}

export interface MusicQuizGuessTheSongCreateRequest {
  quiz_type: "guess_the_song";
  answer_type: "multiple_choice";
  config: MusicQuizGuessTheSongConfig;
}

export type MusicQuizCreateRequest = MusicQuizGuessTheSongCreateRequest;

export type MusicQuizProviderEvent =
  | { event: "game_updated"; state: MusicQuizPublicState }
  | { event: "game_removed"; state?: never };

export function isSupportedMusicQuiz<
  T extends MusicQuizInfo | MusicQuizPublicState,
>(
  value: T,
): value is Extract<
  T,
  { quiz_type: "guess_the_song"; answer_type: "multiple_choice" }
> {
  return (
    value.quiz_type === "guess_the_song" &&
    value.answer_type === "multiple_choice"
  );
}

export function parseMusicQuizType(value: string): MusicQuizRuntimeType {
  return value === "guess_the_song"
    ? value
    : (value as MusicQuizUnsupportedType);
}

export function parseMusicQuizAnswerType(
  value: string,
): MusicQuizRuntimeAnswerType {
  return value === "multiple_choice"
    ? value
    : (value as MusicQuizUnsupportedAnswerType);
}

export function isMusicQuizProviderEvent(
  value: unknown,
): value is MusicQuizProviderEvent {
  if (!value || typeof value !== "object" || !("event" in value)) return false;
  if (value.event === "game_removed") return !("state" in value);
  return value.event === "game_updated" && "state" in value;
}

// Host commands (Scope.USERS_INVITE)
export function createMusicQuiz(request: MusicQuizCreateRequest) {
  const { quiz_type, config } = request;
  return api.sendCommand<MusicQuizHostState>("music_quiz/create", {
    quiz_type,
    ...config,
  });
}

export function getMusicQuiz() {
  return api.sendCommand<MusicQuizHostState>("music_quiz/get");
}

export function startMusicQuiz() {
  return api.sendCommand<MusicQuizHostState>("music_quiz/start");
}

export function revealMusicQuiz() {
  return api.sendCommand<MusicQuizHostState>("music_quiz/reveal");
}

export function nextMusicQuiz() {
  return api.sendCommand<MusicQuizHostState>("music_quiz/next");
}

export function resetMusicQuiz() {
  return api.sendCommand<MusicQuizHostState>("music_quiz/reset");
}

export function deleteMusicQuiz() {
  return api.sendCommand<null>("music_quiz/delete");
}

// Guest commands (any authenticated user; server validates guest username)
export function getMusicQuizInfo() {
  return api.sendCommand<MusicQuizInfo | null>("music_quiz/info");
}

export function joinMusicQuiz(name: string) {
  return api.sendCommand<MusicQuizJoinResult>("music_quiz/join", { name });
}

export function getMusicQuizState(player_id: string) {
  return api.sendCommand<MusicQuizPersonalizedState>("music_quiz/state", {
    player_id,
  });
}

export function answerMusicQuiz(player_id: string, suggestion_id: string) {
  return api.sendCommand<MusicQuizPersonalizedState>("music_quiz/answer", {
    player_id,
    suggestion_id,
  });
}

export function readyMusicQuiz(player_id: string) {
  return api.sendCommand<MusicQuizPersonalizedState>("music_quiz/ready", {
    player_id,
  });
}

// Listen-in commands (Scope.PLAYERS_CONTROL + guest validation)
export function listenInMusicQuiz(web_player_id: string) {
  return api.sendCommand<void>("music_quiz/listen_in", { web_player_id });
}

export function stopListenInMusicQuiz(web_player_id: string) {
  return api.sendCommand<void>("music_quiz/stop_listen_in", { web_player_id });
}

export function canListenInMusicQuiz(web_player_id: string) {
  return api.sendCommand<boolean>("music_quiz/can_listen_in", {
    web_player_id,
  });
}
