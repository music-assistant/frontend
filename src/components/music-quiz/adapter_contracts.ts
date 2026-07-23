import type {
  MusicQuizAnswerSubmissionMap,
  MusicQuizAnswerType,
  MusicQuizCreateRequest,
  MusicQuizRoundBase,
  MusicQuizSupportedHostState,
  MusicQuizSupportedPersonalizedState,
  MusicQuizSupportedRound,
} from "@/composables/music-quiz/useMusicQuiz";
import type { MusicQuizLeaderboardRow } from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import type { VNode } from "vue";

export interface MusicQuizSetupAdapterProps {
  busy: boolean;
  includeSimilarMusic: boolean;
  sharedConfigValid?: boolean;
}

export interface MusicQuizSetupAdapterEmits {
  create: [request: MusicQuizCreateRequest];
}

export interface MusicQuizSetupAdapterSlots {
  "before-sources": () => VNode[];
}

export interface MusicQuizPlayerGameAdapterProps<
  TState extends MusicQuizSupportedPersonalizedState =
    MusicQuizSupportedPersonalizedState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> {
  state: TState;
  currentRound: TRound;
  busy: boolean;
}

export interface MusicQuizPlayerGameAdapterEmits {
  ready: [];
}

export interface MusicQuizHostPanelGameAdapterProps<
  TState extends MusicQuizSupportedHostState = MusicQuizSupportedHostState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> {
  state: TState;
  currentRound: TRound | null;
}

export interface MusicQuizHostGameAdapterProps<
  TState extends MusicQuizSupportedHostState = MusicQuizSupportedHostState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> {
  state: TState;
  currentRound: TRound;
}

export type MusicQuizPresentGameAdapterProps<
  TState extends MusicQuizSupportedHostState = MusicQuizSupportedHostState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> = MusicQuizHostGameAdapterProps<TState, TRound>;

export interface MusicQuizPresentBodyAdapterProps<
  TState extends MusicQuizSupportedHostState = MusicQuizSupportedHostState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> {
  state: TState;
  currentRound: TRound;
  leaderboardRows: MusicQuizLeaderboardRow[];
}

export interface MusicQuizPlayerAnswerAdapterProps<
  TState extends MusicQuizSupportedPersonalizedState =
    MusicQuizSupportedPersonalizedState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> {
  state: TState;
  currentRound: TRound;
  busy: boolean;
}

export interface MusicQuizPlayerAnswerAdapterEmits<
  TAnswer extends MusicQuizAnswerType = MusicQuizAnswerType,
> {
  submit: [submission: MusicQuizAnswerSubmissionMap[TAnswer]];
}

export interface MusicQuizHostAnswerAdapterProps<
  TState extends MusicQuizSupportedHostState = MusicQuizSupportedHostState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> {
  state: TState;
  currentRound: TRound;
}

export type MusicQuizPresentAnswerAdapterProps<
  TState extends MusicQuizSupportedHostState = MusicQuizSupportedHostState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> = MusicQuizHostAnswerAdapterProps<TState, TRound>;

export interface MusicQuizAnswerAdapterSlots {
  leaderboard: () => VNode[];
}
