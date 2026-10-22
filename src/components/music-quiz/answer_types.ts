import MultipleChoiceHostAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceHostAnswer.vue";
import MultipleChoicePlayerAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePlayerAnswer.vue";
import MultipleChoicePresentAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePresentAnswer.vue";
import TimelineHostAnswer from "@/components/music-quiz/answer-types/timeline/TimelineHostAnswer.vue";
import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import TimelinePresentAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePresentAnswer.vue";
import type { MusicQuizAnswerType } from "@/composables/music-quiz/useMusicQuiz";
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
  timeline: {
    id: "timeline",
    adapters: {
      player: markRaw(TimelinePlayerAnswer),
      host: markRaw(TimelineHostAnswer),
      present: markRaw(TimelinePresentAnswer),
    },
  },
} satisfies MusicQuizAnswerRegistry;

export const MUSIC_QUIZ_ANSWER_TYPES: MusicQuizAnswerTypeDefinition[] =
  Object.values(MUSIC_QUIZ_ANSWER_TYPE_REGISTRY);

export function getMusicQuizAnswerType(
  id: string,
): MusicQuizAnswerTypeDefinition | undefined {
  return MUSIC_QUIZ_ANSWER_TYPES.find((type) => type.id === id);
}
