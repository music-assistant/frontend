import api from "@/plugins/api";

export type MusicQuizPhase = "lobby" | "answering" | "reveal" | "finished";
export type MusicQuizMode = "venue" | "remote";

/**
 * Public state shape (guest-safe): exposed in game_updated events,
 * music_quiz/state, music_quiz/join, music_quiz/info, and all host responses.
 */
export interface MusicQuizPublicState {
  phase: MusicQuizPhase;
  name: string;
  round_count: number;
  suggestion_count: number;
  answer_duration: number;
  mode: MusicQuizMode;
  players: MusicQuizPlayer[];
  current_round?: MusicQuizCurrentRound | null;
}

/**
 * Personalized state = public state + you (the authenticated guest's own data).
 */
export interface MusicQuizPersonalizedState extends MusicQuizPublicState {
  you: MusicQuizYou;
}

/**
 * Host state = public state + created_at, sources, join_url, full rounds array.
 */
export interface MusicQuizHostState extends MusicQuizPublicState {
  created_at: number;
  sources: MusicQuizSource[];
  join_url: string;
  rounds: MusicQuizRound[];
}

/**
 * Pre-join info (music_quiz/info): subset for landing screen before join.
 */
export interface MusicQuizInfo {
  name: string;
  phase: MusicQuizPhase;
  player_count: number;
  round_count: number;
  mode: MusicQuizMode;
}

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
  round_index: number;
  started_at: number;
  deadline: number;
  suggestions: MusicQuizSuggestion[];
  // post-reveal fields:
  correct_suggestion_id?: string;
  answer_label?: string;
  track_uri?: string;
  image_url?: string | null;
  duration?: number | null;
  ended_at?: number;
}

export interface MusicQuizRound extends MusicQuizCurrentRound {
  // Host state includes full history; current_round is a live subset
}

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

/**
 * Host setup-form arguments for creating a game (quiz_type is added by the host view).
 */
export interface MusicQuizCreateArgs {
  round_count: number;
  suggestion_count: number;
  answer_duration: number;
  source_uris: string[];
  name: string;
}

// Host commands (Scope.USERS_INVITE)
export function createMusicQuiz(
  quiz_type: string,
  round_count: number,
  suggestion_count: number,
  answer_duration: number,
  source_uris: string[],
  name?: string,
) {
  return api.sendCommand<MusicQuizHostState>("music_quiz/create", {
    quiz_type,
    round_count,
    suggestion_count,
    answer_duration,
    source_uris,
    name,
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
