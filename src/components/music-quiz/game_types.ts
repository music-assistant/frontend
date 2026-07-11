import {
  getMusicQuizAnswerType,
  type MusicQuizAnswerTypeDefinition,
} from "@/components/music-quiz/answer_types";
import GuessTheSongHostPanel from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongHostPanel.vue";
import GuessTheSongHostRound from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongHostRound.vue";
import GuessTheSongPlayerRound from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongPlayerRound.vue";
import GuessTheSongPresentRound from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongPresentRound.vue";
import GuessTheSongSetup from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongSetup.vue";
import HitsterHostPanel from "@/components/music-quiz/game-types/hitster/HitsterHostPanel.vue";
import HitsterHostRound from "@/components/music-quiz/game-types/hitster/HitsterHostRound.vue";
import HitsterPlayerRound from "@/components/music-quiz/game-types/hitster/HitsterPlayerRound.vue";
import HitsterPresentRound from "@/components/music-quiz/game-types/hitster/HitsterPresentRound.vue";
import HitsterSetup from "@/components/music-quiz/game-types/hitster/HitsterSetup.vue";
import TriviaHostPanel from "@/components/music-quiz/game-types/trivia/TriviaHostPanel.vue";
import TriviaHostRound from "@/components/music-quiz/game-types/trivia/TriviaHostRound.vue";
import TriviaPlayerRound from "@/components/music-quiz/game-types/trivia/TriviaPlayerRound.vue";
import TriviaPresentRound from "@/components/music-quiz/game-types/trivia/TriviaPresentRound.vue";
import TriviaSetup from "@/components/music-quiz/game-types/trivia/TriviaSetup.vue";
import type {
  MusicQuizGameAnswerTypeMap,
  MusicQuizType,
} from "@/composables/useMusicQuiz";
import { BrainCircuit, Disc3, ListMusic } from "@lucide/vue";
import { markRaw, type Component } from "vue";

export const DEFAULT_MUSIC_QUIZ_GAME_TYPE: MusicQuizType = "guess_the_song";

export interface MusicQuizGameDefinition<
  TGame extends MusicQuizType = MusicQuizType,
> {
  id: TGame;
  answerType: MusicQuizGameAnswerTypeMap[TGame];
  labelKey: string;
  descriptionKey: string;
  icon: Component;
  availability: "always" | "server";
  supportsListenIn: boolean;
  adapters: {
    setup: Component;
    player: Component;
    hostPanel: Component;
    host: Component;
    present: Component;
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
    availability: "always",
    supportsListenIn: true,
    adapters: {
      setup: markRaw(GuessTheSongSetup),
      player: markRaw(GuessTheSongPlayerRound),
      hostPanel: markRaw(GuessTheSongHostPanel),
      host: markRaw(GuessTheSongHostRound),
      present: markRaw(GuessTheSongPresentRound),
    },
  },
  hitster: {
    id: "hitster",
    answerType: "timeline",
    labelKey: "providers.music_quiz.game_type_hitster",
    descriptionKey: "providers.music_quiz.game_type_hitster_description",
    icon: markRaw(ListMusic),
    availability: "always",
    supportsListenIn: true,
    adapters: {
      setup: markRaw(HitsterSetup),
      player: markRaw(HitsterPlayerRound),
      hostPanel: markRaw(HitsterHostPanel),
      host: markRaw(HitsterHostRound),
      present: markRaw(HitsterPresentRound),
    },
  },
  trivia: {
    id: "trivia",
    answerType: "multiple_choice",
    labelKey: "providers.music_quiz.game_type_trivia",
    descriptionKey: "providers.music_quiz.game_type_trivia_description",
    icon: markRaw(BrainCircuit),
    availability: "server",
    supportsListenIn: false,
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
