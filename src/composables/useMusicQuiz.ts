import api from "@/plugins/api";

export type MusicQuizPhase = "lobby" | "answering" | "reveal" | "finished";
export type MusicQuizMode = "venue" | "remote";
export type MusicQuizDifficulty = "easy" | "normal" | "hard";
export type MusicQuizTimelineBonusMode =
  | "off"
  | "free_text"
  | "multiple_choice";
export type MusicQuizTimelineBonusType = "artist" | "title";

export interface MusicQuizTimelinePlacementSubmission {
  answer_type: "timeline";
  action: "place";
  previous_entry_id: string | null;
  next_entry_id: string | null;
}

export interface MusicQuizTimelineBonusTextSubmission {
  answer_type: "timeline";
  action: "bonus_text";
  bonus_type: MusicQuizTimelineBonusType;
  value: string;
}

export interface MusicQuizTimelineBonusChoiceSubmission {
  answer_type: "timeline";
  action: "bonus_choice";
  bonus_type: MusicQuizTimelineBonusType;
  option_id: string;
}

export interface MusicQuizTimelineFinishSubmission {
  answer_type: "timeline";
  action: "finish";
}

export type MusicQuizTimelineSubmission =
  | MusicQuizTimelinePlacementSubmission
  | MusicQuizTimelineBonusTextSubmission
  | MusicQuizTimelineBonusChoiceSubmission
  | MusicQuizTimelineFinishSubmission;

export type MusicQuizAnswerSubmissionMap = {
  multiple_choice: {
    answer_type: "multiple_choice";
    suggestion_id: string;
  };
  timeline: MusicQuizTimelineSubmission;
};

export type MusicQuizAnswerType = keyof MusicQuizAnswerSubmissionMap;
export type MusicQuizAnswerSubmission =
  MusicQuizAnswerSubmissionMap[MusicQuizAnswerType];

export type MusicQuizGameAnswerTypeMap = {
  guess_the_song: "multiple_choice";
  hitster: "timeline";
};

export type MusicQuizType = keyof MusicQuizGameAnswerTypeMap;

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

interface MusicQuizGuessTheSongStateBase extends MusicQuizStateIdentity {
  quiz_type: "guess_the_song";
  answer_type: "multiple_choice";
  round_count: number;
  suggestion_count: number;
  answer_duration: number;
  mode: MusicQuizMode;
  players: MusicQuizMultipleChoicePlayer[];
  current_round?: MusicQuizGuessTheSongRound | null;
}

export type MusicQuizGuessTheSongPublicState = MusicQuizGuessTheSongStateBase;

interface MusicQuizHitsterStateBase extends MusicQuizStateIdentity {
  quiz_type: "hitster";
  answer_type: "timeline";
  round_count: number;
  answer_duration: number;
  artist_bonus_mode: MusicQuizTimelineBonusMode;
  title_bonus_mode: MusicQuizTimelineBonusMode;
  mode: MusicQuizMode;
  players: MusicQuizTimelinePlayer[];
  current_round: MusicQuizHitsterRound | null;
}

export type MusicQuizHitsterPublicState = MusicQuizHitsterStateBase;

export type MusicQuizSupportedPublicState =
  | MusicQuizGuessTheSongPublicState
  | MusicQuizHitsterPublicState;

type MusicQuizMismatchedStateIdentity = {
  [TGame in MusicQuizType]: [
    Exclude<MusicQuizAnswerType, MusicQuizGameAnswerTypeMap[TGame]>,
  ] extends [never]
    ? never
    : MusicQuizStateIdentity<
        TGame,
        Exclude<MusicQuizAnswerType, MusicQuizGameAnswerTypeMap[TGame]>
      >;
}[MusicQuizType];

type MusicQuizFallbackState =
  | MusicQuizStateIdentity<MusicQuizUnsupportedType, MusicQuizRuntimeAnswerType>
  | MusicQuizStateIdentity<MusicQuizType, MusicQuizUnsupportedAnswerType>
  | MusicQuizMismatchedStateIdentity;

export type MusicQuizUnsupportedPublicState = MusicQuizFallbackState;

