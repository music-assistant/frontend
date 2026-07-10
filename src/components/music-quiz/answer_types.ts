import MultipleChoiceHostAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceHostAnswer.vue";
import MultipleChoicePlayerAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePlayerAnswer.vue";
import MultipleChoicePresentAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePresentAnswer.vue";
import type { MusicQuizAnswerType } from "@/composables/useMusicQuiz";
import { markRaw, type Component } from "vue";

export interface MusicQuizAnswerTypeDefinition<
  TAnswer extends MusicQuizAnswerType = MusicQuizAnswerType,
> {
  id: TAnswer;
  adapters: {
    player: Component;
    host: Component;
    present: Component;
  };
}

type MusicQuizAnswerRegistry = {
  [TAnswer in MusicQuizAnswerType]: MusicQuizAnswerTypeDefinition<TAnswer>;
};

const MUSIC_QUIZ_ANSWER_TYPE_REGISTRY = {
  multiple_choice: {
    id: "multiple_choice",
    adapters: {
      player: markRaw(MultipleChoicePlayerAnswer),
      host: markRaw(MultipleChoiceHostAnswer),
      present: markRaw(MultipleChoicePresentAnswer),
    },
  },
} satisfies MusicQuizAnswerRegistry;

export const MUSIC_QUIZ_ANSWER_TYPES = Object.values(
  MUSIC_QUIZ_ANSWER_TYPE_REGISTRY,
);

export function getMusicQuizAnswerType(
  id: string,
): MusicQuizAnswerTypeDefinition | undefined {
  return MUSIC_QUIZ_ANSWER_TYPES.find((type) => type.id === id);
}
