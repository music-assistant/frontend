import MusicQuizDashboardView from "@/views/MusicQuizDashboardView.vue";
import { mount } from "@vue/test-utils";
import { nextTick, ref, type Ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDeleteGame, mockResolveMusicQuizDefinition, mockUseMusicQuizHost } =
  vi.hoisted(() => ({
    mockDeleteGame: vi.fn(),
    mockResolveMusicQuizDefinition: vi.fn(),
    mockUseMusicQuizHost: vi.fn(),
  }));

vi.mock("@/composables/useMusicQuizHost", () => ({
  useMusicQuizHost: mockUseMusicQuizHost,
}));

vi.mock("@/components/music-quiz/game_types", () => ({
  resolveMusicQuizDefinition: mockResolveMusicQuizDefinition,
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
  phase: "lobby",
  name: "Quiz",
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
} as const;

let state: Ref<typeof HOST_STATE | null>;

describe("MusicQuizDashboardView host actions", () => {
  beforeEach(() => {
    state = ref({ ...HOST_STATE });
    mockDeleteGame.mockReset();
    mockDeleteGame.mockResolvedValue(true);
    mockResolveMusicQuizDefinition.mockReset();
    mockResolveMusicQuizDefinition.mockReturnValue({
      answer: { adapters: {} },
      game: {
        adapters: {},
        revealActionKey: "providers.music_quiz.phase_reveal",
        revealPhaseKey: "providers.music_quiz.phase_enjoy_track",
      },
    });
    mockUseMusicQuizHost.mockReset();
    mockUseMusicQuizHost.mockReturnValue({
      busy: ref(false),
      create: vi.fn(),
      currentRound: ref(null),
      deleteGame: mockDeleteGame,
      isLastRound: ref(false),
      joinLink: ref(HOST_STATE.join_url),
      loading: ref(false),
      next: vi.fn(),
      phaseLabel: ref("Waiting for players"),
      reset: vi.fn(),
      reveal: vi.fn(),
      start: vi.fn(),
      state,
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

    await wrapper.get('[data-testid="confirm-end-game"]').trigger("click");
    expect(mockDeleteGame).toHaveBeenCalledOnce();
  });

  it("returns to the setup wizard when the host state is cleared", async () => {
    const wrapper = mountDashboard();

    expect(wrapper.find('[data-testid="setup-wizard"]').exists()).toBe(false);
    state.value = null;
    await nextTick();

    expect(wrapper.find('[data-testid="setup-wizard"]').exists()).toBe(true);
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
          template: "<div><slot /></div>",
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
        MusicQuizHostPanel: {
          emits: ["endGame"],
          template:
            '<button data-testid="open-end-dialog" @click="$emit(\'endGame\')" />',
        },
        MusicQuizPresentStage: true,
        MusicQuizSessionPanels: true,
        MusicQuizSetupWizard: {
          template: '<div data-testid="setup-wizard" />',
        },
        MusicQuizUnsupportedGame: true,
      },
    },
  });
}