export type MusicQuizPublicState =
  | MusicQuizSupportedPublicState
  | MusicQuizUnsupportedPublicState;

export interface MusicQuizGuessTheSongPersonalizedState extends MusicQuizGuessTheSongStateBase {
  you: MusicQuizMultipleChoiceYou;
}

export type MusicQuizSupportedPersonalizedState =
  | MusicQuizGuessTheSongPersonalizedState
  | MusicQuizHitsterPersonalizedState;

export interface MusicQuizHitsterPersonalizedState extends MusicQuizHitsterStateBase {
  you: MusicQuizTimelineYou;
}

export type MusicQuizUnsupportedPersonalizedState =
  MusicQuizUnsupportedPublicState;

export type MusicQuizPersonalizedState =
  | MusicQuizSupportedPersonalizedState
  | MusicQuizUnsupportedPersonalizedState;

export interface MusicQuizGuessTheSongHostState extends MusicQuizGuessTheSongStateBase {
  created_at: number;
  sources: MusicQuizSource[];
  join_url: string;
  rounds: MusicQuizGuessTheSongRound[];
}

export interface MusicQuizHitsterHostState extends MusicQuizHitsterStateBase {
  created_at: number;
  sources: MusicQuizSource[];
  join_url: string;
  rounds: MusicQuizHitsterHostRound[];
}

export type MusicQuizSupportedHostState =
  | MusicQuizGuessTheSongHostState
  | MusicQuizHitsterHostState;

export type MusicQuizUnsupportedHostState = MusicQuizUnsupportedPublicState;

export type MusicQuizHostState =
  | MusicQuizSupportedHostState
  | MusicQuizUnsupportedHostState;

export interface MusicQuizGuessTheSongInfo extends MusicQuizStateIdentity {
  quiz_type: "guess_the_song";
  answer_type: "multiple_choice";
  player_count: number;
  round_count: number;
  mode: MusicQuizMode;
}

export interface MusicQuizHitsterInfo extends MusicQuizStateIdentity {
  quiz_type: "hitster";
  answer_type: "timeline";
  player_count: number;
  round_count: number;
  mode: MusicQuizMode;
}

export type MusicQuizSupportedInfo =
  | MusicQuizGuessTheSongInfo
  | MusicQuizHitsterInfo;

export type MusicQuizUnsupportedInfo = MusicQuizFallbackState;

export type MusicQuizInfo = MusicQuizSupportedInfo | MusicQuizUnsupportedInfo;

export interface MusicQuizPlayerBase {
  name: string;
  score: number;
  ready: boolean;
  answered: boolean;
  active_from_round?: number;
}

export interface MusicQuizMultipleChoicePlayer extends MusicQuizPlayerBase {
  last_answer?: MusicQuizMultipleChoicePlayerLastAnswer;
}

export interface MusicQuizTimelinePlayer extends MusicQuizPlayerBase {
  placed: boolean;
  artist_bonus_answered: boolean;
  title_bonus_answered: boolean;
  last_answer?: MusicQuizTimelinePlayerLastAnswer;
}

export type MusicQuizPlayer =
  | MusicQuizMultipleChoicePlayer
  | MusicQuizTimelinePlayer;

export interface MusicQuizMultipleChoicePlayerLastAnswer {
  suggestion_id: string;
  correct?: boolean;
  points?: number;
}

export interface MusicQuizTimelinePlacementResult {
  previous_entry_id: string | null;
  next_entry_id: string | null;
  correct: boolean;
  points: number;
}

export interface MusicQuizTimelineBonusResult {
  correct: boolean;
  points: number;
}

export interface MusicQuizTimelinePlayerLastAnswer {
  placement: MusicQuizTimelinePlacementResult;
  artist?: MusicQuizTimelineBonusResult;
  title?: MusicQuizTimelineBonusResult;
}

export type MusicQuizPlayerLastAnswer =
  | MusicQuizMultipleChoicePlayerLastAnswer
  | MusicQuizTimelinePlayerLastAnswer;

export interface MusicQuizYouBase {
  name: string;
  score: number;
  ready: boolean;
  active_from_round: number;
}

