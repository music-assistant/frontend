import MusicQuizPlayerView from "@/views/MusicQuizPlayerView.vue";
import MusicQuizJoinForm from "@/components/music-quiz/MusicQuizJoinForm.vue";
import MusicQuizPlayerHeader from "@/components/music-quiz/MusicQuizPlayerHeader.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { webPlayer } from "@/plugins/web_player";
import { flushPromises, mount } from "@vue/test-utils";
import { h, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  isGuestSession,
  mockGameAdapterSetup,
  mockGetMusicQuizRoundScore,
  mockGetTrackLyrics,
  mockListenInSetup,
  mockPrimeAudio,
  mockRequestAutoEnable,
  mockResolveMusicQuizDefinition,
  mockRouterPush,
  mockToastError,
  mockToastSuccess,
  mockUseMusicQuizPlayer,
} = vi.hoisted(() => ({
  apiMock: { state: { value: "connected" as string } },
  isGuestSession: { value: false },
  mockGameAdapterSetup: vi.fn(),
  mockGetMusicQuizRoundScore: vi.fn(),
  mockGetTrackLyrics: vi.fn<MusicAssistantApi["getTrackLyrics"]>(),
  mockListenInSetup: vi.fn(),
  mockPrimeAudio: vi.fn(),
  mockRequestAutoEnable: vi.fn(),
  mockResolveMusicQuizDefinition: vi.fn(),
  mockRouterPush: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUseMusicQuizPlayer: vi.fn(),
}));

// Exposed by the last mounted ListenIn stub, mirroring its `busy` ref so tests
// can drive the Join/Continue disabled state from outside the component.
let listenInBusyRef: { value: boolean } | undefined;

