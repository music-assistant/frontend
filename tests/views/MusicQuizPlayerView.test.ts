import MusicQuizPlayerView from "@/views/MusicQuizPlayerView.vue";
import MusicQuizJoinForm from "@/components/music-quiz/MusicQuizJoinForm.vue";
import { webPlayer } from "@/plugins/web_player";
import { flushPromises, mount } from "@vue/test-utils";
import { h, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGameAdapterSetup,
  mockGetTrackLyrics,
  mockListenInSetup,
  mockPrimeAudio,
  mockResolveMusicQuizDefinition,
  mockUseMusicQuizPlayer,
} = vi.hoisted(() => ({
  mockGameAdapterSetup: vi.fn(),
  mockGetTrackLyrics: vi.fn(),
  mockListenInSetup: vi.fn(),
  mockPrimeAudio: vi.fn(),
  mockResolveMusicQuizDefinition: vi.fn(),
  mockUseMusicQuizPlayer: vi.fn(),
}));

vi.mock("@/components/ListenIn.vue", async () => {
  const { h } = await import("vue");
  return {
    default: {
      name: "ListenIn",
      props: {
        autoEnable: Boolean,
        mode: String,
        preferenceKey: String,
      },
      setup(props: {
        autoEnable?: boolean;
        mode?: string;
        preferenceKey?: string;
      }) {
        mockListenInSetup(props);
        return () => h("div", { "data-testid": "listen-in" });
      },
    },
  };
});

vi.mock("@/components/music-quiz/game_types", () => ({
  getMusicQuizPhaseLabelKey: () => "providers.music_quiz.phase_answers_open",
  resolveMusicQuizDefinition: mockResolveMusicQuizDefinition,
  supportsMusicQuizListenIn: (
    game: {
      supportsListenIn: boolean | ((state: Record<string, unknown>) => boolean);
    },
    state: Record<string, unknown>,
  ) =>
    typeof game.supportsListenIn === "boolean"
      ? game.supportsListenIn
      : game.supportsListenIn(state),
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
  $t: (key: string, values: unknown[] = []) => {
    const message =
      (
        {
          "providers.music_quiz.game_starts_in": "Game starts in {0}",
        } as Record<string, string>
      )[key] ?? key;
    return message.replace("{0}", String(values[0] ?? ""));
  },
}));

