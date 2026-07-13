import MultipleChoiceGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceGrid.vue";
import MultipleChoiceHostAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceHostAnswer.vue";
import MultipleChoicePlayerAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePlayerAnswer.vue";
import MultipleChoicePresentAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePresentAnswer.vue";
import MultipleChoiceProgress from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceProgress.vue";
import type {
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { mount, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const currentRound = {
  question: "Which song is playing?",
  round_index: 1,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  auto_advance_at: null,
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

  it("excludes late joiners from player, host, and present progress", () => {
    const players = [
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
    ];
    const personalizedState = {
      ...playerState,
      players,
    } satisfies MusicQuizGuessTheSongPersonalizedState;
    const hostState = {
      ...playerState,
      players,
      created_at: 1,
      sources: [],
      join_url: "https://example.test/join",
      rounds: [currentRound],
    } satisfies MusicQuizGuessTheSongHostState;

    const wrappers = [
      shallowMount(MultipleChoicePlayerAnswer, {
        props: {
          state: personalizedState,
          currentRound,
          busy: false,
        },
      }),
      shallowMount(MultipleChoiceHostAnswer, {
        props: {
          state: hostState,
          currentRound,
        },
        slots: {
          leaderboard: "<div>Leaderboard</div>",
        },
      }),
      shallowMount(MultipleChoicePresentAnswer, {
        props: {
          state: hostState,
          currentRound,
        },
        slots: {
          leaderboard: "<div>Leaderboard</div>",
        },
      }),
    ];

    for (const [index, wrapper] of wrappers.entries()) {
      const progress = wrapper.getComponent(MultipleChoiceProgress);
      expect(progress.props("statuses")).toEqual([players[0]]);
      expect(progress.props("answeredCount")).toBe(1);
      expect(progress.props("scrollable")).toBe(index === 2);
      if (index === 2) {
        const panels = wrapper.get(
          '[data-testid="multiple-choice-present-panels"]',
        );
        expect(panels.classes()).toEqual(
          expect.arrayContaining([
            "lg:grid",
            "lg:min-h-0",
            "lg:grid-rows-[minmax(7rem,2fr)_minmax(9rem,3fr)]",
            "lg:overflow-hidden",
          ]),
        );
        expect(panels.classes()).not.toContain("overflow-hidden");
      }
      wrapper.unmount();
    }
  });

  it("contains long present progress lists with internal scrolling", () => {
    const wrapper = mount(MultipleChoiceProgress, {
      props: {
        statuses: playerState.players,
        answeredCount: 0,
        scrollable: true,
      },
    });

    expect(wrapper.get('[data-slot="card"]').classes()).toEqual(
      expect.arrayContaining(["min-h-0", "overflow-hidden"]),
    );
    expect(wrapper.get('[data-slot="card-content"]').classes()).toEqual(
      expect.arrayContaining([
        "min-h-0",
        "flex-1",
        "overflow-y-auto",
        "overscroll-contain",
      ]),
    );
  });
});
