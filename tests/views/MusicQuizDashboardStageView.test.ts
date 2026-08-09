import MusicQuizDashboardStageView from "@/views/MusicQuizDashboardStageView.vue";
import type { MusicQuizPublicState } from "@/composables/music-quiz/useMusicQuiz";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  dashboardMock,
  mockCelebrate,
  mockResolveMusicQuizDefinition,
} = vi.hoisted(() => ({
  apiMock: { state: { value: "connected" as string } },
  dashboardMock: {
    state: { value: null } as { value: MusicQuizPublicState | null },
    loading: { value: false },
  },
  mockCelebrate: vi.fn(),
  mockResolveMusicQuizDefinition: vi.fn(),
}));

vi.mock("@/plugins/api", async () => {
  // The connection banner re-renders on api.state, so the mock has to carry a
  // real ref: assignments to a plain { value } would never reach the computed.
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.state = ref(apiMock.state.value);
  const api = { state: apiMock.state };
  return {
    api,
    default: api,
    ConnectionState: {
      RECONNECTING: "reconnecting",
      DISCONNECTED: "disconnected",
    },
  };
});

vi.mock("@/composables/music-quiz/useMusicQuizDashboard", async () => {
  const { computed, ref } = await vi.importActual<typeof import("vue")>("vue");
  const state = ref<MusicQuizPublicState | null>(null);
  const loading = ref(dashboardMock.loading.value);
  dashboardMock.state = state;
  dashboardMock.loading = loading;
  const currentRound = computed(() =>
    state.value && "current_round" in state.value
      ? (state.value.current_round ?? null)
      : null,
  );
  const joinLink = computed(() => state.value?.join_url ?? "");
  return {
    useMusicQuizDashboard: () => ({
      state,
      loading,
      currentRound,
      joinLink,
      fetchState: vi.fn(),
    }),
  };
});

vi.mock("@/composables/music-quiz/useMusicQuizCelebration", () => ({
  useMusicQuizCelebration: () => ({ celebrate: mockCelebrate }),
}));

vi.mock("@/components/music-quiz/game_types", () => ({
  getMusicQuizPhaseLabelKey: (_game: unknown, phase: string) =>
    `providers.music_quiz.phase_${phase}`,
  resolveMusicQuizDefinition: mockResolveMusicQuizDefinition,
}));

// Stubbing a component does not stop the view from importing it: MusicQuizQrCard
// still pulls in the share sheet, so its helpers need mocks too.
vi.mock("@/helpers/utils", () => ({
  copyToClipboard: vi.fn(),
  getMediaImageUrl: (url: string) => url,
}));

vi.mock("@/helpers/qr", () => ({
  renderQrCode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/helpers/invitation_share", () => ({
  createInvitationFile: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values: unknown[] = []) =>
    values.length ? `${key}:${String(values[0])}` : key,
  canonicalizeLocale: (locale: string) => locale,
  i18n: { global: { locale: { value: "en" } } },
}));

const guessTheSongRound = {
  round_index: 2,
  started_at: 10,
  deadline: 40,
  auto_advance_at: null,
  question: null,
  suggestions: [{ suggestion_id: "one", label: "One" }],
};

function lobbyState(
  overrides: Record<string, unknown> = {},
): MusicQuizPublicState {
  return {
    quiz_type: "guess_the_song",
    answer_type: "multiple_choice",
    phase: "lobby",
    name: "Friday Quiz",
    round_count: 10,
    suggestion_count: 4,
    answer_duration: 30,
    mode: "venue",
    players: [],
    current_round: null,
    join_url: "http://ma/join",
    ...overrides,
  } as MusicQuizPublicState;
}

function player(name: string, score: number, answered = false) {
  return {
    name,
    score,
    ready: false,
    answered,
    active_from_round: 0,
    ...(score > 0
      ? { last_answer: { suggestion_id: "one", points: score } }
      : {}),
  };
}

