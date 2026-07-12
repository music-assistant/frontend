import MusicQuizLeaderboard from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import MusicQuizPlayerStage from "@/components/music-quiz/MusicQuizPlayerStage.vue";
import MusicQuizPodium from "@/components/music-quiz/MusicQuizPodium.vue";
import MusicQuizPresentStage from "@/components/music-quiz/MusicQuizPresentStage.vue";
import type { MusicQuizGameDefinition } from "@/components/music-quiz/game_types";
import type {
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
  MusicQuizTimelinePersonalizedState,
  MusicQuizTriviaHostState,
} from "@/composables/useMusicQuiz";
import {
  baseRound as musicTimelineRound,
  baseState as musicTimelineState,
} from "./timelinePlayerFixtures";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values: unknown[] = []) => {
    const message =
      (
        {
          "providers.music_quiz.game_starts_in": "Game starts in {0}",
          "providers.music_quiz.waiting_for_game_start":
            "Waiting for game to start…",
        } as Record<string, string>
      )[key] ?? key;
    return message.replace("{0}", String(values[0] ?? ""));
  },
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
const presentBodyAdapter = {
  props: {
    state: { type: Object, required: true },
    currentRound: { type: Object, required: true },
    leaderboardRows: { type: Array, required: true },
  },
  template:
    '<div data-testid="present-body-adapter">{{ leaderboardRows.length }}</div>',
};
const timelineAnswerAdapter = {
  props: {
    state: { type: Object, required: true },
    currentRound: { type: Object, required: true },
    busy: Boolean,
  },
  emits: ["submit"],
  template:
    "<button data-testid=\"timeline-answer-adapter\" @click=\"$emit('submit', { answer_type: 'timeline', action: 'finish' })\">Timeline answer</button>",
};
const leaderboardStub = {
  props: {
    compact: Boolean,
  },
  template:
    "<div data-testid=\"leaderboard\" :data-compact=\"compact ? 'true' : 'false'\" />",
};
const gameDefinition = {
  id: "guess_the_song",
  answerType: "multiple_choice",
  labelKey: "providers.music_quiz.game_type_guess_the_song",
  descriptionKey: "",
  icon: { template: "<span />" },
  requiresBackendAvailability: false,
  supportsListenIn: true,
  revealPhaseLabelKey: "",
  adapters: {
    setup: gameAdapter,
    player: gameAdapter,
    hostPanel: gameAdapter,
    host: gameAdapter,
    present: gameAdapter,
  },
} as const;
const gameDefinitionWithPresentBody = {
  ...gameDefinition,
  adapters: {
    ...gameDefinition.adapters,
    presentBody: presentBodyAdapter,
  },
} satisfies MusicQuizGameDefinition<"guess_the_song">;