export interface MusicQuizMultipleChoiceYou extends MusicQuizYouBase {
  answer?: MusicQuizYourAnswer;
}

export interface MusicQuizYourAnswer {
  suggestion_id: string;
  answered_at: number;
  correct?: boolean;
  points?: number;
}

export interface MusicQuizTimelineYou extends MusicQuizYouBase {
  answer?: MusicQuizTimelineYourAnswer;
}

export interface MusicQuizTimelineBonusTextAnswer {
  action: "bonus_text";
  bonus_type: MusicQuizTimelineBonusType;
  value: string;
}

export interface MusicQuizTimelineBonusChoiceAnswer {
  action: "bonus_choice";
  bonus_type: MusicQuizTimelineBonusType;
  option_id: string;
}

export type MusicQuizTimelineBonusAnswer =
  | MusicQuizTimelineBonusTextAnswer
  | MusicQuizTimelineBonusChoiceAnswer;

export interface MusicQuizTimelineYourAnswer {
  previous_entry_id: string | null;
  next_entry_id: string | null;
  answered_at: number;
  bonuses: MusicQuizTimelineBonusAnswer[];
  finished: boolean;
  correct?: boolean;
  points?: number;
  bonus_results?: Array<
    MusicQuizTimelineBonusResult & {
      bonus_type: MusicQuizTimelineBonusType;
    }
  >;
}

export interface MusicQuizRoundBase {
  round_index: number;
  started_at: number | null;
  deadline: number;
  ended_at?: number;
}

export interface MusicQuizMultipleChoiceRound extends MusicQuizRoundBase {
  suggestions: MusicQuizSuggestion[];
  correct_suggestion_id?: string;
}

export interface MusicQuizGuessTheSongRound extends MusicQuizMultipleChoiceRound {
  question: string | null;
  answer_label?: string;
  track_uri?: string | null;
  image_url?: string | null;
  duration?: number | null;
}

export interface MusicQuizTimelineEntry {
  entry_id: string;
  release_year: number;
  title: string;
  artist: string;
  track_uri: string;
  image_url: string | null;
  is_anchor: boolean;
}

export interface MusicQuizTimelineBonusOption {
  option_id: string;
  label: string;
}

export interface MusicQuizTimelineFreeTextBonusDefinition {
  bonus_type: MusicQuizTimelineBonusType;
  mode: "free_text";
}

export interface MusicQuizTimelineMultipleChoiceBonusDefinition {
  bonus_type: MusicQuizTimelineBonusType;
  mode: "multiple_choice";
  options: MusicQuizTimelineBonusOption[];
}

export type MusicQuizTimelineBonusDefinition =
  | MusicQuizTimelineFreeTextBonusDefinition
  | MusicQuizTimelineMultipleChoiceBonusDefinition;

export interface MusicQuizHitsterRound extends MusicQuizRoundBase {
  question: null;
  timeline: MusicQuizTimelineEntry[];
  bonus_definitions: MusicQuizTimelineBonusDefinition[];
  revealed_entry?: MusicQuizTimelineEntry;
  answer_label?: string;
  track_uri?: string | null;
  image_url?: string | null;
  duration?: number | null;
}

export interface MusicQuizTimelineHostBonusOption extends MusicQuizTimelineBonusOption {
  is_correct: boolean;
}

export type MusicQuizTimelineHostBonusDefinition =
  | MusicQuizTimelineFreeTextBonusDefinition
  | {
      bonus_type: MusicQuizTimelineBonusType;
      mode: "multiple_choice";
      options: MusicQuizTimelineHostBonusOption[];
    };

export interface MusicQuizTimelineHostEntryCandidate {
  entry: MusicQuizTimelineEntry;
  artist_answers: string[];
  title_answers: string[];
}

export interface MusicQuizTimelineHostPlacement {
  previous_entry_id: string | null;
  next_entry_id: string | null;
  answered_at: number;
}

export type MusicQuizTimelineHostBonusAnswer = MusicQuizTimelineBonusAnswer & {
  submitted_at: number;
};

