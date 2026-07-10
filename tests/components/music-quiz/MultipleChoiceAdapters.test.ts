import MultipleChoiceGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceGrid.vue";
import MultipleChoiceHostAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceHostAnswer.vue";
import MultipleChoicePlayerAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePlayerAnswer.vue";
import MultipleChoiceProgress from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceProgress.vue";
import type {
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
} from "@/composables/useMusicQuiz";
import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const currentRound = {
  question: "Which song is playing?",
  round_index: 1,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  suggestions: [
    { suggestion_id: "one", label: "One" },
    { suggestion_id: "two", label: "Two" },
  ],
} satisfies MusicQuizGuessTheSongRound;

const playerState = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "answering",
  name: "Quiz",
  round_count: 5,
  suggestion_count: 2,
  answer_duration: 30,
  mode: "venue",
  players: [
    {
      name: "Player",
      score: 0,
      ready: false,
      answered: false,
      active_from_round: 0,
    },
  ],
  current_round: currentRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizGuessTheSongPersonalizedState;

describe("multiple-choice adapters", () => {
  it("emits a discriminated submission", () => {
    const wrapper = shallowMount(MultipleChoicePlayerAnswer, {
      props: {
        state: playerState,
        currentRound,
        busy: false,
      },
    });

    wrapper.getComponent(MultipleChoiceGrid).vm.$emit("select", "two");

    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          answer_type: "multiple_choice",
          suggestion_id: "two",
        },
      ],
    ]);
    wrapper.unmount();
  });

  it("restores the server-selected answer and locks the grid", () => {
    const state = {
      ...playerState,
      you: {
        ...playerState.you,
        answer: {
          suggestion_id: "two",
          answered_at: 10,
        },
      },
    } satisfies MusicQuizGuessTheSongPersonalizedState;

    const wrapper = shallowMount(MultipleChoicePlayerAnswer, {
      props: {
        state,
        currentRound,
        busy: false,
      },
    });
    const grid = wrapper.getComponent(MultipleChoiceGrid);

    expect(grid.props("disabled")).toBe(true);
    expect(grid.props("selectedSuggestionId")).toBe("two");
    expect(wrapper.text()).toContain("providers.music_quiz.answered");
    wrapper.unmount();
  });

  it("shows the existing reveal result states", () => {
    const state = {
      ...playerState,
      phase: "reveal",
      you: {
        ...playerState.you,
        answer: {
          suggestion_id: "two",
          answered_at: 10,
          correct: true,
          points: 7,
        },
      },
    } satisfies MusicQuizGuessTheSongPersonalizedState;

    const wrapper = shallowMount(MultipleChoicePlayerAnswer, {
      props: {
        state,
        currentRound,
        busy: false,
      },
    });

    expect(wrapper.text()).toContain("providers.music_quiz.correct");
    expect(wrapper.text()).toContain("+7");
    wrapper.unmount();
  });

  it("excludes players who joined after the current round", () => {
    const state = {
      ...playerState,
      players: [
        {
          name: "Active",
          score: 0,
          ready: false,
          answered: true,
          active_from_round: 1,
        },
        {
          name: "Late",
          score: 0,
          ready: false,
          answered: false,
          active_from_round: 2,
        },
      ],
      created_at: 1,
      sources: [],
      join_url: "https://example.test/join",
      rounds: [currentRound],
    } satisfies MusicQuizGuessTheSongHostState;

    const wrapper = shallowMount(MultipleChoiceHostAnswer, {
      props: {
        state,
        currentRound,
      },
      slots: {
        leaderboard: "<div>Leaderboard</div>",
      },
    });
    const progress = wrapper.getComponent(MultipleChoiceProgress);

    expect(progress.props("statuses")).toEqual([state.players[0]]);
    expect(progress.props("answeredCount")).toBe(1);
    wrapper.unmount();
  });
});