const currentRound = {
  question: "Which song is playing?",
  round_index: 0,
  started_at: 1,
  deadline: 2,
  auto_advance_at: null,
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
const triviaHostState = {
  ...hostState,
  quiz_type: "trivia",
  name: "Trivia",
  language: "en",
  rounds: [],
} satisfies MusicQuizTriviaHostState;
const triviaGameDefinition = {
  ...gameDefinition,
  id: "trivia",
  supportsListenIn: false,
} satisfies MusicQuizGameDefinition<"trivia">;

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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("keeps the compact leaderboard last while answering", () => {
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
          MusicQuizLeaderboard: leaderboardStub,
          MusicQuizPodium: true,
        },
      },
    });

    const leaderboard = wrapper.get('[data-testid="leaderboard"]');
    expect(leaderboard.attributes("data-compact")).toBe("true");
    expect(wrapper.get("section").element.lastElementChild).toBe(
      leaderboard.element,
    );
  });

  it("keeps the compact leaderboard last during timeline reveal", () => {
    const state = {
      ...musicTimelineState,
      phase: "reveal",
    } satisfies MusicQuizTimelinePersonalizedState;
    const wrapper = mount(MusicQuizPlayerStage, {
      props: {
        state,
        currentRound: musicTimelineRound,
        busy: false,
        leaderboardRows,
        winnerText: "",
        gameComponent: gameAdapter,
        answerComponent: timelineAnswerAdapter,
      },
      global: {
        stubs: {
          MusicQuizLeaderboard: leaderboardStub,
          MusicQuizPodium: true,
        },
      },
    });

    const leaderboard = wrapper.get('[data-testid="leaderboard"]');
    const section = wrapper.get("section");
    expect(section.element.children[0]).toBe(
      wrapper.get('[data-testid="game-adapter"]').element,
    );
    expect(section.element.children[1]).toBe(
      wrapper.get('[data-testid="timeline-answer-adapter"]').element,
    );
    expect(
      wrapper.find('[data-testid="timeline-answer-adapter"]').exists(),
    ).toBe(true);
    expect(leaderboard.attributes("data-compact")).toBe("true");
    expect(section.element.lastElementChild).toBe(leaderboard.element);
  });

  it("keeps the full leaderboard for final player results", () => {
    const state = {
      ...playerState,
      phase: "finished",
      current_round: null,
    } satisfies MusicQuizGuessTheSongPersonalizedState;
    const wrapper = mount(MusicQuizPlayerStage, {
      props: {
        state,
        currentRound: null,
        busy: false,
        leaderboardRows,
        winnerText: "Player wins",
        gameComponent: gameAdapter,
        answerComponent: answerAdapter,
      },
      global: {
        stubs: {
          MusicQuizLeaderboard: leaderboardStub,
          MusicQuizPodium: true,
        },
      },
    });

    expect(
      wrapper.get('[data-testid="leaderboard"]').attributes("data-compact"),
    ).toBe("false");
  });

  it("shows joined guests the remaining server time and handles cancellation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:18Z"));
    const state = {
      ...playerState,
      phase: "lobby",
      current_round: null,
      auto_start_at: new Date("2026-01-01T00:00:30Z").getTime() / 1000,
    } satisfies MusicQuizGuessTheSongPersonalizedState;
    const wrapper = mount(MusicQuizPlayerStage, {
      props: {
        state,
        currentRound: null,
        busy: false,
        leaderboardRows,
        winnerText: "",
        gameComponent: gameAdapter,
        answerComponent: answerAdapter,
      },
      global: {
        stubs: {
          MusicQuizLeaderboard: leaderboardStub,
          MusicQuizPodium: true,
        },
      },
    });

    expect(wrapper.get('[data-testid="music-quiz-auto-start"]').text()).toBe(
      "Game starts in 12s",
    );

    vi.advanceTimersByTime(12_000);
    await flushPromises();
    expect(wrapper.get('[data-testid="music-quiz-auto-start"]').text()).toBe(
      "Waiting for game to start…",
    );

    await wrapper.setProps({
      state: {
        ...state,
        auto_start_at: null,
      },
    });
    expect(wrapper.find('[data-testid="music-quiz-auto-start"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("providers.music_quiz.waiting_for_start");
    wrapper.unmount();
  });

  it("shows the authoritative countdown in present mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const state = {
      ...hostState,
      phase: "lobby",
      current_round: null,
      auto_start_at: Date.now() / 1000 + 9,
    } satisfies MusicQuizGuessTheSongHostState;
    const wrapper = mount(MusicQuizPresentStage, {
      props: {
        state,
        game: gameDefinition,
        currentRound: null,
        leaderboardRows,
        winnerText: "",
        phaseLabel: "Lobby",
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
          MusicQuizPodium: true,
          MusicQuizQrCard: true,
        },
      },
    });

    expect(wrapper.get('[data-testid="music-quiz-auto-start"]').text()).toBe(
      "Game starts in 9s",
    );
    const lobby = wrapper.get('[data-testid="music-quiz-present-lobby"]');
    expect(lobby.classes()).toEqual(
      expect.arrayContaining(["min-h-0", "flex-1", "lg:overflow-y-auto"]),
    );
    expect(lobby.classes()).not.toContain("overflow-y-auto");
    wrapper.unmount();
  });

  it("keeps the shared leaderboard in the present answer slot", () => {
    const wrapper = mount(MusicQuizPresentStage, {
      props: {
        state: hostState,
        game: gameDefinition,
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
    const root = wrapper.get('[data-testid="music-quiz-present-stage"]');
    expect(root.classes()).toEqual(
      expect.arrayContaining([
        "min-h-dvh",
        "lg:h-full",
        "lg:min-h-0",
        "lg:overflow-hidden",
      ]),
    );
    expect(root.classes()).not.toContain("overflow-hidden");
    expect(wrapper.get("button-stub").attributes("size")).toBe("sm");
  });

  it("keeps reveal presentation routed through the answer adapter", () => {
    const state = {
      ...hostState,
      phase: "reveal",
    } satisfies MusicQuizGuessTheSongHostState;
    const wrapper = mount(MusicQuizPresentStage, {
      props: {
        state,
        game: gameDefinition,
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

  it("uses the default present layout for Trivia answering and reveal", () => {
    for (const phase of ["answering", "reveal"] as const) {
      const wrapper = mount(MusicQuizPresentStage, {
        props: {
          state: {
            ...triviaHostState,
            phase,
          },
          game: triviaGameDefinition,
          currentRound,
          leaderboardRows,
          winnerText: "",
          phaseLabel: phase,
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

      expect(
        wrapper.find('[data-testid="present-body-adapter"]').exists(),
      ).toBe(false);
      expect(wrapper.find('[data-testid="game-adapter"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="answer-adapter"]').exists()).toBe(
        true,
      );
      expect(wrapper.find('[data-testid="leaderboard"]').exists()).toBe(true);
      wrapper.unmount();
    }
  });

  it("routes active rounds through an optional game present body", () => {
    const wrapper = mount(MusicQuizPresentStage, {
      props: {
        state: {
          ...hostState,
          phase: "reveal",
        },
        game: gameDefinitionWithPresentBody,
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
          MusicQuizLeaderboard: true,
          MusicQuizPodium: true,
        },
      },
    });

    expect(wrapper.get('[data-testid="present-body-adapter"]').text()).toBe(
      "1",
    );
    expect(wrapper.find('[data-testid="game-adapter"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="answer-adapter"]').exists()).toBe(false);
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
        game: gameDefinition,
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
        },
      },
    });

    expect(
      wrapper.getComponent(MusicQuizPodium).attributes("aria-hidden"),
    ).toBe("true");
    const leaderboard = wrapper.getComponent(MusicQuizLeaderboard);
    expect(leaderboard.attributes("role")).toBe("region");
    expect(leaderboard.attributes("aria-label")).toBe(
      "providers.music_quiz.leaderboard",
    );
    expect(wrapper.text()).toContain("Player wins");
    const finished = wrapper.get('[data-testid="music-quiz-present-finished"]');
    expect(finished.classes()).toEqual(
      expect.arrayContaining(["min-h-0", "flex-1", "lg:overflow-y-auto"]),
    );
    expect(finished.classes()).not.toContain("overflow-y-auto");
  });
});
