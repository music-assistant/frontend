import {
  getMusicQuizAnswerType,
  type MusicQuizAnswerTypeDefinition,
} from "@/components/music-quiz/answer_types";
import GuessTheSongHostPanel from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongHostPanel.vue";
import GuessTheSongHostRound from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongHostRound.vue";
import GuessTheSongPlayerRound from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongPlayerRound.vue";
import GuessTheSongPresentRound from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongPresentRound.vue";
import GuessTheSongSetup from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongSetup.vue";
import MusicTimelineHostPanel from "@/components/music-quiz/game-types/music-timeline/MusicTimelineHostPanel.vue";
import MusicTimelineHostRound from "@/components/music-quiz/game-types/music-timeline/MusicTimelineHostRound.vue";
import MusicTimelinePlayerRound from "@/components/music-quiz/game-types/music-timeline/MusicTimelinePlayerRound.vue";
import MusicTimelinePresentBody from "@/components/music-quiz/game-types/music-timeline/MusicTimelinePresentBody.vue";
import MusicTimelinePresentRound from "@/components/music-quiz/game-types/music-timeline/MusicTimelinePresentRound.vue";
import MusicTimelineSetup from "@/components/music-quiz/game-types/music-timeline/MusicTimelineSetup.vue";
import TriviaHostPanel from "@/components/music-quiz/game-types/trivia/TriviaHostPanel.vue";
import TriviaHostRound from "@/components/music-quiz/game-types/trivia/TriviaHostRound.vue";
import TriviaPlayerRound from "@/components/music-quiz/game-types/trivia/TriviaPlayerRound.vue";
import TriviaPresentRound from "@/components/music-quiz/game-types/trivia/TriviaPresentRound.vue";
import TriviaSetup from "@/components/music-quiz/game-types/trivia/TriviaSetup.vue";
import type {
  MusicQuizGameAnswerTypeMap,
  MusicQuizPhase,
  MusicQuizSupportedInfo,
  MusicQuizSupportedPublicState,
  MusicQuizType,
} from "@/composables/useMusicQuiz";
import { Brain, Disc3, ListMusic } from "@lucide/vue";
import { markRaw, type Component } from "vue";

export const DEFAULT_MUSIC_QUIZ_GAME_TYPE: MusicQuizType = "guess_the_song";

export type MusicQuizCapabilityState =
  | MusicQuizSupportedInfo
  | MusicQuizSupportedPublicState;

export type MusicQuizStateCapability =
  | boolean
  | ((state: MusicQuizCapabilityState) => boolean);

export interface MusicQuizGameDefinition<
  TGame extends MusicQuizType = MusicQuizType,
> {
  id: TGame;
  answerType: MusicQuizGameAnswerTypeMap[TGame];
  labelKey: string;
  descriptionKey: string;
  icon: Component;
  requiresBackendAvailability: boolean;
  supportsListenIn: MusicQuizStateCapability;
  usesRevealCountdown?: boolean;
  revealPhaseLabelKey: string;
  adapters: {
    setup: Component;
    player: Component;
    hostPanel: Component;
    host: Component;
    present: Component;
    presentBody?: Component;
  };
}

type MusicQuizGameRegistry = {
  [TGame in MusicQuizType]: MusicQuizGameDefinition<TGame>;
};

const MUSIC_QUIZ_GAME_TYPE_REGISTRY = {
  guess_the_song: {
    id: "guess_the_song",
    answerType: "multiple_choice",
    labelKey: "providers.music_quiz.game_type_guess_the_song",
    descriptionKey: "providers.music_quiz.game_type_guess_the_song_description",
    icon: markRaw(Disc3),
    requiresBackendAvailability: false,
    supportsListenIn: true,
    revealPhaseLabelKey: "providers.music_quiz.phase_enjoy_track",
    adapters: {
      setup: markRaw(GuessTheSongSetup),
      player: markRaw(GuessTheSongPlayerRound),
      hostPanel: markRaw(GuessTheSongHostPanel),
      host: markRaw(GuessTheSongHostRound),
      present: markRaw(GuessTheSongPresentRound),
    },
  },
  music_timeline: {
    id: "music_timeline",
    answerType: "timeline",
    labelKey: "providers.music_quiz.game_type_music_timeline",
    descriptionKey: "providers.music_quiz.game_type_music_timeline_description",
    icon: markRaw(ListMusic),
    requiresBackendAvailability: false,
    supportsListenIn: true,
    revealPhaseLabelKey: "providers.music_quiz.phase_enjoy_track",
    adapters: {
      setup: markRaw(MusicTimelineSetup),
      player: markRaw(MusicTimelinePlayerRound),
      hostPanel: markRaw(MusicTimelineHostPanel),
      host: markRaw(MusicTimelineHostRound),
      present: markRaw(MusicTimelinePresentRound),
      presentBody: markRaw(MusicTimelinePresentBody),
    },
  },
  trivia: {
    id: "trivia",
    answerType: "multiple_choice",
    labelKey: "providers.music_quiz.game_type_trivia",
    descriptionKey: "providers.music_quiz.game_type_trivia_description",
    icon: markRaw(Brain),
    requiresBackendAvailability: true,
    supportsListenIn: (state) =>
      state.quiz_type === "trivia" && state.play_reveal_audio === true,
    usesRevealCountdown: true,
    revealPhaseLabelKey: "providers.music_quiz.phase_answer_revealed",
    adapters: {
      setup: markRaw(TriviaSetup),
      player: markRaw(TriviaPlayerRound),
      hostPanel: markRaw(TriviaHostPanel),
      host: markRaw(TriviaHostRound),
      present: markRaw(TriviaPresentRound),
    },
  },
} satisfies MusicQuizGameRegistry;

export const MUSIC_QUIZ_GAME_TYPES: MusicQuizGameDefinition[] = Object.values(
  MUSIC_QUIZ_GAME_TYPE_REGISTRY,
);

export function getMusicQuizGameType(
  id: string,
): MusicQuizGameDefinition | undefined {
  return MUSIC_QUIZ_GAME_TYPES.find((type) => type.id === id);
}

export function isMusicQuizGameAvailable(
  game: MusicQuizGameDefinition,
  availableQuizTypes: string[],
) {
  return (
    !game.requiresBackendAvailability || availableQuizTypes.includes(game.id)
  );
}

export function supportsMusicQuizListenIn(
  game: MusicQuizGameDefinition,
  state?: MusicQuizCapabilityState | null,
) {
  return typeof game.supportsListenIn === "boolean"
    ? game.supportsListenIn
    : state != null && game.supportsListenIn(state);
}

export function getMusicQuizPhaseLabelKey(
  game: MusicQuizGameDefinition,
  phase: MusicQuizPhase,
) {
  if (phase === "lobby")
    return "providers.music_quiz.phase_waiting_for_players";
  if (phase === "answering") return "providers.music_quiz.phase_answers_open";
  if (phase === "reveal") return game.revealPhaseLabelKey;
  return "providers.music_quiz.phase_finished";
}

export interface ResolvedMusicQuizDefinition {
  game: MusicQuizGameDefinition;
  answer: MusicQuizAnswerTypeDefinition;
}

export function resolveMusicQuizDefinition(
  quizType: string,
  answerType: string,
): ResolvedMusicQuizDefinition | undefined {
  const game = getMusicQuizGameType(quizType);
  if (!game || game.answerType !== answerType) return undefined;

  const answer = getMusicQuizAnswerType(answerType);
  return answer ? { game, answer } : undefined;
}
