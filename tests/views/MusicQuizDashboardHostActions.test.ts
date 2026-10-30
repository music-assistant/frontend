import MusicQuizPreparingState from "@/components/music-quiz/MusicQuizPreparingState.vue";
import MusicQuizDashboardView from "@/views/MusicQuizDashboardView.vue";
import type {
  MusicQuizSupportedHostState,
  MusicQuizTriviaHostState,
} from "@/composables/music-quiz/useMusicQuiz";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, ref, type Ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDeleteGame,
  mockFetchPlaybackOptions,
  mockReplay,
  mockResolveMusicQuizDefinition,
  mockStart,
  mockUseMusicQuizHost,
} = vi.hoisted(() => ({
  mockDeleteGame: vi.fn(),
  mockFetchPlaybackOptions: vi.fn(),
  mockReplay: vi.fn(),
  mockResolveMusicQuizDefinition: vi.fn(),
  mockStart: vi.fn(),
  mockUseMusicQuizHost: vi.fn(),
}));

vi.mock("@/composables/music-quiz/useMusicQuizHost", () => ({
  useMusicQuizHost: mockUseMusicQuizHost,
}));

vi.mock("@/components/music-quiz/game_types", () => ({
  getMusicQuizPhaseLabelKey: () =>
    "providers.music_quiz.phase_waiting_for_players",
  resolveMusicQuizDefinition: mockResolveMusicQuizDefinition,
  supportsMusicQuizListenIn: (
    _game: unknown,
    state: { quiz_type: string; play_reveal_audio?: boolean },
  ) => state.quiz_type !== "trivia" || state.play_reveal_audio === true,
}));

vi.mock("@/helpers/music_quiz", () => ({
  getMusicQuizRoundScoreLabel: () => "",
  getMusicQuizWinnerText: () => "",
  rankMusicQuizPlayers: () => [],
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    state: { value: "initialized" },
  },
  ConnectionState: {
    DISCONNECTED: "disconnected",
    RECONNECTING: "reconnecting",
  },
}));

// signed in as a member
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../fixtures/scopes");
  return {
    authManager: { hasScope: scopeChecker(BUILTIN_ROLE_SCOPES.user) },
  };
});

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) =>
    ({
      cancel: "Cancel",
      "providers.music_quiz.end_game": "End game",
      "providers.music_quiz.end_game_confirm":
        "Are you sure you want to end this game? This will remove the current game for all players.",
    })[key] ?? key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const HOST_STATE = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "finished",
  name: "Quiz",
  include_similar_music: false,
  auto_start_at: null,
  round_count: 5,
  suggestion_count: 4,
  answer_duration: 30,
  mode: "venue",
  players: [],
  created_at: 1,
  sources: [],
  join_url: "http://join",
  rounds: [],
  current_round: null,
  playback: { mode: "venue", venue_player_id: null, venue_player_name: null },
} satisfies MusicQuizSupportedHostState;
const TRIVIA_HOST_STATE = {
  ...HOST_STATE,
  quiz_type: "trivia",
  language: "en",
  play_reveal_audio: true,
  rounds: [],
} satisfies MusicQuizTriviaHostState;

let state: Ref<MusicQuizSupportedHostState | null>;
let busy: Ref<boolean>;
let starting: Ref<boolean>;

