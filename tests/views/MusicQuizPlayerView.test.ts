import MusicQuizPlayerView from "@/views/MusicQuizPlayerView.vue";
import MusicQuizJoinForm from "@/components/music-quiz/MusicQuizJoinForm.vue";
import MusicQuizPlayerHeader from "@/components/music-quiz/MusicQuizPlayerHeader.vue";
import MusicQuizRoundResultBanner from "@/components/music-quiz/MusicQuizRoundResultBanner.vue";
import MusicQuizSessionHeader from "@/components/music-quiz/MusicQuizSessionHeader.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { webPlayer } from "@/plugins/web_player";
import { flushPromises, mount } from "@vue/test-utils";
import { h, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  isGuestSession,
  mockAskAfterJoin,
  mockGameAdapterSetup,
  mockGetMusicQuizRoundScore,
  mockGetTrackLyrics,
  mockListenControlSetup,
  mockPrimeAudio,
  mockResolveMusicQuizDefinition,
  mockRouterPush,
  mockToastError,
  mockToastSuccess,
  mockUseMusicQuizPlayer,
} = vi.hoisted(() => ({
  apiMock: { state: { value: "connected" as string } },
  isGuestSession: { value: false },
  mockAskAfterJoin: vi.fn(),
  mockGameAdapterSetup: vi.fn(),
  mockGetMusicQuizRoundScore: vi.fn(),
  mockGetTrackLyrics: vi.fn<MusicAssistantApi["getTrackLyrics"]>(),
  mockListenControlSetup: vi.fn(),
  mockPrimeAudio: vi.fn(),
  mockResolveMusicQuizDefinition: vi.fn(),
  mockRouterPush: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUseMusicQuizPlayer: vi.fn(),
}));

