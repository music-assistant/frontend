import MultipleChoiceGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceGrid.vue";
import MultipleChoicePlayerAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePlayerAnswer.vue";
import TriviaHostPanel from "@/components/music-quiz/game-types/trivia/TriviaHostPanel.vue";
import TriviaHostRound from "@/components/music-quiz/game-types/trivia/TriviaHostRound.vue";
import TriviaPlayerRound from "@/components/music-quiz/game-types/trivia/TriviaPlayerRound.vue";
import TriviaPresentRound from "@/components/music-quiz/game-types/trivia/TriviaPresentRound.vue";
import type {
  MusicQuizTriviaHostState,
  MusicQuizTriviaPersonalizedState,
  MusicQuizTriviaRound,
} from "@/composables/useMusicQuiz";
import { mount, shallowMount } from "@vue/test-utils";
import type { Component } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

const answeringRound = {
  question: "Which artist released the album Discovery?",
  round_index: 0,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  auto_advance_at: null,
  suggestions: [
    { suggestion_id: "daft-punk", label: "Daft Punk" },
    { suggestion_id: "air", label: "Air" },
  ],
} satisfies MusicQuizTriviaRound;

const revealRound = {
  ...answeringRound,
  answer_label: "Daft Punk",
  correct_suggestion_id: "daft-punk",
  track_uri: null,
  image_url: null,
  duration: null,
  ended_at: 20,
} satisfies MusicQuizTriviaRound;

const playerState = {
  quiz_type: "trivia",
  answer_type: "multiple_choice",
  language: "en",
  phase: "answering",
  name: "Music Trivia",
  round_count: 1,
  suggestion_count: 2,
  answer_duration: 30,
  mode: "venue",
  players: [],
  current_round: answeringRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizTriviaPersonalizedState;

const hostState = {
  ...playerState,
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [],
} satisfies MusicQuizTriviaHostState;

const triviaSurfaces: Array<{
  name: string;
  component: Component;
  state: MusicQuizTriviaPersonalizedState | MusicQuizTriviaHostState;
}> = [
  { name: "player", component: TriviaPlayerRound, state: playerState },
  { name: "host", component: TriviaHostRound, state: hostState },
  { name: "present", component: TriviaPresentRound, state: hostState },
];

describe("Trivia adapters", () => {
  it("shows the canonical server language after a host state refresh", async () => {
    const wrapper = mount(TriviaHostPanel, {
      props: {
        state: { ...hostState, language: "pt-BR" },
        currentRound: hostState.current_round,
      },
    });

    expect(wrapper.get('[data-testid="trivia-language"]').text()).toBe(
      "Brazilian Portuguese",
    );

    await wrapper.setProps({
      state: { ...hostState, language: "sr-Latn" },
    });
    expect(wrapper.get('[data-testid="trivia-language"]').text()).toBe(
      "Serbian (Latin)",
    );
  });

  it.each(triviaSurfaces)(
    "shows the server question in the $name state",
    ({ component, state }) => {
      const wrapper = mount(component, {
        props: {
          state,
          currentRound: answeringRound,
          busy: false,
        },
      });

      expect(wrapper.get('[data-testid="trivia-question"]').text()).toBe(
        answeringRound.question,
      );
      expect(wrapper.find('[data-testid="trivia-answer"]').exists()).toBe(
        false,
      );
      expect(wrapper.find("audio").exists()).toBe(false);
      expect(wrapper.text()).not.toContain("providers.music_quiz.now_playing");
      wrapper.unmount();
    },
  );

  it.each(triviaSurfaces)(
    "shows the server answer in the $name reveal",
    ({ component, state: baseState }) => {
      const state: MusicQuizTriviaPersonalizedState | MusicQuizTriviaHostState =
        {
          ...baseState,
          phase: "reveal",
          current_round: revealRound,
        };
      const wrapper = mount(component, {
        props: {
          state,
          currentRound: revealRound,
          busy: false,
        },
      });

      expect(wrapper.get('[data-testid="trivia-question"]').text()).toBe(
        revealRound.question,
      );
      expect(wrapper.get('[data-testid="trivia-answer"]').text()).toBe(
        revealRound.answer_label,
      );
      wrapper.unmount();
    },
  );

  it("uses the shared multiple-choice submission and reveal result", () => {
    const answerWrapper = shallowMount(MultipleChoicePlayerAnswer, {
      props: {
        state: playerState,
        currentRound: answeringRound,
        busy: false,
      },
    });

    answerWrapper
      .getComponent(MultipleChoiceGrid)
      .vm.$emit("select", "daft-punk");
    expect(answerWrapper.emitted("submit")).toEqual([
      [
        {
          answer_type: "multiple_choice",
          suggestion_id: "daft-punk",
        },
      ],
    ]);

    const revealState = {
      ...playerState,
      phase: "reveal",
      current_round: revealRound,
      you: {
        ...playerState.you,
        answer: {
          suggestion_id: "daft-punk",
          answered_at: 10,
          correct: true,
          points: 10,
        },
      },
    } satisfies MusicQuizTriviaPersonalizedState;
    const revealWrapper = shallowMount(MultipleChoicePlayerAnswer, {
      props: {
        state: revealState,
        currentRound: revealRound,
        busy: false,
      },
    });

    expect(revealWrapper.text()).toContain("providers.music_quiz.correct");
    expect(revealWrapper.text()).toContain("+10");
  });
});
