import MultipleChoiceGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceGrid.vue";
import MultipleChoiceHostAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceHostAnswer.vue";
import MultipleChoicePlayerAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePlayerAnswer.vue";
import MultipleChoicePresentAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePresentAnswer.vue";
import MultipleChoiceProgress from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceProgress.vue";
import TriviaHostPanel from "@/components/music-quiz/game-types/trivia/TriviaHostPanel.vue";
import TriviaHostRound from "@/components/music-quiz/game-types/trivia/TriviaHostRound.vue";
import TriviaPlayerRound from "@/components/music-quiz/game-types/trivia/TriviaPlayerRound.vue";
import TriviaPresentRound from "@/components/music-quiz/game-types/trivia/TriviaPresentRound.vue";
import MusicQuizPlayerStage from "@/components/music-quiz/MusicQuizPlayerStage.vue";
import type {
  MusicQuizTriviaHostState,
  MusicQuizTriviaPersonalizedState,
  MusicQuizTriviaRound,
} from "@/composables/useMusicQuiz";
import { mount, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const answeringRound = {
  question: "Which artist released Blue?",
  round_index: 1,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  suggestions: [
    { suggestion_id: "opaque-a7", label: "Joni Mitchell" },
    { suggestion_id: "opaque-b4", label: "Carole King" },
  ],
} satisfies MusicQuizTriviaRound;

const revealRound = {
  ...answeringRound,
  answer_label: "Joni Mitchell",
  correct_suggestion_id: "opaque-a7",
  ended_at: 20,
} satisfies MusicQuizTriviaRound;

const activePlayer = {
  name: "Active",
  score: 700,
  ready: false,
  answered: true,
  active_from_round: 1,
  last_answer: {
    suggestion_id: "opaque-a7",
    correct: true,
    points: 700,
  },
};
const latePlayer = {
  name: "Late",
  score: 0,
  ready: false,
  answered: false,
  active_from_round: 2,
};

const answeringPlayerState = {
  quiz_type: "trivia",
  answer_type: "multiple_choice",
  phase: "answering",
  name: "Music Trivia",
  round_count: 3,
  suggestion_count: 2,
  answer_duration: 30,
  mode: "venue",
  players: [activePlayer, latePlayer],
  current_round: answeringRound,
  you: {
    name: "Active",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizTriviaPersonalizedState;

const revealPlayerState = {
  ...answeringPlayerState,
  phase: "reveal",
  current_round: revealRound,
  you: {
    ...answeringPlayerState.you,
    answer: {
      suggestion_id: "opaque-a7",
      answered_at: 10,
      correct: true,
      points: 700,
    },
  },
} satisfies MusicQuizTriviaPersonalizedState;

const answeringHostState = {
  quiz_type: "trivia",
  answer_type: "multiple_choice",
  phase: "answering",
  name: "Music Trivia",
  round_count: 3,
  suggestion_count: 2,
  answer_duration: 30,
  mode: "venue",
  players: [activePlayer, latePlayer],
  current_round: answeringRound,
  created_at: 1,
  sources: [
    {
      uri: "library://artist/joni",
      name: "Joni Mitchell",
      media_type: "artist",
    },
  ],
  join_url: "https://example.test/join",
  rounds: [revealRound],
} satisfies MusicQuizTriviaHostState;

const revealHostState = {
  ...answeringHostState,
  phase: "reveal",
  current_round: revealRound,
} satisfies MusicQuizTriviaHostState;

describe("Trivia game adapters", () => {
  it("renders the question and reuses opaque multiple-choice submissions", () => {
    const game = mount(TriviaPlayerRound, {
      props: {
        state: answeringPlayerState,
        currentRound: answeringRound,
        busy: false,
      },
    });
    const answer = shallowMount(MultipleChoicePlayerAnswer, {
      props: {
        state: answeringPlayerState,
        currentRound: answeringRound,
        busy: false,
      },
    });

    expect(game.text()).toContain(answeringRound.question);
    expect(game.text()).not.toContain("Joni Mitchell");
    expect(
      answer.getComponent(MultipleChoiceGrid).props("suggestions"),
    ).toEqual(answeringRound.suggestions);
    answer.getComponent(MultipleChoiceGrid).vm.$emit("select", "opaque-b4");
    expect(answer.emitted("submit")).toEqual([
      [
        {
          answer_type: "multiple_choice",
          suggestion_id: "opaque-b4",
        },
      ],
    ]);
    game.unmount();
    answer.unmount();
  });

  it("shows the revealed answer, points, and ready flow", async () => {
    const game = mount(TriviaPlayerRound, {
      props: {
        state: revealPlayerState,
        currentRound: revealRound,
        busy: false,
      },
    });
    const answer = mount(MultipleChoicePlayerAnswer, {
      props: {
        state: revealPlayerState,
        currentRound: revealRound,
        busy: false,
      },
    });

    expect(game.text()).toContain(revealRound.question);
    expect(game.text()).toContain("Joni Mitchell");
    expect(answer.text()).toContain("providers.music_quiz.correct");
    expect(answer.text()).toContain("+700");
    await game.get("button").trigger("click");
    expect(game.emitted("ready")).toEqual([[]]);
    game.unmount();
    answer.unmount();
  });

  it("keeps host and present answers hidden until reveal", () => {
    const answeringHost = mount(TriviaHostRound, {
      props: {
        state: answeringHostState,
        currentRound: answeringRound,
      },
    });
    const revealHost = mount(TriviaHostRound, {
      props: {
        state: revealHostState,
        currentRound: revealRound,
      },
    });
    const present = mount(TriviaPresentRound, {
      props: {
        state: revealHostState,
        currentRound: revealRound,
      },
    });

    expect(answeringHost.text()).toContain(answeringRound.question);
    expect(answeringHost.text()).not.toContain("Joni Mitchell");
    expect(revealHost.text()).toContain("Joni Mitchell");
    expect(present.text()).toContain(revealRound.question);
    expect(present.text()).toContain("Joni Mitchell");
    answeringHost.unmount();
    revealHost.unmount();
    present.unmount();
  });

  it("uses shared active-player progress in host and present views", () => {
    const wrappers = [
      shallowMount(MultipleChoiceHostAnswer, {
        props: {
          state: answeringHostState,
          currentRound: answeringRound,
        },
        slots: { leaderboard: "<div>Leaderboard</div>" },
      }),
      shallowMount(MultipleChoicePresentAnswer, {
        props: {
          state: answeringHostState,
          currentRound: answeringRound,
        },
        slots: { leaderboard: "<div>Leaderboard</div>" },
      }),
    ];

    for (const wrapper of wrappers) {
      const progress = wrapper.getComponent(MultipleChoiceProgress);
      expect(progress.props("statuses")).toEqual([activePlayer]);
      expect(progress.props("answeredCount")).toBe(1);
      wrapper.unmount();
    }
  });

  it("shows selected sources in the host panel without track assumptions", () => {
    const wrapper = mount(TriviaHostPanel, {
      props: {
        state: answeringHostState,
        currentRound: answeringRound,
      },
    });

    expect(wrapper.text()).toContain("Joni Mitchell");
    expect(wrapper.text()).toContain("providers.music_quiz.artist");
    expect(wrapper.html()).not.toContain("track_uri");
    wrapper.unmount();
  });

  it("uses the shared finished podium and leaderboard", () => {
    const state = {
      ...revealPlayerState,
      phase: "finished",
      current_round: null,
    } satisfies MusicQuizTriviaPersonalizedState;
    const wrapper = mount(MusicQuizPlayerStage, {
      props: {
        state,
        currentRound: null,
        busy: false,
        leaderboardRows: [
          {
            ...activePlayer,
            rank: 1,
            roundScoreLabel: "",
          },
        ],
        winnerText: "Active wins",
        gameComponent: TriviaPlayerRound,
        answerComponent: MultipleChoicePlayerAnswer,
      },
      global: {
        stubs: {
          MusicQuizLeaderboard: {
            template: '<div data-testid="leaderboard" />',
          },
          MusicQuizPodium: {
            template: '<div data-testid="podium" />',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="podium"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="leaderboard"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Active wins");
    wrapper.unmount();
  });
});