describe("MusicQuizDashboardView host actions", () => {
  beforeEach(() => {
    // the invite popup remembers which game it already opened for
    localStorage.clear();
    state = ref({ ...HOST_STATE });
    busy = ref(false);
    starting = ref(false);
    mockDeleteGame.mockReset();
    mockDeleteGame.mockResolvedValue(true);
    mockFetchPlaybackOptions.mockReset();
    mockFetchPlaybackOptions.mockResolvedValue(undefined);
    mockReplay.mockReset();
    mockReplay.mockResolvedValue(true);
    mockStart.mockReset();
    mockStart.mockResolvedValue(true);
    mockResolveMusicQuizDefinition.mockReset();
    mockResolveMusicQuizDefinition.mockReturnValue({
      answer: { adapters: {} },
      game: { adapters: {} },
    });
    mockUseMusicQuizHost.mockReset();
    mockUseMusicQuizHost.mockReturnValue({
      busy,
      availableQuizTypes: ref(["guess_the_song", "music_timeline"]),
      create: vi.fn(),
      currentRound: ref(null),
      deleteGame: mockDeleteGame,
      isLastRound: ref(false),
      joinLink: ref(HOST_STATE.join_url),
      loading: ref(false),
      playbackOptions: ref(null),
      playbackOptionsLoading: ref(false),
      playbackOptionsError: ref(false),
      next: vi.fn(),
      replay: mockReplay,
      reveal: vi.fn(),
      start: mockStart,
      starting,
      state,
      fetchPlaybackOptions: mockFetchPlaybackOptions,
    });
  });

  it("uses end-game wording and action in the host confirmation", async () => {
    const wrapper = mountDashboard();

    expect(wrapper.find('[data-testid="end-dialog"]').exists()).toBe(false);
    await wrapper.get('[data-testid="open-end-dialog"]').trigger("click");

    const dialog = wrapper.get('[data-testid="end-dialog"]');
    expect(dialog.text()).toContain("End game");
    expect(dialog.text()).toContain(
      "Are you sure you want to end this game? This will remove the current game for all players.",
    );
    expect(dialog.text()).not.toContain("Delete");

    const confirmButton = wrapper.get('[data-testid="confirm-end-game"]');
    expect(confirmButton.classes()).toContain("bg-destructive");
    expect(
      dialog.get('[data-testid="end-dialog-content"]').classes(),
    ).toContain("sm:max-w-sm");

    await confirmButton.trigger("click");
    expect(mockDeleteGame).toHaveBeenCalledOnce();
  });

  it("replays immediately without deleting or opening setup", async () => {
    const wrapper = mountDashboard();

    await wrapper.get('[data-testid="play-again"]').trigger("click");
    await flushPromises();

    expect(mockReplay).toHaveBeenCalledOnce();
    expect(mockDeleteGame).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="stepped-setup"]').exists()).toBe(false);
  });

  it("keeps the finished game when replay reset fails", async () => {
    mockReplay.mockResolvedValue(false);
    const wrapper = mountDashboard();

    await wrapper.get('[data-testid="play-again"]').trigger("click");
    await flushPromises();

    expect(state.value?.phase).toBe("finished");
    expect(wrapper.find('[data-testid="play-again"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stepped-setup"]').exists()).toBe(false);
  });

  it("starts a scheduled replay early exactly once", async () => {
    const wrapper = mountDashboard();

    await wrapper.get('[data-testid="start-quiz"]').trigger("click");

    expect(mockStart).toHaveBeenCalledOnce();
  });

  it("shows preparation progress while the game starts", async () => {
    state.value = { ...HOST_STATE, phase: "lobby" };
    let finishStart!: () => void;
    mockStart.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          starting.value = true;
          finishStart = () => {
            starting.value = false;
            resolve(true);
          };
        }),
    );
    const wrapper = mountDashboard();

    await wrapper.get('[data-testid="start-quiz"]').trigger("click");

    const status = wrapper.get('[data-testid="music-quiz-preparing"]');
    expect(status.attributes("role")).toBe("status");
    expect(status.text()).toContain("providers.music_quiz.preparing_game");
    expect(
      wrapper.findComponent(MusicQuizPreparingState).props("autofocus"),
    ).toBe(true);
    expect(wrapper.find('[data-testid="start-quiz"]').exists()).toBe(false);

    finishStart();
    await flushPromises();

    expect(wrapper.find('[data-testid="music-quiz-preparing"]').exists()).toBe(
      false,
    );
  });

  it("shows preparation progress when the server reports preparing", async () => {
    state.value = { ...HOST_STATE, preparing: true };
    const wrapper = mountDashboard();

    expect(
      wrapper.get('[data-testid="music-quiz-preparing"]').text(),
    ).toContain("providers.music_quiz.preparing_game");
    // A host tab that did not issue the action must not have focus pulled away.
    expect(
      wrapper.findComponent(MusicQuizPreparingState).props("autofocus"),
    ).toBe(false);
    expect(wrapper.find('[data-testid="play-again"]').exists()).toBe(false);

    state.value = { ...HOST_STATE, preparing: false };
    await nextTick();

    expect(wrapper.find('[data-testid="music-quiz-preparing"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="play-again"]').exists()).toBe(true);
  });

  it("deletes the finished game before opening fresh setup", async () => {
    let finishDelete!: () => void;
    mockDeleteGame.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finishDelete = () => {
            state.value = null;
            resolve(true);
          };
        }),
    );
    const wrapper = mountDashboard();

    await wrapper.get('[data-testid="set-up-new-game"]').trigger("click");
    expect(mockDeleteGame).toHaveBeenCalledOnce();
    expect(wrapper.find('[data-testid="stepped-setup"]').exists()).toBe(false);

    finishDelete();
    await flushPromises();
    expect(wrapper.find('[data-testid="stepped-setup"]').exists()).toBe(true);
    expect(mockFetchPlaybackOptions).toHaveBeenCalledOnce();
  });

  it("retains the finished game when fresh setup deletion fails", async () => {
    mockDeleteGame.mockResolvedValue(false);
    const wrapper = mountDashboard();

    await wrapper.get('[data-testid="set-up-new-game"]').trigger("click");
    await flushPromises();

    expect(mockDeleteGame).toHaveBeenCalledOnce();
    expect(state.value).toEqual(HOST_STATE);
    expect(wrapper.find('[data-testid="stepped-setup"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="play-again"]').exists()).toBe(true);
  });

  it("prevents overlapping replay and fresh setup actions", async () => {
    mockReplay.mockImplementation(() => {
      busy.value = true;
      return Promise.resolve(true);
    });
    const wrapper = mountDashboard();

    const replayClick = wrapper
      .get('[data-testid="play-again"]')
      .trigger("click");
    await wrapper.get('[data-testid="set-up-new-game"]').trigger("click");
    await replayClick;

    expect(mockReplay).toHaveBeenCalledOnce();
    expect(mockDeleteGame).not.toHaveBeenCalled();
  });

  it("keeps Present mode available", async () => {
    const wrapper = mountDashboard();
    const root = wrapper.get('[data-testid="music-quiz-dashboard-root"]');

    expect(root.classes()).toEqual(
      expect.arrayContaining(["mx-auto", "max-w-6xl", "p-4"]),
    );
    expect(root.classes()).not.toContain("lg:h-full");
    expect(wrapper.find('[data-testid="music-quiz-cast"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="music-quiz-player-bar"]').exists()).toBe(
      true,
    );

    await wrapper.get('[data-testid="enter-present"]').trigger("click");

    expect(wrapper.find('[data-testid="present-stage"]').exists()).toBe(true);
    // the header (and its cast button) and the quiz bar give way to the
    // present stage
    expect(wrapper.find('[data-testid="music-quiz-cast"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="music-quiz-player-bar"]').exists()).toBe(
      false,
    );
    expect(root.classes()).toEqual(
      expect.arrayContaining([
        "w-full",
        "lg:h-full",
        "lg:min-h-0",
        "lg:overflow-hidden",
      ]),
    );
    expect(root.classes()).not.toContain("mx-auto");
    expect(root.classes()).not.toContain("p-4");
  });

  it("keeps the playback badge to the present stage of reveal-audio Trivia", async () => {
    state.value = {
      ...TRIVIA_HOST_STATE,
      play_reveal_audio: true,
    };
    const wrapper = mountDashboard();
    await nextTick();

    // the quiz bar is the one place on the host page that says where the
    // music plays, so the compact header never gets the mode chip
    expect(
      wrapper
        .get('[data-testid="session-header"]')
        .attributes("data-listen-in-enabled"),
    ).toBe("false");
    expect(wrapper.find('[data-testid="music-quiz-player-bar"]').exists()).toBe(
      true,
    );

    await wrapper.get('[data-testid="enter-present"]').trigger("click");
    expect(
      wrapper
        .get('[data-testid="present-stage"]')
        .attributes("data-listen-in-enabled"),
    ).toBe("true");

    state.value = {
      ...TRIVIA_HOST_STATE,
      play_reveal_audio: false,
    };
    await nextTick();

    expect(
      wrapper
        .get('[data-testid="present-stage"]')
        .attributes("data-listen-in-enabled"),
    ).toBe("false");
  });

  it("leaves out the quiz bar in Trivia without music", async () => {
    state.value = { ...TRIVIA_HOST_STATE, play_reveal_audio: false };
    const wrapper = mountDashboard();
    await nextTick();

    expect(wrapper.find('[data-testid="music-quiz-player-bar"]').exists()).toBe(
      false,
    );
  });

  it("opens the invite popup by itself once per game, in the lobby", async () => {
    state.value = { ...HOST_STATE, phase: "lobby", created_at: 1 };
    const wrapper = mountDashboard();
    await nextTick();

    // no QR card on the page: the join link lives in the popup
    const invite = wrapper.get('[data-testid="invite-dialog"]');
    expect(
      invite.get('[data-testid="qr-card"]').attributes("data-join-link"),
    ).toBe(HOST_STATE.join_url);
    expect(wrapper.findAll('[data-testid="qr-card"]')).toHaveLength(1);

    // the popup shouldn't sit over a round that has started
    state.value = { ...HOST_STATE, phase: "answering", created_at: 1 };
    await nextTick();
    expect(wrapper.find('[data-testid="invite-dialog"]').exists()).toBe(false);

    await wrapper.get('[data-testid="music-quiz-invite"]').trigger("click");
    expect(wrapper.find('[data-testid="invite-dialog"]').exists()).toBe(true);
    wrapper.unmount();

    // coming back to the same game doesn't reopen it, a new game does
    state.value = { ...HOST_STATE, phase: "lobby", created_at: 1 };
    const sameGame = mountDashboard();
    await nextTick();
    expect(sameGame.find('[data-testid="invite-dialog"]').exists()).toBe(false);

    state.value = { ...HOST_STATE, phase: "lobby", created_at: 2 };
    await nextTick();
    expect(sameGame.find('[data-testid="invite-dialog"]').exists()).toBe(true);
  });

  it("returns to the compact empty state when the host state is cleared", async () => {
    const wrapper = mountDashboard();

    expect(wrapper.find('[data-testid="stepped-setup"]').exists()).toBe(false);
    state.value = null;
    await nextTick();

    expect(wrapper.find('[data-testid="stepped-setup"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="new-game-empty"]').exists()).toBe(true);

    await wrapper.get('[data-testid="new-game-empty"]').trigger("click");
    expect(wrapper.find('[data-testid="stepped-setup"]').exists()).toBe(true);
    expect(mockFetchPlaybackOptions).toHaveBeenCalledOnce();

    state.value = { ...HOST_STATE };
    await nextTick();
    expect(wrapper.find('[data-testid="stepped-setup"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Game Ended");
  });
});

