import type {
  MusicQuizAnswerSubmissionMap,
  MusicQuizAnswerType,
  MusicQuizCreateRequest,
  MusicQuizRoundBase,
  MusicQuizSupportedHostState,
  MusicQuizSupportedPersonalizedState,
  MusicQuizSupportedPublicState,
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

// Present adapters render the guest-safe public state: the dashboard feeds them
// music_quiz/public_state, and host state is a superset so host callers still fit.
export interface MusicQuizPresentGameAdapterProps<
  TState extends MusicQuizSupportedPublicState = MusicQuizSupportedPublicState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> {
  state: TState;
  currentRound: TRound;
}

export interface MusicQuizPresentBodyAdapterProps<
  TState extends MusicQuizSupportedPublicState = MusicQuizSupportedPublicState,
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

export interface MusicQuizPresentAnswerAdapterProps<
  TState extends MusicQuizSupportedPublicState = MusicQuizSupportedPublicState,
  TRound extends MusicQuizRoundBase = MusicQuizSupportedRound,
> {
  state: TState;
  currentRound: TRound;
}

export interface MusicQuizAnswerAdapterSlots {
  leaderboard: () => VNode[];
}