export interface MusicQuizTimelineHostResult {
  placement: {
    previous_entry_id: string | null;
    next_entry_id: string | null;
    is_correct: boolean;
    points: number;
  };
  bonuses: Array<{
    bonus_type: MusicQuizTimelineBonusType;
    is_correct: boolean;
    points: number;
  }>;
}

export interface MusicQuizHitsterHostRound {
  round_index: number;
  answer_label: string;
  placement_snapshot: MusicQuizTimelineEntry[];
  candidate: MusicQuizTimelineHostEntryCandidate;
  bonus_definitions: MusicQuizTimelineHostBonusDefinition[];
  placements: Record<string, MusicQuizTimelineHostPlacement>;
  bonus_answers: Record<string, MusicQuizTimelineHostBonusAnswer[]>;
  finished_at: Record<string, number>;
  results: Record<string, MusicQuizTimelineHostResult>;
  revealed: boolean;
  track_uri: string | null;
  question: string | null;
  image_url: string | null;
  duration: number | null;
  started_at: number | null;
  ended_at: number | null;
}

export type MusicQuizSupportedRound =
  | MusicQuizGuessTheSongRound
  | MusicQuizHitsterRound;
export type MusicQuizCurrentRound = MusicQuizSupportedRound;
export type MusicQuizRound = MusicQuizSupportedRound;

export interface MusicQuizSuggestion {
  suggestion_id: string;
  label: string;
}

export interface MusicQuizSource {
  uri: string;
  name: string;
  media_type: string | null;
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

export interface MusicQuizHitsterConfig {
  round_count: number;
  answer_duration: number;
  source_uris: string[];
  name?: string;
  artist_bonus_mode: MusicQuizTimelineBonusMode;
  title_bonus_mode: MusicQuizTimelineBonusMode;
}

export interface MusicQuizHitsterCreateRequest {
  quiz_type: "hitster";
  answer_type: "timeline";
  config: MusicQuizHitsterConfig;
}

export type MusicQuizCreateRequest =
  | MusicQuizGuessTheSongCreateRequest
  | MusicQuizHitsterCreateRequest;

export type MusicQuizProviderEvent =
  | { event: "game_updated"; state: MusicQuizPublicState }
  | { event: "game_removed"; state?: never };

export function isSupportedMusicQuiz<
  T extends MusicQuizInfo | MusicQuizPublicState,
>(
  value: T,
): value is Extract<
  T,
  | { quiz_type: "guess_the_song"; answer_type: "multiple_choice" }
  | { quiz_type: "hitster"; answer_type: "timeline" }
> {
  return (
    (value.quiz_type === "guess_the_song" &&
      value.answer_type === "multiple_choice") ||
    (value.quiz_type === "hitster" && value.answer_type === "timeline")
  );
}

export function parseMusicQuizType(value: string): MusicQuizRuntimeType {
  return value === "guess_the_song" || value === "hitster"
    ? value
    : (value as MusicQuizUnsupportedType);
}

export function parseMusicQuizAnswerType(
  value: string,
): MusicQuizRuntimeAnswerType {
  return value === "multiple_choice" || value === "timeline"
    ? value
    : (value as MusicQuizUnsupportedAnswerType);
}

export function isMusicQuizProviderEvent(
  value: unknown,
): value is MusicQuizProviderEvent {
  if (!value || typeof value !== "object" || !("event" in value)) return false;
  if (value.event === "game_removed") return !("state" in value);
  return (
    value.event === "game_updated" &&
    "state" in value &&
    !!value.state &&
    typeof value.state === "object"
  );
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
  return api.sendCommand<MusicQuizHostState | null>("music_quiz/get");
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

export function heartbeatMusicQuiz(player_id: string) {
  return api.sendCommand<boolean>("music_quiz/heartbeat", { player_id });
}

export function answerMusicQuiz(player_id: string, suggestion_id: string) {
  return api.sendCommand<MusicQuizPersonalizedState>("music_quiz/answer", {
    player_id,
    suggestion_id,
  });
}

export function submitMusicQuizAnswer(
  player_id: string,
  submission: MusicQuizTimelineSubmission,
) {
  return api.sendCommand<MusicQuizPersonalizedState>(
    "music_quiz/submit_answer",
    {
      player_id,
      submission,
    },
  );
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