function createDefinition(
  overrides: {
    answeringPromptKey?: string;
    usesRevealCountdown?: boolean;
  } = {},
) {
  return {
    game: {
      id: "guess_the_song",
      answeringPromptKey: overrides.answeringPromptKey,
      usesRevealCountdown: overrides.usesRevealCountdown ?? false,
      adapters: {
        present: {
          props: { state: Object, currentRound: Object },
          template: '<div data-testid="game-adapter" />',
        },
      },
    },
    answer: {
      adapters: {
        present: {
          props: { state: Object, currentRound: Object },
          template:
            '<div data-testid="answer-adapter"><slot name="leaderboard" /></div>',
        },
      },
    },
  };
}

function mountView() {
  return mount(MusicQuizDashboardStageView, {
    global: {
      stubs: {
        MusicQuizAutoStartStatus: true,
        MusicQuizConnectionBanners: true,
        MusicQuizPreparingState: true,
        MusicQuizLeaderboard: {
          props: ["rows"],
          template:
            '<div data-testid="leaderboard" :data-rows="rows.length" />',
        },
        MusicQuizPlayerTile: {
          props: ["name"],
          template: '<div data-testid="player-tile">{{ name }}</div>',
        },
        MusicQuizPodium: {
          props: ["rows"],
          template: '<div data-testid="podium" :data-rows="rows.length" />',
        },
        MusicQuizQrCard: {
          // Boolean must be typed explicitly: the untyped array form leaves
          // the `hide-share-actions` shorthand as the literal string "".
          props: { joinLink: String, hideShareActions: Boolean },
          template:
            '<div data-testid="qr-card" :data-join-link="joinLink" :data-hide-share="String(hideShareActions)" />',
        },
      },
    },
  });
}