// The real control teleports a headphones toggle into the guest top bar and
// talks to the server's listen-in API. The view only decides whether to show
// it, which mode it gets, and when to ask after a join.
vi.mock("@/components/music-quiz/MusicQuizListenControl.vue", async () => {
  const { h, ref } = await import("vue");
  return {
    default: {
      name: "MusicQuizListenControl",
      props: {
        mode: String,
      },
      setup(
        props: { mode?: string },
        { expose }: { expose: (exposed: object) => void },
      ) {
        mockListenControlSetup(props);
        expose({ busy: ref(false), askAfterJoin: mockAskAfterJoin });
        return () => h("div", { "data-testid": "listen-control" });
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
    mockListenControlSetup.mockReset();
    mockPrimeAudio.mockReset();
    mockPrimeAudio.mockReturnValue(true);
    mockAskAfterJoin.mockReset();
    mockAskAfterJoin.mockResolvedValue(undefined);
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
    "never shows the listen control or fetches lyrics for %s Trivia state",
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
      expect(mockListenControlSetup).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(
        false,
      );
      expect(mockGetTrackLyrics).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

  it("keeps the listen control in the joined game view for reveal-audio Trivia", () => {
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

    // The headphones toggle stays in the top bar on every in-game screen.
    expect(mockGameAdapterSetup).toHaveBeenCalledOnce();
    expect(mockListenControlSetup).toHaveBeenCalledOnce();
    expect(mockListenControlSetup).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "venue" }),
    );
    expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(true);
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("shows the reveal-audio Trivia listen control on the rejoin landing while still in the lobby", () => {
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

    expect(mockListenControlSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="music-quiz-landing-continue"]').exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it("shows the listen control on the rejoin landing for Guess the Song", () => {
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

    expect(mockListenControlSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("keeps the listen control in the joined game view for Guess the Song", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));

    const wrapper = mountView();

    expect(mockGameAdapterSetup).toHaveBeenCalledOnce();
    expect(mockListenControlSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(true);
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

  it("tells a joined player in the lobby they're in, without session or player headers", () => {
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

    expect(wrapper.find('[data-testid="music-quiz-youre-in"]').exists()).toBe(
      true,
    );
    expect(wrapper.findComponent(MusicQuizSessionHeader).exists()).toBe(false);
    expect(wrapper.findComponent(MusicQuizPlayerHeader).exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows an active round without session or player headers", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));

    const wrapper = mountView();

    expect(wrapper.find('[data-testid="game-adapter"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="answer-adapter"]').exists()).toBe(true);
    expect(wrapper.findComponent(MusicQuizSessionHeader).exists()).toBe(false);
    expect(wrapper.findComponent(MusicQuizPlayerHeader).exists()).toBe(false);
    wrapper.unmount();
  });

  it("enables the Music Timeline listen control on the rejoin landing without fetching lyrics", () => {
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

    expect(mockListenControlSetup).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(true);
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("passes a single answer result to the round result banner during a multiple-choice reveal", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
    mockUseMusicQuizPlayer.mockReturnValue({
      info: ref(null),
      state: ref({
        ...playerState,
        phase: "reveal",
        you: {
          ...playerState.you,
          answer: {
            suggestion_id: "one",
            answered_at: 1,
            correct: false,
            points: 0,
          },
        },
      }),
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
    const banner = wrapper.getComponent(MusicQuizRoundResultBanner);

    expect(banner.props("results")).toEqual([
      {
        key: "answer",
        label: "providers.music_quiz.round_result_answer",
        correct: false,
        points: 0,
      },
    ]);
    expect(banner.props("answered")).toBe(true);
    wrapper.unmount();
  });

  it("tells the round result banner when the player didn't answer", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));

    const wrapper = mountView();
    const banner = wrapper.getComponent(MusicQuizRoundResultBanner);

    expect(banner.props("results")).toEqual([]);
    expect(banner.props("answered")).toBe(false);
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.no_answer_submitted",
    );
    wrapper.unmount();
  });

  it.each(["answering", "reveal"] as const)(
    "shows a mid-round joiner You're in! instead of the answers or a result while %s",
    (phase) => {
      mockResolveMusicQuizDefinition.mockReturnValue(createDefinition(true));
      mockUseMusicQuizPlayer.mockReturnValue({
        info: ref(null),
        state: ref({
          ...playerState,
          phase,
          you: { ...playerState.you, active_from_round: 1 },
        }),
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

      expect(
        wrapper.get('[data-testid="music-quiz-youre-in"]').text(),
      ).toContain("providers.music_quiz.late_join_body");
      expect(wrapper.find('[data-testid="answer-adapter"]').exists()).toBe(
        false,
      );
      expect(wrapper.findComponent(MusicQuizRoundResultBanner).exists()).toBe(
        false,
      );
      wrapper.unmount();
    },
  );

  it("passes the placement and bonus results to the round result banner during timeline reveal", () => {
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
    const banner = wrapper.getComponent(MusicQuizRoundResultBanner);

    expect(banner.props("results")).toEqual([
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
    expect(banner.props("answered")).toBe(true);
    wrapper.unmount();
  });

  it("offers no listen control before joining Trivia without reveal audio", () => {
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

    expect(wrapper.findComponent(MusicQuizJoinForm).exists()).toBe(true);
    expect(mockListenControlSetup).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("offers the listen control on the landing before joining reveal-audio Trivia", () => {
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

    expect(mockListenControlSetup).toHaveBeenCalledOnce();
    expect(mockListenControlSetup).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "venue" }),
    );
    expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(true);
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

  it("primes audio, dismisses the landing, and asks to listen after a Remote join", async () => {
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
    expect(mockListenControlSetup).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "remote" }),
    );
    expect(markLandingSeen).toHaveBeenCalledOnce();
    // The control asks "Play the music on this phone?" for this player.
    expect(mockAskAfterJoin).toHaveBeenCalledOnce();
    expect(mockAskAfterJoin).toHaveBeenCalledWith("player-id");
  });

  it("does not ask to listen or dismiss the landing when a Remote join fails", async () => {
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
    expect(mockAskAfterJoin).not.toHaveBeenCalled();
    expect(markLandingSeen).not.toHaveBeenCalled();
    // The landing (join form) stays up for a retry.
    expect(wrapper.findComponent(MusicQuizJoinForm).exists()).toBe(true);
  });

  it("primes audio and hands a Venue join to the listen control too, which decides by mode", async () => {
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
    expect(mockListenControlSetup).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "venue" }),
    );
    // The view doesn't gate on mode; the control only asks in Remote games.
    expect(mockAskAfterJoin).toHaveBeenCalledOnce();
    expect(mockAskAfterJoin).toHaveBeenCalledWith("player-id");
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

  it("offers the listen control before joining audio games", () => {
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

    expect(wrapper.findComponent(MusicQuizJoinForm).exists()).toBe(true);
    expect(mockListenControlSetup).toHaveBeenCalledOnce();
    expect(mockListenControlSetup).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "venue" }),
    );
    expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("uses the update-required state when pair resolution fails", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(undefined);

    const wrapper = mountView();

    expect(wrapper.find('[data-testid="unsupported-game"]').exists()).toBe(
      true,
    );
    expect(mockGameAdapterSetup).not.toHaveBeenCalled();
    expect(mockListenControlSetup).not.toHaveBeenCalled();
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

      // The game is named once, inside the landing card: the game's name as
      // the title, with the game type small above it.
      expect(
        wrapper.get('[data-testid="music-quiz-landing-title"]').text(),
      ).toBe("Quiz");
      expect(
        wrapper.text().split("providers.music_quiz.game_type_guess_the_song")
          .length - 1,
      ).toBe(1);
      expect(wrapper.text()).toContain(
        "providers.music_quiz.how_to_play_guess_the_song_description",
      );
      expect(wrapper.findComponent(MusicQuizSessionHeader).exists()).toBe(
        false,
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
      expect(
        wrapper.find('[data-testid="music-quiz-landing-title"]').exists(),
      ).toBe(false);
      // The same listen control stays in the top bar from the landing into
      // the game, so its toggle keeps track of whether this phone listens.
      expect(mockListenControlSetup).toHaveBeenCalledOnce();
      expect(wrapper.find('[data-testid="listen-control"]').exists()).toBe(
        true,
      );
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
      expect(mockAskAfterJoin).toHaveBeenCalledOnce();
      expect(mockAskAfterJoin).toHaveBeenCalledWith("player-id");
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

    it("shows the loading state instead of a stale landing while a foreground refetch is in flight", async () => {
      // `resetToJoinInfo` clears the player but leaves the previous game's
      // `info` populated while `fetchInfo` runs in the foreground; the landing
      // must not render that stale info (or accept a join against it).
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
        }),
        state: ref(null),
        playerId: ref(null),
        rememberedName: ref(""),
        landingSeen: ref(false),
        gameRemoved: ref(false),
        busy: ref(false),
        loading: ref(true),
        currentRound: ref(null),
        join: vi.fn(),
        submitAnswer: vi.fn(),
        ready: vi.fn(),
        markLandingSeen: vi.fn(),
      });

      const wrapper = mountView();

      expect(wrapper.find("#music-quiz-player-name").exists()).toBe(false);
      expect(wrapper.text()).toContain("providers.music_quiz.loading");
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
      // MusicQuizYoureIn uses the globally injected $t.
      mocks: { $t: (key: string) => key },
      stubs: {
        MusicQuizConnectionBanners: true,
        MusicQuizLeaderboard: true,
        MusicQuizPodium: true,
        MusicQuizUnsupportedGame: {
          template: '<div data-testid="unsupported-game" />',
        },
      },
    },
  });
}