vi.mock("@/components/ListenIn.vue", async () => {
  const { h, ref } = await import("vue");
  return {
    default: {
      name: "ListenIn",
      props: {
        mode: String,
      },
      setup(
        props: { mode?: string },
        { expose }: { expose: (exposed: object) => void },
      ) {
        mockListenInSetup(props);
        const busy = ref(false);
        listenInBusyRef = busy;
        expose({ busy, requestAutoEnable: mockRequestAutoEnable });
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

vi.mock("@/composables/music-quiz/useMusicQuizPlayer", () => ({
  useMusicQuizPlayer: mockUseMusicQuizPlayer,
}));

vi.mock("@/composables/music-quiz/useMusicQuizCelebration", () => ({
  useMusicQuizCelebration: () => ({
    celebrate: vi.fn(),
  }),
}));

vi.mock("@/helpers/music_quiz", () => ({
  getMusicQuizErrorMessage: () => "",
  getMusicQuizRoundScore: mockGetMusicQuizRoundScore,
  getMusicQuizRoundScoreLabel: () => "",
  getMusicQuizWinnerText: () => "",
  rankMusicQuizPlayers: () => [],
}));

vi.mock("@/plugins/api", async () => {
  // The connection banner re-renders on api.state, so the mock has to carry a
  // real ref: assignments to a plain { value } would never reach the computed.
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.state = ref(apiMock.state.value);
  return {
    default: {
      state: apiMock.state,
      sendCommand: vi.fn(),
      getTrackLyrics: mockGetTrackLyrics,
    },
    ConnectionState: {
      RECONNECTING: "reconnecting",
      DISCONNECTED: "disconnected",
    },
  };
});

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values: unknown[] = []) => {
    const message =
      (
        {
          "providers.music_quiz.game_starts_in": "Game starts in {0}",
          "providers.music_quiz.return_to_host_panel": "Return to host panel",
        } as Record<string, string>
      )[key] ?? key;
    return message.replace("{0}", String(values[0] ?? ""));
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isGuestAccessSession: () => isGuestSession.value,
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
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
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
    apiMock.state.value = "connected";
    mockGameAdapterSetup.mockReset();
    mockGetMusicQuizRoundScore.mockReset();
    mockGetTrackLyrics.mockReset();
    mockListenInSetup.mockReset();
    mockPrimeAudio.mockReset();
    mockPrimeAudio.mockReturnValue(true);
    mockRequestAutoEnable.mockReset();
    mockRequestAutoEnable.mockResolvedValue(undefined);
    listenInBusyRef = undefined;
    mockRouterPush.mockReset();
    webPlayer.player_generation = 0;
    isGuestSession.value = false;
    mockResolveMusicQuizDefinition.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
    mockUseMusicQuizPlayer.mockReset();
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref(playerState),
      playerId: ref("player-id"),
      // Already past the landing, matching a returning player who saw it
      // earlier this session, unless a test says otherwise.
      landingSeen: ref(true),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(currentRound),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen: vi.fn(),
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
        landingSeen: ref(true),
        gameRemoved: ref(false),
        busy: ref(false),
        loading: ref(false),
        currentRound: ref(triviaRound),
        join: vi.fn(),
        submitAnswer: vi.fn(),
        ready: vi.fn(),
        markLandingSeen: vi.fn(),
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

  it("never renders ListenIn in the joined game view, even for reveal-audio Trivia", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(
      createDefinition(triviaListenInCapability),
    );
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref({ ...triviaState, play_reveal_audio: true }),
      playerId: ref("player-id"),
      landingSeen: ref(true),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(triviaRound),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen: vi.fn(),
    });

    const wrapper = mountView();

    // ListenIn now only ever appears on the pre-game landing; the mode badge
    // still comes from the session header, unrelated to ListenIn itself.
    expect(mockGameAdapterSetup).toHaveBeenCalledOnce();
    expect(mockListenInSetup).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("providers.music_quiz.mode_venue");
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("shows reveal-audio Trivia ListenIn on the rejoin landing while still in the lobby", () => {
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
      landingSeen: ref(false),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen: vi.fn(),
    });

    const wrapper = mountView();

    expect(mockListenInSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("providers.music_quiz.mode_venue");
    wrapper.unmount();
  });

  it("shows ListenIn on the rejoin landing for Guess the Song", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref(playerState),
      playerId: ref("player-id"),
      landingSeen: ref(false),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(currentRound),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen: vi.fn(),
    });

    const wrapper = mountView();

    expect(mockListenInSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("never renders ListenIn in the joined game view for Guess the Song", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));

    const wrapper = mountView();

    expect(mockListenInSetup).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("warns the player when the connection degrades mid-game", async () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));

    const wrapper = mountView();
    const banner = wrapper.findComponent({
      name: "MusicQuizConnectionBanners",
    });
    expect(banner.props("degraded")).toBe(false);

    apiMock.state.value = "reconnecting";
    await nextTick();

    expect(banner.props("degraded")).toBe(true);
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
      landingSeen: ref(true),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen: vi.fn(),
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

  it("enables Music Timeline ListenIn on the rejoin landing without fetching lyrics", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref(musicTimelineState),
      playerId: ref("player-id"),
      landingSeen: ref(false),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(musicTimelineRound),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen: vi.fn(),
    });

    const wrapper = mountView();

    expect(mockListenInSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(true);
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("passes the placement and bonus results to the player header during timeline reveal", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref({
        ...musicTimelineState,
        phase: "reveal",
        you: {
          ...musicTimelineState.you,
          answer: {
            previous_entry_id: null,
            next_entry_id: "anchor",
            answered_at: 1,
            bonuses: [],
            finished: true,
            correct: true,
            points: 10,
            bonus_results: [
              { bonus_type: "artist", correct: false, points: 0 },
            ],
          },
        },
      }),
      playerId: ref("player-id"),
      landingSeen: ref(true),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(musicTimelineRound),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen: vi.fn(),
    });

    const wrapper = mountView();

    expect(
      wrapper.findComponent(MusicQuizPlayerHeader).props("roundResults"),
    ).toEqual([
      {
        key: "placement",
        label: "providers.music_quiz.timeline_result_placement",
        correct: true,
        points: 10,
      },
      {
        key: "artist",
        label: "providers.music_quiz.timeline_artist_bonus",
        correct: false,
        points: 0,
      },
    ]);
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

  it("shows the mode label and ListenIn on the landing before joining reveal-audio Trivia", () => {
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
    // The landing now offers ListenIn before joining too, not just once in.
    expect(mockListenInSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(true);
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

  it("primes audio, arms auto-listen, and dismisses the landing after a Remote join", async () => {
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
    const landingSeen = ref(false);
    const markLandingSeen = vi.fn();
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
      landingSeen,
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: activeRound,
      join,
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen,
    });
    const wrapper = mountView();

    wrapper.getComponent(MusicQuizJoinForm).vm.$emit("join", "Guest");
    await flushPromises();

    expect(mockPrimeAudio).toHaveBeenCalledOnce();
    expect(join).toHaveBeenCalledWith("Guest");
    expect(mockListenInSetup).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "remote" }),
    );
    expect(mockRequestAutoEnable).toHaveBeenCalledOnce();
    expect(markLandingSeen).toHaveBeenCalledOnce();
  });

  it("does not arm auto-listen or dismiss the landing when a Remote join fails", async () => {
    const info = ref({
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      phase: "lobby",
      name: "Quiz",
      player_count: 0,
      round_count: 5,
      mode: "remote",
    });
    const markLandingSeen = vi.fn();
    const join = vi.fn(async () => {
      // The composable leaves playerId null on a failed join.
    });
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info,
      state: ref(null),
      playerId: ref<string | null>(null),
      rememberedName: ref(""),
      landingSeen: ref(false),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join,
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen,
    });
    const wrapper = mountView();

    wrapper.getComponent(MusicQuizJoinForm).vm.$emit("join", "Guest");
    await flushPromises();

    // Priming still happens on the click gesture itself, before the join
    // outcome is known.
    expect(mockPrimeAudio).toHaveBeenCalledOnce();
    expect(join).toHaveBeenCalledWith("Guest");
    expect(mockRequestAutoEnable).not.toHaveBeenCalled();
    expect(markLandingSeen).not.toHaveBeenCalled();
    // The landing (join form) stays up for a retry.
    expect(wrapper.findComponent(MusicQuizJoinForm).exists()).toBe(true);
  });

  it("primes audio and arms auto-listen for a Venue join too, without gating on mode", async () => {
    const info = ref({
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      phase: "lobby",
      name: "Quiz",
      player_count: 0,
      round_count: 5,
      mode: "venue",
    });
    const state = ref<typeof playerState | null>(null);
    const playerId = ref<string | null>(null);
    const activeRound = ref<typeof currentRound | null>(null);
    const markLandingSeen = vi.fn();
    const join = vi.fn(async () => {
      state.value = { ...playerState, mode: "venue" };
      playerId.value = "player-id";
      activeRound.value = currentRound;
    });
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info,
      state,
      playerId,
      rememberedName: ref(""),
      landingSeen: ref(false),
      gameRemoved: ref(false),
      busy: ref(false),
      loading: ref(false),
      currentRound: activeRound,
      join,
      submitAnswer: vi.fn(),
      ready: vi.fn(),
      markLandingSeen,
    });
    const wrapper = mountView();

    wrapper.getComponent(MusicQuizJoinForm).vm.$emit("join", "Guest");
    await flushPromises();

    expect(mockPrimeAudio).toHaveBeenCalledOnce();
    expect(mockListenInSetup).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "venue" }),
    );
    expect(mockRequestAutoEnable).toHaveBeenCalledOnce();
    expect(markLandingSeen).toHaveBeenCalledOnce();
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

  it.each([
    ["waiting", false],
    ["ended", true],
  ])(
    "lets a regular user return to the host panel when %s",
    async (_, ended) => {
      mockUseMusicQuizPlayer.mockReturnValue({
        info: ref(null),
        state: ref(null),
        playerId: ref(null),
        gameRemoved: ref(ended),
        busy: ref(false),
        loading: ref(false),
        currentRound: ref(null),
        join: vi.fn(),
        submitAnswer: vi.fn(),
        ready: vi.fn(),
      });

      const wrapper = mountView();
      const returnButton = wrapper.get('[data-testid="return-to-host-panel"]');
      expect(returnButton.text()).toContain("Return to host panel");

      await returnButton.trigger("click");

      expect(mockRouterPush).toHaveBeenCalledWith({ name: "music-quiz" });
      wrapper.unmount();
    },
  );

  it.each([
    ["waiting", false],
    ["ended", true],
  ])("keeps the host panel action hidden for guests when %s", (_, ended) => {
    isGuestSession.value = true;
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref(null),
      playerId: ref(null),
      gameRemoved: ref(ended),
      busy: ref(false),
      loading: ref(false),
      currentRound: ref(null),
      join: vi.fn(),
      submitAnswer: vi.fn(),
      ready: vi.fn(),
    });

    const wrapper = mountView();

    expect(wrapper.find('[data-testid="return-to-host-panel"]').exists()).toBe(
      false,
    );
    wrapper.unmount();
  });

  describe("landing screen", () => {
    it("shows the how-to-play explanation and join form for a new player", () => {
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
        rememberedName: ref(""),
        gameRemoved: ref(false),
        busy: ref(false),
        loading: ref(false),
        currentRound: ref(null),
        join: vi.fn(),
        submitAnswer: vi.fn(),
        ready: vi.fn(),
        markLandingSeen: vi.fn(),
      });

      const wrapper = mountView();

      expect(wrapper.text()).toContain(
        "providers.music_quiz.game_type_guess_the_song",
      );
      expect(wrapper.findComponent(MusicQuizJoinForm).exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="music-quiz-landing-continue"]').exists(),
      ).toBe(false);
      expect(mockGameAdapterSetup).not.toHaveBeenCalled();
      wrapper.unmount();
    });

    it("shows the game view once joined, with the landing gone", async () => {
      const info = ref({
        quiz_type: "guess_the_song",
        answer_type: "multiple_choice",
        phase: "lobby",
        name: "Quiz",
        player_count: 0,
        round_count: 5,
        mode: "venue",
      });
      const state = ref<typeof playerState | null>(null);
      const playerId = ref<string | null>(null);
      const activeRound = ref<typeof currentRound | null>(null);
      const landingSeen = ref(false);
      const join = vi.fn(async () => {
        state.value = playerState;
        playerId.value = "player-id";
        activeRound.value = currentRound;
      });
      mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
      mockUseMusicQuizPlayer.mockReturnValue({
        info,
        state,
        playerId,
        rememberedName: ref(""),
        landingSeen,
        gameRemoved: ref(false),
        busy: ref(false),
        loading: ref(false),
        currentRound: activeRound,
        join,
        submitAnswer: vi.fn(),
        ready: vi.fn(),
        // markLandingSeen mirrors the composable closely enough to drive the
        // template: it flips the same landingSeen ref the view reads from.
        markLandingSeen: vi.fn(() => {
          landingSeen.value = true;
        }),
      });

      const wrapper = mountView();
      wrapper.getComponent(MusicQuizJoinForm).vm.$emit("join", "Guest");
      await flushPromises();

      expect(mockGameAdapterSetup).toHaveBeenCalledOnce();
      expect(wrapper.findComponent(MusicQuizJoinForm).exists()).toBe(false);
      expect(wrapper.find('[data-testid="listen-in"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it("shows a Continue button for an auto-rejoined player who has not seen the landing", async () => {
      const landingSeen = ref(false);
      const markLandingSeen = vi.fn(() => {
        landingSeen.value = true;
      });
      mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
      mockUseMusicQuizPlayer.mockReturnValue({
        info: ref(null),
        state: ref(playerState),
        playerId: ref("player-id"),
        landingSeen,
        gameRemoved: ref(false),
        busy: ref(false),
        loading: ref(false),
        currentRound: ref(currentRound),
        join: vi.fn(),
        submitAnswer: vi.fn(),
        ready: vi.fn(),
        markLandingSeen,
      });

      const wrapper = mountView();

      expect(wrapper.text()).toContain(
        "providers.music_quiz.game_type_guess_the_song",
      );
      expect(mockGameAdapterSetup).not.toHaveBeenCalled();
      const continueButton = wrapper.get(
        '[data-testid="music-quiz-landing-continue"]',
      );

      await continueButton.trigger("click");
      await flushPromises();

      expect(mockPrimeAudio).toHaveBeenCalledOnce();
      expect(mockRequestAutoEnable).toHaveBeenCalledOnce();
      expect(markLandingSeen).toHaveBeenCalledOnce();
      expect(mockGameAdapterSetup).toHaveBeenCalledOnce();
      expect(
        wrapper.find('[data-testid="music-quiz-landing-continue"]').exists(),
      ).toBe(false);
      wrapper.unmount();
    });

    it("skips straight to the game view once the landing was already seen", () => {
      mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
      mockUseMusicQuizPlayer.mockReturnValue({
        info: ref(null),
        state: ref(playerState),
        playerId: ref("player-id"),
        landingSeen: ref(true),
        gameRemoved: ref(false),
        busy: ref(false),
        loading: ref(false),
        currentRound: ref(currentRound),
        join: vi.fn(),
        submitAnswer: vi.fn(),
        ready: vi.fn(),
        markLandingSeen: vi.fn(),
      });

      const wrapper = mountView();

      expect(mockGameAdapterSetup).toHaveBeenCalledOnce();
      expect(
        wrapper.find('[data-testid="music-quiz-landing-continue"]').exists(),
      ).toBe(false);
      wrapper.unmount();
    });
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
      icon: { render: () => h("span", { "data-testid": "game-icon" }) },
      labelKey: "providers.music_quiz.game_type_guess_the_song",
      howToPlayDescriptionKey:
        "providers.music_quiz.how_to_play_guess_the_song_description",
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