function mountDashboard() {
  return mount(MusicQuizDashboardView, {
    global: {
      stubs: {
        AlertDialog: {
          props: ["open"],
          template: '<div v-if="open" data-testid="end-dialog"><slot /></div>',
        },
        AlertDialogAction: {
          template: '<button data-testid="confirm-end-game"><slot /></button>',
        },
        AlertDialogCancel: {
          template: "<button><slot /></button>",
        },
        AlertDialogContent: {
          template:
            '<div data-testid="end-dialog-content" v-bind="$attrs"><slot /></div>',
        },
        AlertDialogDescription: {
          template: "<p><slot /></p>",
        },
        AlertDialogFooter: {
          template: "<footer><slot /></footer>",
        },
        AlertDialogHeader: {
          template: "<header><slot /></header>",
        },
        AlertDialogTitle: {
          template: "<h2><slot /></h2>",
        },
        MusicQuizConnectionBanners: true,
        MusicQuizSessionHeader: {
          // typed, so a missing prop reads as the real component's default
          props: { listenInEnabled: Boolean },
          template:
            '<div data-testid="session-header" :data-listen-in-enabled="String(listenInEnabled)"><slot name="actions" /></div>',
        },
        MusicQuizHostControlStrip: {
          props: ["busy"],
          emits: ["endGame", "present", "reset", "setUpNewGame", "start"],
          template:
            '<div data-testid="host-control-strip"><button data-testid="open-end-dialog" @click="$emit(\'endGame\')" /><button data-testid="enter-present" :disabled="busy" @click="$emit(\'present\')" /><button data-testid="start-quiz" :disabled="busy" @click="$emit(\'start\')" /><button data-testid="play-again" :disabled="busy" @click="$emit(\'reset\')" /><button data-testid="set-up-new-game" :disabled="busy" @click="$emit(\'setUpNewGame\')" /></div>',
        },
        MusicQuizPlayerBar: {
          template: '<div data-testid="music-quiz-player-bar" />',
        },
        MusicQuizQrCard: {
          props: ["joinLink"],
          template: '<div data-testid="qr-card" :data-join-link="joinLink" />',
        },
        MusicQuizGameSettingsSheet: true,
        MusicQuizPresentStage: {
          props: { listenInEnabled: Boolean },
          template:
            '<div data-testid="present-stage" :data-listen-in-enabled="String(listenInEnabled)" />',
        },
        MusicQuizSessionPanels: true,
        MusicQuizSteppedSetup: {
          template: '<div data-testid="stepped-setup" />',
        },
        ShowDashboardButton: {
          template: '<button data-testid="music-quiz-cast" />',
        },
        MusicQuizUnsupportedGame: true,
        Dialog: {
          props: ["open"],
          template: '<div v-if="open"><slot /></div>',
        },
        DialogContent: {
          template: "<div><slot /></div>",
        },
        DialogDescription: true,
        DialogHeader: {
          template: "<header><slot /></header>",
        },
        DialogTitle: {
          template: "<h2><slot /></h2>",
        },
      },
    },
  });
}
