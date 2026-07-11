import MusicQuizPlayerStage from "@/components/music-quiz/MusicQuizPlayerStage.vue";
import MusicQuizPresentStage from "@/components/music-quiz/MusicQuizPresentStage.vue";
import type {
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
} from "@/composables/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: vi.fn(),
  getMediaImageUrl: (url: string) => url,
}));

vi.mock("@/composables/useMusicQuizCelebration", () => ({
  useMusicQuizCelebration: () => ({
    celebrate: vi.fn(),
  }),
}));

const gameAdapter = {
  props: {
    state: { type: Object, required: true },
    currentRound: { type: Object, required: true },
    busy: Boolean,
  },
  emits: ["ready"],
  template:
    '<button data-testid="game-adapter" @click="$emit(\'ready\')">Game</button>',
};
const answerAdapter = {
  props: {
    state: { type: Object, required: true },
    currentRound: { type: Object, required: true },
    busy: Boolean,
  },
  emits: ["submit"],
  template:
    "<button data-testid=\"answer-adapter\" @click=\"$emit('submit', { answer_type: 'multiple_choice', suggestion_id: 'one' })\">Answer<slot name=\"leaderboard\" /></button>",
};

const currentRound = {
  question: "Which song is playing?",
  round_index: 0,
  started_at: 1,
  deadline: 2,
  suggestions: [{ suggestion_id: "one", label: "One" }],
} satisfies MusicQuizGuessTheSongRound;

const playerState = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "answering",
  name: "Quiz",
  round_count: 1,
  suggestion_count: 1,
  answer_duration: 30,
  mode: "venue",
  players: [],
  current_round: currentRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizGuessTheSongPersonalizedState;

const hostState = {
  ...playerState,
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [currentRound],
} satisfies MusicQuizGuessTheSongHostState;

const leaderboardRows = [
  {
    name: "Player",
    score: 10,
    ready: false,
    answered: true,
    active_from_round: 0,
    rank: 1,
    roundScoreLabel: "",
  },
];

describe("Music Quiz shared stages", () => {
  it("forwards player adapter actions through the shared shell", async () => {
    const wrapper = mount(MusicQuizPlayerStage, {
      props: {
        state: playerState,
        currentRound,
        busy: false,
        leaderboardRows,
        winnerText: "",
        gameComponent: gameAdapter,
        answerComponent: answerAdapter,
      },
      global: {
        stubs: {
          MusicQuizLeaderboard: true,
          MusicQuizPodium: true,
        },
      },
    });

    await wrapper.get('[data-testid="game-adapter"]').trigger("click");
    await wrapper.get('[data-testid="answer-adapter"]').trigger("click");

    expect(wrapper.emitted("ready")).toEqual([[]]);
    expect(wrapper.emitted("submit-answer")).toEqual([
      [
        {
          answer_type: "multiple_choice",
          suggestion_id: "one",
        },
      ],
    ]);
  });

  it("keeps the shared leaderboard in the present answer slot", () => {
    const wrapper = mount(MusicQuizPresentStage, {
      props: {
        state: hostState,
        currentRound,
        leaderboardRows,
        winnerText: "",
        phaseLabel: "Answering",
        roundLabel: "Round 1",
        joinLink: "https://example.test/join",
        isConnectionDegraded: false,
        gameComponent: gameAdapter,
        answerComponent: answerAdapter,
      },
      global: {
        stubs: {
          Button: true,
          MusicQuizConnectionBanners: true,
          MusicQuizLeaderboard: {
            template: '<div data-testid="leaderboard" />',
          },
          MusicQuizPodium: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="answer-adapter"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="leaderboard"]').exists()).toBe(true);
  });

  it("keeps reveal presentation routed through the answer adapter", () => {
    const state = {
      ...hostState,
      phase: "reveal",
    } satisfies MusicQuizGuessTheSongHostState;
    const wrapper = mount(MusicQuizPresentStage, {
      props: {
        state,
        currentRound,
        leaderboardRows,
        winnerText: "",
        phaseLabel: "Reveal",
        roundLabel: "Round 1",
        joinLink: "https://example.test/join",
        isConnectionDegraded: false,
        gameComponent: gameAdapter,
        answerComponent: answerAdapter,
      },
      global: {
        stubs: {
          Button: true,
          MusicQuizConnectionBanners: true,
          MusicQuizLeaderboard: {
            template: '<div data-testid="leaderboard" />',
          },
          MusicQuizPodium: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="game-adapter"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="answer-adapter"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="leaderboard"]').exists()).toBe(true);
  });

  it("keeps the podium in the shared finished presentation", () => {
    const state = {
      ...hostState,
      phase: "finished",
      current_round: null,
    } satisfies MusicQuizGuessTheSongHostState;
    const wrapper = mount(MusicQuizPresentStage, {
      props: {
        state,
        currentRound: null,
        leaderboardRows,
        winnerText: "Player wins",
        phaseLabel: "Finished",
        roundLabel: "",
        joinLink: "https://example.test/join",
        isConnectionDegraded: false,
        gameComponent: gameAdapter,
        answerComponent: answerAdapter,
      },
      global: {
        stubs: {
          Button: true,
          MusicQuizConnectionBanners: true,
          MusicQuizLeaderboard: true,
          MusicQuizPodium: {
            template: '<div data-testid="podium" />',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="podium"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Player wins");
  });
});
