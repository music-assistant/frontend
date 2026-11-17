import api from "@/plugins/api";
import { store } from "@/plugins/store";

export type MusicQuizPhase = "lobby" | "answering" | "reveal" | "finished";
export type MusicQuizMode = "venue" | "remote";
export type MusicQuizDifficulty = "easy" | "normal" | "hard";
export type MusicQuizHintSpeed = "slow" | "normal" | "fast";
export type MusicQuizTypoTolerance = "strict" | "normal" | "lenient";
export interface MusicQuizPlaybackOptions {
  default_playback_mode: MusicQuizMode;
  default_venue_player_id: string | null;
  venue_available: boolean;
  remote_available: boolean;
  venue_players: Array<{
    player_id: string;
    name: string;
  }>;
}

export interface MusicQuizHostPlayback {
  mode: MusicQuizMode;
  venue_player_id: string | null;
  venue_player_name: string | null;
}

export type MusicQuizTimelineBonusMode =
  "off" | "free_text" | "multiple_choice";
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

export interface MusicQuizHintTextGuessSubmission {
  answer_type: "hint_text";
  action: "guess_title" | "guess_artist";
  text: string;
}

export interface MusicQuizHintTextSkipArtistSubmission {
  answer_type: "hint_text";
  action: "skip_artist";
}

export type MusicQuizHintTextSubmission =
  MusicQuizHintTextGuessSubmission | MusicQuizHintTextSkipArtistSubmission;

// Title Reveal only offers the artist bonus as free text
export type MusicQuizTitleRevealArtistBonusMode = "off" | "free_text";

export type MusicQuizAnswerSubmissionMap = {
  multiple_choice: {
    answer_type: "multiple_choice";
    suggestion_id: string;
  };
  timeline: MusicQuizTimelineSubmission;
  hint_text: MusicQuizHintTextSubmission;
};

export type MusicQuizAnswerType = keyof MusicQuizAnswerSubmissionMap;
export type MusicQuizAnswerSubmission =
  MusicQuizAnswerSubmissionMap[MusicQuizAnswerType];

