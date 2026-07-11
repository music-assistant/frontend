import MusicQuizPlayerView from "@/views/MusicQuizPlayerView.vue";
import { mount } from "@vue/test-utils";
import { h, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGameAdapterSetup,
  mockGetTrackLyrics,
  mockListenInSetup,
  mockResolveMusicQuizDefinition,
  mockUseMusicQuizPlayer,
} = vi.hoisted(() => ({
  mockGameAdapterSetup: vi.fn(),
  mockGetTrackLyrics: vi.fn(),
  mockListenInSetup: vi.fn(),
  mockResolveMusicQuizDefinition: vi.fn(),
  mockUseMusicQuizPlayer: vi.fn(),
}));

vi.mock("@/components/ListenIn.vue", async () => {
  const { h } = await import("vue");
  return {
    default: {
      name: "ListenIn",
      setup() {
        mockListenInSetup();
        return () => h("div", { "data-testid": "listen-in" });
      },
    },
  };
});

vi.mock("@/components/music-quiz/game_types", () => ({
  getMusicQuizPhaseLabelKey: () => "providers.music_quiz.phase_answers_open",
  resolveMusicQuizDefinition: mockResolveMusicQuizDefinition,
}));

vi.mock("@/composables/useMusicQuizPlayer", () => ({
  useMusicQuizPlayer: mockUseMusicQuizPlayer,
}));

vi.mock("@/composables/useMusicQuizCelebration", () => ({
  useMusicQuizCelebration: () => ({
    celebrate: vi.fn(),
  }),
}));

vi.mock("@/helpers/music_quiz", () => ({
  getMusicQuizErrorMessage: () => "",
  getMusicQuizRoundScoreLabel: () => "",
  getMusicQuizWinnerText: () => "",
  rankMusicQuizPlayers: () => [],
}));

vi.mock("@/plugins/api", () => ({
  default: {
    state: { value: "connected" },
    sendCommand: vi.fn(),
    getTrackLyrics: mockGetTrackLyrics,
  },
  ConnectionState: {
    RECONNECTING: "reconnecting",
    DISCONNECTED: "disconnected",
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const currentRound = {
  question: "Which song is playing?",
  round_index: 0,
  started_at: 1,
  deadline: 2,
  suggestions: [],
  track_uri: "library://track/1",
};
const playerState = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "reveal",
  name: "Quiz",
  round_count: 1,
  suggestion_count: 2,
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
};
const hitsterRound = {
  question: null,
  round_index: 0,
  started_at: 1,
  deadline: 2,
  timeline: [
    {
      entry_id: "anchor",
      release_year: 1990,
      title: "Anchor",
      artist: "Artist",
      track_uri: "library://track/anchor",
      image_url: null,
      is_anchor: true,
    },
  ],
  bonus_definitions: [],
};
const hitsterState = {
  quiz_type: "hitster",
  answer_type: "timeline",
  phase: "answering",
  name: "Hitster",
  round_count: 1,
  answer_duration: 30,
  artist_bonus_mode: "off",
  title_bonus_mode: "off",
  mode: "venue",
  players: [],
  current_round: hitsterRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
};
const triviaRound = {
  question: "Who released this album?",
  round_index: 0,
  started_at: 1,
  deadline: 2,
  suggestions: [],
};
const triviaState = {
  quiz_type: "trivia",
  answer_type: "multiple_choice",
  phase: "answering",
  name: "Trivia",
  round_count: 1,
  suggestion_count: 2,
  answer_duration: 30,
  mode: "venue",
  players: [],
  current_round: triviaRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
};

describe("MusicQuizPlayerView routing", () => {
  beforeEach(() => {
    mockGameAdapterSetup.mockReset();
    mockGetTrackLyrics.mockReset();
    mockListenInSetup.mockReset();
    mockResolveMusicQuizDefinition.mockReset();
    mockUseMusicQuizPlayer.mockReset();
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref(playerState),
      playerId: ref("player-id"),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(currentRound),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });
  });

  it("does not initialize ListenIn or lyrics for a non-audio definition", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(false));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref(triviaState),
      playerId: ref("player-id"),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(triviaRound),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(mockGameAdapterSetup).toHaveBeenCalledOnce();
    expect(mockListenInSetup).not.toHaveBeenCalled();
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("keeps ListenIn enabled for Guess the Song", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));

    const wrapper = mountView();

    expect(mockListenInSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("enables Hitster ListenIn without fetching lyrics", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref(hitsterState),
      playerId: ref("player-id"),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(hitsterRound),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(mockListenInSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(true);
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("hides the mode label before joining Trivia", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(false));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref({
        quiz_type: "trivia",
        answer_type: "multiple_choice",
        phase: "lobby",
        name: "Trivia",
        player_count: 2,
        round_count: 5,
        mode: "venue",
      }),
      state: ref(null),
      playerId: ref(null),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(wrapper.text()).not.toContain("providers.music_quiz.mode_venue");
    wrapper.unmount();
  });

  it("keeps the mode label before joining audio games", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref({
        quiz_type: "guess_the_song",
        answer_type: "multiple_choice",
        phase: "lobby",
        name: "Quiz",
        player_count: 2,
        round_count: 5,
        mode: "venue",
      }),
      state: ref(null),
      playerId: ref(null),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(wrapper.text()).toContain("providers.music_quiz.mode_venue");
    wrapper.unmount();
  });

  it("uses the update-required state when pair resolution fails", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(undefined);

    const wrapper = mountView();

    expect(wrapper.find('[data-testid="unsupported-game"]').exists()).toBe(
      true,
    );
    expect(mockGameAdapterSetup).not.toHaveBeenCalled();
    expect(mockListenInSetup).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

function createDefinition(supportsListenIn: boolean) {
  const gameAdapter = {
    name: "TestGameAdapter",
    props: {
      state: { type: Object, required: true },
      currentRound: { type: Object, required: true },
      busy: Boolean,
    },
    setup() {
      mockGameAdapterSetup();
      return () => h("div", { "data-testid": "game-adapter" });
    },
  };
  const answerAdapter = {
    name: "TestAnswerAdapter",
    props: {
      state: { type: Object, required: true },
      currentRound: { type: Object, required: true },
      busy: Boolean,
    },
    setup() {
      return () => h("div", { "data-testid": "answer-adapter" });
    },
  };
  return {
    game: {
      supportsListenIn,
      adapters: {
        player: gameAdapter,
      },
    },
    answer: {
      adapters: {
        player: answerAdapter,
      },
    },
  };
}

function mountView() {
  return mount(MusicQuizPlayerView, {
    global: {
      stubs: {
        MusicQuizConnectionBanners: true,
        MusicQuizLeaderboard: true,
        MusicQuizPlayerHeader: true,
        MusicQuizPodium: true,
        MusicQuizUnsupportedGame: {
          template: '<div data-testid="unsupported-game" />',
        },
      },
    },
  });
}