vi.mock("@/plugins/web_player", async () => {
  const { reactive } = await import("vue");
  return {
    webPlayer: reactive({
      player_generation: 0,
      primeAudio: mockPrimeAudio,
    }),
  };
});

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
  auto_advance_at: null,
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
const musicTimelineRound = {
  question: null,
  round_index: 0,
  started_at: 1,
  deadline: 2,
  auto_advance_at: null,
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
const musicTimelineState = {
  quiz_type: "music_timeline",
  answer_type: "timeline",
  phase: "answering",
  name: "Music Timeline",
  round_count: 1,
  answer_duration: 30,
  artist_bonus_mode: "off",
  title_bonus_mode: "off",
  mode: "venue",
  players: [],
  current_round: musicTimelineRound,
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
  auto_advance_at: null,
  suggestions: [],
};
const triviaState = {
  quiz_type: "trivia",
  answer_type: "multiple_choice",
  language: "en",
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
const triviaListenInCapability = (state: Record<string, unknown>) =>
  state.play_reveal_audio === true;

describe("MusicQuizPlayerView routing", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    mockGameAdapterSetup.mockReset();
    mockGetTrackLyrics.mockReset();
    mockListenInSetup.mockReset();
    mockPrimeAudio.mockReset();
    mockPrimeAudio.mockReturnValue(true);
    webPlayer.player_generation = 0;
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

  it.each([
    ["legacy", triviaState],
    ["disabled", { ...triviaState, play_reveal_audio: false }],
  ])(
    "never initializes ListenIn or lyrics for %s Trivia state",
    (_case, state) => {
      mockResolveMusicQuizDefinition.mockReturnValue(
        createDefinition(triviaListenInCapability),
      );
      mockUseMusicQuizPlayer.mockReturnValue({
        info: ref(null),
        state: ref(state),
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
      expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(false);
      expect(wrapper.text()).not.toContain("providers.music_quiz.mode_venue");
      expect(mockGetTrackLyrics).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

  it("initializes ListenIn for reveal-audio Trivia during answering", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(
      createDefinition(triviaListenInCapability),
    );
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref({ ...triviaState, play_reveal_audio: true }),
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
    expect(mockListenInSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("providers.music_quiz.mode_venue");
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("allows reveal-audio Trivia ListenIn to be armed in the lobby", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(
      createDefinition(triviaListenInCapability),
    );
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref({
        ...triviaState,
        play_reveal_audio: true,
        phase: "lobby",
        current_round: null,
      }),
      playerId: ref("player-id"),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(mockListenInSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("providers.music_quiz.mode_venue");
    wrapper.unmount();
  });

  it("keeps ListenIn enabled for Guess the Song", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));

    const wrapper = mountView();

    expect(mockListenInSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("requires a Join-primed session before Remote auto-listen", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref({ ...playerState, mode: "remote" }),
      playerId: ref("player-id"),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(currentRound),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(mockListenInSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        autoEnable: false,
        mode: "remote",
        preferenceKey: "music_quiz_listen_in_enabled",
      }),
    );
    wrapper.unmount();
  });

  it("hides round progress for a joined player in the lobby", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref({
        ...playerState,
        phase: "lobby",
        current_round: null,
      }),
      playerId: ref("player-id"),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(
      wrapper
        .get('[data-testid="music-quiz-session-header"]')
        .attributes("data-round-label"),
    ).toBe("");
    wrapper.unmount();
  });

  it("keeps round progress for an active joined player", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));

    const wrapper = mountView();

    expect(
      wrapper
        .get('[data-testid="music-quiz-session-header"]')
        .attributes("data-round-label"),
    ).toBe("providers.music_quiz.round_label 1/1");
    wrapper.unmount();
  });

  it("enables Music Timeline ListenIn without fetching lyrics", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref(musicTimelineState),
      playerId: ref("player-id"),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(musicTimelineRound),
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
    mockResolveMusicQuizDefinition.mockReturnValue(
      createDefinition(triviaListenInCapability),
    );
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref({
        quiz_type: "trivia",
        answer_type: "multiple_choice",
        language: "en",
        play_reveal_audio: false,
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

  it("shows the mode label before joining reveal-audio Trivia", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(
      createDefinition(triviaListenInCapability),
    );
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref({
        quiz_type: "trivia",
        answer_type: "multiple_choice",
        language: "en",
        play_reveal_audio: true,
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

    expect(wrapper.text()).toContain("providers.music_quiz.mode_venue");
    expect(mockListenInSetup).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("prefills the join form with the remembered name", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref({
        quiz_type: "guess_the_song",
        answer_type: "multiple_choice",
        phase: "lobby",
        name: "Quiz",
        player_count: 0,
        round_count: 5,
        mode: "venue",
      }),
      state: ref(null),
      playerId: ref(null),
      rememberedName: ref("Player One"),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(
      wrapper.get<HTMLInputElement>("#music-quiz-player-name").element.value,
    ).toBe("Player One");
    wrapper.unmount();
  });

  it("unlocks guest audio from the Join gesture", async () => {
    const info = ref({
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      phase: "lobby",
      name: "Quiz",
      player_count: 0,
      round_count: 5,
      mode: "remote",
    });
    const state = ref<typeof playerState | null>(null);
    const playerId = ref<string | null>(null);
    const activeRound = ref<typeof currentRound | null>(null);
    const join = vi.fn(async () => {
      state.value = { ...playerState, mode: "remote" };
      playerId.value = "player-id";
      activeRound.value = currentRound;
    });
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info,
      state,
      playerId,
      rememberedName: ref(""),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: activeRound,
      join,
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });
    const wrapper = mountView();

    wrapper.getComponent(MusicQuizJoinForm).vm.$emit("join", "Guest");
    await flushPromises();

    expect(mockPrimeAudio).toHaveBeenCalledOnce();
    expect(join).toHaveBeenCalledWith("Guest");
    expect(mockListenInSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        autoEnable: true,
        mode: "remote",
      }),
    );

    webPlayer.player_generation++;
    await nextTick();
    expect(
      wrapper.findComponent({ name: "ListenIn" }).props("autoEnable"),
    ).toBe(false);
  });

  it("keeps Tap available when Join cannot prime audio yet", async () => {
    mockPrimeAudio.mockReturnValue(false);
    const info = ref({
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      phase: "lobby",
      name: "Quiz",
      player_count: 0,
      round_count: 5,
      mode: "remote",
    });
    const state = ref<typeof playerState | null>(null);
    const playerId = ref<string | null>(null);
    const activeRound = ref<typeof currentRound | null>(null);
    const join = vi.fn(async () => {
      state.value = { ...playerState, mode: "remote" };
      playerId.value = "player-id";
      activeRound.value = currentRound;
    });
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info,
      state,
      playerId,
      rememberedName: ref(""),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: activeRound,
      join,
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });
    const wrapper = mountView();

    wrapper.getComponent(MusicQuizJoinForm).vm.$emit("join", "Guest");
    await flushPromises();

    expect(mockListenInSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        autoEnable: false,
        mode: "remote",
      }),
    );
  });

  it("shows unjoined guests the server replay countdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref({
        quiz_type: "guess_the_song",
        answer_type: "multiple_choice",
        phase: "lobby",
        name: "Quiz",
        player_count: 1,
        round_count: 5,
        mode: "venue",
        auto_start_at: Date.now() / 1000 + 18,
      }),
      state: ref(null),
      playerId: ref(null),
      rememberedName: ref("Player One"),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(wrapper.get('[data-testid="music-quiz-auto-start"]').text()).toBe(
      "Game starts in 18s",
    );
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

  it("distinguishes waiting for a host from a game that ended", () => {
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
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

    const waitingWrapper = mountView();
    expect(waitingWrapper.text()).toContain("guest.no_quiz_title");
    expect(waitingWrapper.text()).toContain("guest.no_quiz_description");
    expect(waitingWrapper.text()).not.toContain(
      "providers.music_quiz.game_ended",
    );
    expect(waitingWrapper.get('[data-slot="card-header"]').classes()).toContain(
      "justify-items-center",
    );
    expect(
      waitingWrapper.get('svg[aria-hidden="true"]').attributes("aria-hidden"),
    ).toBe("true");
    waitingWrapper.unmount();

    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref(null),
      playerId: ref(null),
      gameRemoved: ref(true),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const endedWrapper = mountView();
    expect(endedWrapper.text()).toContain("providers.music_quiz.game_ended");
    expect(endedWrapper.text()).toContain(
      "providers.music_quiz.game_ended_detail",
    );
    expect(endedWrapper.text()).toContain(
      "providers.music_quiz.game_ended_wait",
    );
    expect(endedWrapper.text()).not.toContain("guest.no_quiz_title");
    expect(endedWrapper.get('[data-slot="card-header"]').classes()).toContain(
      "justify-items-center",
    );
    expect(
      endedWrapper.get('svg[aria-hidden="true"]').attributes("aria-hidden"),
    ).toBe("true");
    endedWrapper.unmount();
  });
});

function createDefinition(
  supportsListenIn: boolean | ((state: Record<string, unknown>) => boolean),
) {
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
        MusicQuizSessionHeader: {
          props: ["listenInEnabled", "mode", "roundLabel"],
          template:
            '<div data-testid="music-quiz-session-header" :data-round-label="roundLabel"><span v-if="listenInEnabled">providers.music_quiz.mode_{{ mode }}</span></div>',
        },
        MusicQuizPodium: true,
        MusicQuizUnsupportedGame: {
          template: '<div data-testid="unsupported-game" />',
        },
      },
    },
  });
}