export type MusicQuizGameAnswerTypeMap = {
  guess_the_song: "multiple_choice";
  music_timeline: "timeline";
  trivia: "multiple_choice";
  title_reveal: "hint_text";
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
  MusicQuizAnswerType | MusicQuizUnsupportedAnswerType;

interface MusicQuizStateIdentity<
  TQuizType extends MusicQuizRuntimeType = MusicQuizRuntimeType,
  TAnswerType extends MusicQuizRuntimeAnswerType = MusicQuizRuntimeAnswerType,
> {
  quiz_type: TQuizType;
  answer_type: TAnswerType;
  phase: MusicQuizPhase;
  name: string | null;
  include_similar_music: boolean;
  auto_start_at: number | null;
  // public and host state only, and only once the server resolved it: until
  // then a display hides its join QR
  join_url?: string;
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
  preparing?: boolean;
}

export type MusicQuizGuessTheSongPublicState = MusicQuizGuessTheSongStateBase;

interface MusicQuizTimelineStateBase extends MusicQuizStateIdentity {
  quiz_type: "music_timeline";
  answer_type: "timeline";
  round_count: number;
  answer_duration: number;
  artist_bonus_mode: MusicQuizTimelineBonusMode;
  title_bonus_mode: MusicQuizTimelineBonusMode;
  mode: MusicQuizMode;
  players: MusicQuizTimelinePlayer[];
  current_round: MusicQuizTimelineRound | null;
  preparing?: boolean;
}

export type MusicQuizTimelinePublicState = MusicQuizTimelineStateBase;

interface MusicQuizTriviaStateBase extends MusicQuizStateIdentity {
  quiz_type: "trivia";
  answer_type: "multiple_choice";
  language: string;
  play_reveal_audio: boolean;
  round_count: number;
  suggestion_count: number;
  answer_duration: number;
  mode: MusicQuizMode;
  players: MusicQuizMultipleChoicePlayer[];
  current_round: MusicQuizTriviaRound | null;
  preparing?: boolean;
}

export type MusicQuizTriviaPublicState = MusicQuizTriviaStateBase;

interface MusicQuizTitleRevealStateBase extends MusicQuizStateIdentity {
  quiz_type: "title_reveal";
  answer_type: "hint_text";
  hint_speed: MusicQuizHintSpeed;
  typo_tolerance: MusicQuizTypoTolerance;
  artist_bonus_mode: MusicQuizTitleRevealArtistBonusMode;
  round_count: number;
  answer_duration: number;
  mode: MusicQuizMode;
  players: MusicQuizHintTextPlayer[];
  current_round: MusicQuizTitleRevealRound | null;
  preparing?: boolean;
}

export type MusicQuizTitleRevealPublicState = MusicQuizTitleRevealStateBase;

export type MusicQuizSupportedPublicState =
  | MusicQuizGuessTheSongPublicState
  | MusicQuizTimelinePublicState
  | MusicQuizTriviaPublicState
  | MusicQuizTitleRevealPublicState;

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
  MusicQuizSupportedPublicState | MusicQuizUnsupportedPublicState;

export interface MusicQuizGuessTheSongPersonalizedState extends MusicQuizGuessTheSongStateBase {
  you: MusicQuizMultipleChoiceYou;
}

export interface MusicQuizTriviaPersonalizedState extends MusicQuizTriviaStateBase {
  you: MusicQuizMultipleChoiceYou;
}

export type MusicQuizMultipleChoicePersonalizedState =
  MusicQuizGuessTheSongPersonalizedState | MusicQuizTriviaPersonalizedState;

export interface MusicQuizTitleRevealPersonalizedState extends MusicQuizTitleRevealStateBase {
  you: MusicQuizHintTextYou;
}

export type MusicQuizSupportedPersonalizedState =
  | MusicQuizGuessTheSongPersonalizedState
  | MusicQuizTimelinePersonalizedState
  | MusicQuizTriviaPersonalizedState
  | MusicQuizTitleRevealPersonalizedState;

export interface MusicQuizTimelinePersonalizedState extends MusicQuizTimelineStateBase {
  you: MusicQuizTimelineYou;
}

export type MusicQuizUnsupportedPersonalizedState =
  MusicQuizUnsupportedPublicState;

export type MusicQuizPersonalizedState =
  MusicQuizSupportedPersonalizedState | MusicQuizUnsupportedPersonalizedState;

export interface MusicQuizGuessTheSongHostState extends MusicQuizGuessTheSongStateBase {
  created_at: number;
  sources: MusicQuizSource[];
  join_url: string;
  rounds: MusicQuizGuessTheSongRound[];
  playback: MusicQuizHostPlayback;
}

export interface MusicQuizTimelineHostState extends MusicQuizTimelineStateBase {
  created_at: number;
  sources: MusicQuizSource[];
  join_url: string;
  rounds: MusicQuizTimelineHostRound[];
  playback: MusicQuizHostPlayback;
}

export interface MusicQuizTriviaHostState extends MusicQuizTriviaStateBase {
  created_at: number;
  sources: MusicQuizSource[];
  join_url: string;
  rounds: MusicQuizTriviaHostRound[];
  playback: MusicQuizHostPlayback;
}

export interface MusicQuizTitleRevealHostState extends MusicQuizTitleRevealStateBase {
  created_at: number;
  sources: MusicQuizSource[];
  join_url: string;
  rounds: MusicQuizTitleRevealHostRound[];
  playback: MusicQuizHostPlayback;
}

export type MusicQuizMultipleChoicePublicState =
  MusicQuizGuessTheSongPublicState | MusicQuizTriviaPublicState;

export type MusicQuizMultipleChoiceHostState =
  MusicQuizGuessTheSongHostState | MusicQuizTriviaHostState;

export type MusicQuizSupportedHostState =
  | MusicQuizGuessTheSongHostState
  | MusicQuizTimelineHostState
  | MusicQuizTriviaHostState
  | MusicQuizTitleRevealHostState;

export type MusicQuizUnsupportedHostState = MusicQuizUnsupportedPublicState & {
  playback: MusicQuizHostPlayback;
};

export type MusicQuizHostState =
  MusicQuizSupportedHostState | MusicQuizUnsupportedHostState;

export interface MusicQuizGuessTheSongInfo extends MusicQuizStateIdentity {
  quiz_type: "guess_the_song";
  answer_type: "multiple_choice";
  player_count: number;
  round_count: number;
  mode: MusicQuizMode;
}

export interface MusicQuizTimelineInfo extends MusicQuizStateIdentity {
  quiz_type: "music_timeline";
  answer_type: "timeline";
  player_count: number;
  round_count: number;
  mode: MusicQuizMode;
}

export interface MusicQuizTriviaInfo extends MusicQuizStateIdentity {
  quiz_type: "trivia";
  answer_type: "multiple_choice";
  language: string;
  play_reveal_audio: boolean;
  player_count: number;
  round_count: number;
  mode: MusicQuizMode;
}

export interface MusicQuizTitleRevealInfo extends MusicQuizStateIdentity {
  quiz_type: "title_reveal";
  answer_type: "hint_text";
  player_count: number;
  round_count: number;
  mode: MusicQuizMode;
}

export type MusicQuizSupportedInfo =
  | MusicQuizGuessTheSongInfo
  | MusicQuizTimelineInfo
  | MusicQuizTriviaInfo
  | MusicQuizTitleRevealInfo;

export type MusicQuizUnsupportedInfo = MusicQuizFallbackState;

export type MusicQuizInfo = MusicQuizSupportedInfo | MusicQuizUnsupportedInfo;

export interface MusicQuizPlayerBase {
  name: string;
  score: number;
  ready: boolean;
  answered: boolean;
  active_from_round: number;
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

export interface MusicQuizHintTextPlayer extends MusicQuizPlayerBase {
  // 1-based position among the players who guessed correctly, null until solved
  solved_rank: number | null;
  last_answer?: MusicQuizHintTextPlayerLastAnswer;
}

export type MusicQuizPlayer =
  | MusicQuizMultipleChoicePlayer
  | MusicQuizTimelinePlayer
  | MusicQuizHintTextPlayer;

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

export interface MusicQuizHintTextPlayerLastAnswer {
  correct: boolean;
  // total including the first-guess and artist bonuses
  points: number;
}

export type MusicQuizPlayerLastAnswer =
  | MusicQuizMultipleChoicePlayerLastAnswer
  | MusicQuizTimelinePlayerLastAnswer
  | MusicQuizHintTextPlayerLastAnswer;

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

export interface MusicQuizHintTextGuess {
  text: string;
  correct: boolean;
  close: boolean;
}

export interface MusicQuizHintTextArtistBonus {
  done: boolean;
  // set once the bonus is answered or skipped; guess stays null when skipped
  guess?: string | null;
  correct?: boolean;
  points?: number;
  artist?: string | null;
}

export interface MusicQuizHintTextYou extends MusicQuizYouBase {
  guesses?: MusicQuizHintTextGuess[];
  attempts_left?: number;
  solved?: boolean;
  solution?: string;
  // total including the first-guess and artist bonuses
  points?: number;
  title_points?: number;
  first_bonus?: number;
  artist_bonus?: MusicQuizHintTextArtistBonus;
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
  MusicQuizTimelineBonusTextAnswer | MusicQuizTimelineBonusChoiceAnswer;

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
  // when the round's track became audible; anything that follows the audio
  // (e.g. synced lyrics) should prefer this over started_at
  audio_started_at?: number | null;
  deadline: number;
  auto_advance_at: number | null;
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

export interface MusicQuizTriviaRound extends MusicQuizMultipleChoiceRound {
  question: string;
  answer_label?: string;
  track_uri?: string | null;
  image_url?: null;
  duration?: null;
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

export interface MusicQuizTimelineRound extends MusicQuizRoundBase {
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

export interface MusicQuizTimelineHostRound {
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
  auto_advance_at: number | null;
}

export interface MusicQuizTriviaHostRound {
  round_index: number;
  answer_label: string;
  suggestions: MusicQuizSuggestion[];
  correct_suggestion_id: string;
  track_uri: string | null;
  question: string;
  image_url: null;
  duration: null;
  started_at: number | null;
  ended_at: number | null;
  auto_advance_at: number | null;
}

// unrevealed letters are null; spaces and punctuation are always included
export type MusicQuizHintTextMask = Array<string | null>;

export interface MusicQuizHintTextRound extends MusicQuizRoundBase {
  mask: MusicQuizHintTextMask;
  revealed_count: number;
  hint_count: number;
  allowed_typos: number;
  artist_bonus: boolean;
  solution?: string;
}

export interface MusicQuizTitleRevealRound extends MusicQuizHintTextRound {
  question: null;
  answer_label?: string;
  track_uri?: string | null;
  image_url?: string | null;
  duration?: number | null;
}

export interface MusicQuizHintTextHostAttempt {
  text: string;
  submitted_at: number;
  correct: boolean;
  close: boolean;
}

export interface MusicQuizHintTextHostSolve {
  solved_at: number;
  points: number;
  first_bonus: number;
  artist_done: boolean;
  artist_guess: string | null;
  artist_correct: boolean;
  artist_points: number;
  total_points: number;
}

export interface MusicQuizTitleRevealHostRound {
  round_index: number;
  answer_label: string;
  solution: string;
  allowed_typos: number;
  mask: MusicQuizHintTextMask;
  revealed_count: number;
  hint_count: number;
  hint_times: number[];
  attempts: Record<string, MusicQuizHintTextHostAttempt[]>;
  artist_answers: string[];
  solves: Record<string, MusicQuizHintTextHostSolve>;
  track_uri: string | null;
  question: null;
  image_url: string | null;
  duration: number | null;
  started_at: number | null;
  ended_at: number | null;
  auto_advance_at: number | null;
}

export type MusicQuizSupportedRound =
  | MusicQuizGuessTheSongRound
  | MusicQuizTimelineRound
  | MusicQuizTriviaRound
  | MusicQuizTitleRevealRound;
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

export interface MusicQuizSharedConfig {
  include_similar_music: boolean;
}

export interface MusicQuizPlaybackCreateFields {
  playback_mode?: MusicQuizMode | null;
  venue_player_id?: string | null;
}

export interface MusicQuizGuessTheSongConfig extends MusicQuizSharedConfig {
  round_count: number;
  suggestion_count: number;
  answer_duration: number;
  difficulty: MusicQuizDifficulty;
  source_uris: string[];
  name?: string;
}

export interface MusicQuizGuessTheSongCreateRequest extends MusicQuizPlaybackCreateFields {
  quiz_type: "guess_the_song";
  answer_type: "multiple_choice";
  config: MusicQuizGuessTheSongConfig;
}

export interface MusicQuizTimelineConfig extends MusicQuizSharedConfig {
  round_count: number;
  answer_duration: number;
  source_uris: string[];
  name?: string;
  artist_bonus_mode: MusicQuizTimelineBonusMode;
  title_bonus_mode: MusicQuizTimelineBonusMode;
}

export interface MusicQuizTimelineCreateRequest extends MusicQuizPlaybackCreateFields {
  quiz_type: "music_timeline";
  answer_type: "timeline";
  config: MusicQuizTimelineConfig;
}

export interface MusicQuizTriviaConfig extends MusicQuizSharedConfig {
  language: string;
  play_reveal_audio: boolean;
  round_count: number;
  suggestion_count: number;
  answer_duration: number;
  difficulty: MusicQuizDifficulty;
  source_uris: string[];
  name?: string;
}

export interface MusicQuizTriviaCreateRequest extends MusicQuizPlaybackCreateFields {
  quiz_type: "trivia";
  answer_type: "multiple_choice";
  config: MusicQuizTriviaConfig;
}

export interface MusicQuizTitleRevealConfig extends MusicQuizSharedConfig {
  round_count: number;
  answer_duration: number;
  hint_speed: MusicQuizHintSpeed;
  typo_tolerance: MusicQuizTypoTolerance;
  artist_bonus_mode: MusicQuizTitleRevealArtistBonusMode;
  source_uris: string[];
  name?: string;
}

export interface MusicQuizTitleRevealCreateRequest extends MusicQuizPlaybackCreateFields {
  quiz_type: "title_reveal";
  answer_type: "hint_text";
  config: MusicQuizTitleRevealConfig;
}

export type MusicQuizCreateRequest =
  | MusicQuizGuessTheSongCreateRequest
  | MusicQuizTimelineCreateRequest
  | MusicQuizTriviaCreateRequest
  | MusicQuizTitleRevealCreateRequest;

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
  | { quiz_type: "music_timeline"; answer_type: "timeline" }
  | { quiz_type: "trivia"; answer_type: "multiple_choice" }
  | { quiz_type: "title_reveal"; answer_type: "hint_text" }
> {
  return (
    (value.quiz_type === "guess_the_song" &&
      value.answer_type === "multiple_choice") ||
    (value.quiz_type === "music_timeline" &&
      value.answer_type === "timeline") ||
    (value.quiz_type === "trivia" && value.answer_type === "multiple_choice") ||
    (value.quiz_type === "title_reveal" && value.answer_type === "hint_text")
  );
}

export function parseMusicQuizType(value: string): MusicQuizRuntimeType {
  if (
    value === "guess_the_song" ||
    value === "music_timeline" ||
    value === "trivia" ||
    value === "title_reveal"
  ) {
    return value;
  }
  return value as MusicQuizUnsupportedType;
}

export function parseMusicQuizAnswerType(
  value: string,
): MusicQuizRuntimeAnswerType {
  return value === "multiple_choice" ||
    value === "timeline" ||
    value === "hint_text"
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
  const { quiz_type, config, playback_mode, venue_player_id } = request;
  return api.sendCommand<MusicQuizHostState>("music_quiz/create", {
    quiz_type,
    ...config,
    ...(playback_mode !== undefined ? { playback_mode } : {}),
    ...(venue_player_id !== undefined ? { venue_player_id } : {}),
  });
}

export function getMusicQuiz() {
  return api.sendCommand<MusicQuizHostState | null>("music_quiz/get");
}

export function getAvailableMusicQuizTypes() {
  return api.sendCommand<string[]>("music_quiz/available_quiz_types");
}

export function getMusicQuizPlaybackOptions() {
  return api.sendCommand<MusicQuizPlaybackOptions>(
    "music_quiz/playback_options",
  );
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

export function resetMusicQuiz(autoStart = false) {
  return autoStart
    ? api.sendCommand<MusicQuizHostState>("music_quiz/reset", {
        auto_start: true,
      })
    : api.sendCommand<MusicQuizHostState>("music_quiz/reset");
}

export function deleteMusicQuiz() {
  return api.sendCommand<null>("music_quiz/delete");
}

// Participant game commands (available to any authenticated user)
export function getMusicQuizInfo(): Promise<MusicQuizInfo | null> {
  // Without the music_quiz provider loaded on the server, the command isn't
  // even registered ("Invalid or unsupported command") — and there can be no
  // active quiz, so don't bother the server.
  if (!store.enabledPlugins.has("music_quiz")) return Promise.resolve(null);
  // Callers handle failures locally, so skip the global error toast.
  return api.sendCommand<MusicQuizInfo | null>("music_quiz/info", undefined, {
    suppressGlobalError: true,
  });
}

export function getMusicQuizPublicState(): Promise<MusicQuizPublicState | null> {
  // Without the music_quiz provider loaded the command isn't registered, and there
  // can be no active quiz either — so don't bother the server.
  if (!store.enabledPlugins.has("music_quiz")) return Promise.resolve(null);
  // A kiosk display has nowhere to show a toast; callers handle failures locally.
  return api.sendCommand<MusicQuizPublicState | null>(
    "music_quiz/public_state",
    undefined,
    { suppressGlobalError: true },
  );
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
  submission: Exclude<
    MusicQuizAnswerSubmission,
    MusicQuizAnswerSubmissionMap["multiple_choice"]
  >,
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

// Listen-in commands (Scope.PLAYERS_CONTROL)
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
