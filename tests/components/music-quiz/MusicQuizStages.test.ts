import MusicQuizPlayerStage from "@/components/music-quiz/MusicQuizPlayerStage.vue";
import MusicQuizPresentStage from "@/components/music-quiz/MusicQuizPresentStage.vue";
import type {
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
  MusicQuizHitsterHostState,
  MusicQuizHitsterPersonalizedState,
  MusicQuizTimelineRound,
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
const timelineAnswerAdapter = {
  props: answerAdapter.props,
  emits: ["submit"],
  template:
    "<button data-testid=\"timeline-answer-adapter\" @click=\"$emit('submit', { answer_type: 'timeline', action: 'finish' })\">Timeline answer</button>",
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

const timelineRound = {
  question: null,
  round_index: 0,
  started_at: 1,
  deadline: 2,
  timeline: [],
  bonus_definitions: [],
} satisfies MusicQuizTimelineRound;

const timelinePlayerState = {
  quiz_type: "hitster",
  answer_type: "timeline",
  phase: "answering",
  name: "Timeline Quiz",
  round_count: 1,
  answer_duration: 30,
  artist_bonus_mode: "off",
  title_bonus_mode: "off",
  mode: "venue",
  players: [],
  current_round: timelineRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizHitsterPersonalizedState;

const timelineHostState = {
  quiz_type: "hitster",
  answer_type: "timeline",
  phase: "reveal",
  name: "Timeline Quiz",
  round_count: 1,
  answer_duration: 30,
  artist_bonus_mode: "off",
  title_bonus_mode: "off",
  mode: "venue",
  players: [],
  current_round: timelineRound,
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [],
} satisfies MusicQuizHitsterHostState;

const leaderboardRows = [
  {
    name: "Player",
    score: 10,
    ready: false,
    answered: true,
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

  it("forwards timeline submissions through the player shell", async () => {
    const wrapper = mount(MusicQuizPlayerStage, {
      props: {
        state: timelinePlayerState,
        currentRound: timelineRound,
        busy: false,
        leaderboardRows: [],
        winnerText: "",
        gameComponent: gameAdapter,
        answerComponent: timelineAnswerAdapter,
      },
      global: {
        stubs: {
          MusicQuizLeaderboard: true,
          MusicQuizPodium: true,
        },
      },
    });

    await wrapper
      .get('[data-testid="timeline-answer-adapter"]')
      .trigger("click");
    expect(wrapper.emitted("submit-answer")).toEqual([
      [{ answer_type: "timeline", action: "finish" }],
    ]);
  });

  it("mounts only the Hitster game adapter for present reveal", () => {
    const wrapper = mount(MusicQuizPresentStage, {
      props: {
        state: timelineHostState,
        currentRound: timelineRound,
        leaderboardRows: [],
        winnerText: "",
        phaseLabel: "Revealed",
        roundLabel: "Round 1",
        joinLink: "https://example.test/join",
        isConnectionDegraded: false,
        gameComponent: gameAdapter,
        answerComponent: timelineAnswerAdapter,
      },
      global: {
        stubs: {
          Button: true,
          MusicQuizConnectionBanners: true,
          MusicQuizLeaderboard: true,
          MusicQuizPodium: true,
        },
      },
    });

    expect(wrapper.find('[data-testid="game-adapter"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="timeline-answer-adapter"]').exists(),
    ).toBe(false);
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