describe("MusicQuizDashboardStageView", () => {
  beforeEach(() => {
    apiMock.state.value = "connected";
    dashboardMock.state.value = null;
    dashboardMock.loading.value = false;
    mockCelebrate.mockReset();
    mockResolveMusicQuizDefinition.mockReset();
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition());
  });

  it("shows the waiting screen without an active game", () => {
    const wrapper = mountView();

    expect(
      wrapper.get('[data-testid="music-quiz-dashboard-waiting"]').text(),
    ).toContain("providers.music_quiz.dashboard_waiting");
    expect(
      wrapper.find('[data-testid="music-quiz-dashboard-lobby"]').exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it("hides the waiting screen while the cold fetch is still in flight", () => {
    dashboardMock.loading.value = true;
    const wrapper = mountView();

    expect(
      wrapper.find('[data-testid="music-quiz-dashboard-waiting"]').exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it("falls back to the waiting screen for an unsupported game type", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(undefined);
    dashboardMock.state.value = lobbyState({ quiz_type: "future_game" });
    const wrapper = mountView();

    expect(
      wrapper.find('[data-testid="music-quiz-dashboard-waiting"]').exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it("renders the lobby with a share-free join QR and the joined players", () => {
    dashboardMock.state.value = lobbyState({
      players: [player("Bob", 0), player("Alice", 0)],
    });
    const wrapper = mountView();

    const qr = wrapper.get('[data-testid="qr-card"]');
    expect(qr.attributes("data-join-link")).toBe("http://ma/join");
    expect(qr.attributes("data-hide-share")).toBe("true");
    expect(
      wrapper.findAll('[data-testid="player-tile"]').map((tile) => tile.text()),
    ).toEqual(["Alice", "Bob"]);
    expect(wrapper.text()).toContain("Friday Quiz");
    expect(wrapper.text()).toContain("providers.music_quiz.phase_lobby");
    expect(
      wrapper.find('[data-testid="music-quiz-dashboard-round"]').exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it("hides the join QR when the server does not report a join url", () => {
    dashboardMock.state.value = lobbyState({ join_url: undefined });
    const wrapper = mountView();

    expect(wrapper.find('[data-testid="qr-card"]').exists()).toBe(false);
    expect(
      wrapper.find('[data-testid="music-quiz-dashboard-lobby"]').exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it("drives answering through the present adapters and caps the board at six", () => {
    dashboardMock.state.value = lobbyState({
      phase: "answering",
      current_round: guessTheSongRound,
      players: Array.from({ length: 9 }, (_, index) =>
        player(`P${index}`, 9 - index),
      ),
    });
    mockResolveMusicQuizDefinition.mockReturnValue(
      createDefinition({
        answeringPromptKey: "providers.music_quiz.name_that_track",
      }),
    );
    const wrapper = mountView();

    expect(wrapper.find('[data-testid="game-adapter"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="answer-adapter"]').exists()).toBe(true);
    expect(
      wrapper.get('[data-testid="leaderboard"]').attributes("data-rows"),
    ).toBe("6");
    expect(
      wrapper.get('[data-testid="music-quiz-dashboard-listening"]').text(),
    ).toBe("providers.music_quiz.name_that_track");
    expect(
      wrapper.get('[data-testid="music-quiz-dashboard-round"]').text(),
    ).toBe("providers.music_quiz.round_label 3 / 10");
    wrapper.unmount();
  });

  it("washes the reveal artwork behind the stage and counts to the next round", () => {
    dashboardMock.state.value = lobbyState({
      phase: "reveal",
      current_round: {
        ...guessTheSongRound,
        auto_advance_at: Date.now() / 1000 + 8,
        answer_label: "Song - Artist",
        image_url: "http://example.com/art.jpg",
      },
      players: [player("Alice", 100)],
    });
    const wrapper = mountView();

    const backdrop = wrapper.get(
      '[data-testid="music-quiz-dashboard-backdrop"]',
    );
    expect(backdrop.attributes("style")).toContain(
      "http://example.com/art.jpg",
    );
    expect(
      wrapper.get('[data-testid="music-quiz-dashboard-next-round"]').text(),
    ).toContain("providers.music_quiz.next_round_in");
    expect(
      wrapper.get('[data-testid="leaderboard"]').attributes("data-rows"),
    ).toBe("1");
    // reveal puts the answer/leaderboard column next to the game adapter,
    // mirroring the host present stage's two-column layout
    const layout = wrapper.get(
      '[data-testid="music-quiz-dashboard-reveal-layout"]',
    );
    expect(layout.find('[data-testid="game-adapter"]').exists()).toBe(true);
    expect(layout.find('[data-testid="answer-adapter"]').exists()).toBe(true);
    expect(layout.classes()).toContain(
      "lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]",
    );
    wrapper.unmount();
  });

  it("leaves the reveal countdown to game types that render their own", () => {
    mockResolveMusicQuizDefinition.mockReturnValue(
      createDefinition({ usesRevealCountdown: true }),
    );
    dashboardMock.state.value = lobbyState({
      phase: "reveal",
      current_round: {
        ...guessTheSongRound,
        auto_advance_at: Date.now() / 1000 + 8,
      },
      players: [player("Alice", 100)],
    });
    const wrapper = mountView();

    expect(
      wrapper.find('[data-testid="music-quiz-dashboard-next-round"]').exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it("celebrates the finale with a podium and the winner text", async () => {
    dashboardMock.state.value = lobbyState({
      phase: "finished",
      current_round: { ...guessTheSongRound, image_url: null },
      players: [player("Alice", 300), player("Bob", 100)],
    });
    const wrapper = mountView();
    await flushPromises();

    expect(
      wrapper.find('[data-testid="music-quiz-dashboard-finished"]').exists(),
    ).toBe(true);
    expect(wrapper.get('[data-testid="podium"]').attributes("data-rows")).toBe(
      "2",
    );
    expect(wrapper.text()).toContain("providers.music_quiz.winner_single");
    expect(mockCelebrate).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("returns to the waiting screen when the game is removed mid-cast", async () => {
    dashboardMock.state.value = lobbyState();
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="qr-card"]').exists()).toBe(true);

    dashboardMock.state.value = null;
    await nextTick();

    expect(
      wrapper.find('[data-testid="music-quiz-dashboard-waiting"]').exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it("warns the room when the connection degrades", async () => {
    dashboardMock.state.value = lobbyState();
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
});
