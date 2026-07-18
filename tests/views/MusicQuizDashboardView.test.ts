import MusicQuizDashboardView from "@/views/MusicQuizDashboardView.vue";
import { ProviderType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAdminState,
  mockGetProviderConfigs,
  mockResolveMusicQuizDefinition,
  mockRouterPush,
  mockSendCommand,
  mockSubscribe,
  mockToastError,
} = vi.hoisted(() => ({
  mockAdminState: {
    current: undefined as { value: boolean } | undefined,
  },
  mockGetProviderConfigs: vi.fn(),
  mockResolveMusicQuizDefinition: vi.fn(),
  mockRouterPush: vi.fn(),
  mockSendCommand: vi.fn(),
  mockSubscribe: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/components/music-quiz/game_types", () => ({
  getMusicQuizPhaseLabelKey: () =>
    "providers.music_quiz.phase_waiting_for_players",
  MUSIC_QUIZ_GAME_TYPES: [],
  resolveMusicQuizDefinition: mockResolveMusicQuizDefinition,
  supportsMusicQuizListenIn: vi.fn(() => false),
}));

vi.mock("@/plugins/api", () => {
  const api = {
    sendCommand: mockSendCommand,
    subscribe: mockSubscribe,
    getProviderConfigs: mockGetProviderConfigs,
    state: { value: "connected" },
  };
  return {
    api,
    default: api,
    ConnectionState: {
      RECONNECTING: "reconnecting",
      DISCONNECTED: "disconnected",
    },
  };
});

vi.mock("@/plugins/auth", async () => {
  const { ref } = await import("vue");
  const isAdmin = ref(false);
  mockAdminState.current = isAdmin;
  return {
    authManager: {
      isAdmin: () => isAdmin.value,
    },
  };
});

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

describe("MusicQuizDashboardView", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    mockSubscribe.mockReset();
    mockToastError.mockReset();
    mockGetProviderConfigs.mockReset();
    mockResolveMusicQuizDefinition.mockReset();
    mockRouterPush.mockReset();
    if (mockAdminState.current) mockAdminState.current.value = false;
    mockGetProviderConfigs.mockResolvedValue([]);
    mockSendCommand.mockImplementation((command: string) => {
      if (command === "music_quiz/available_quiz_types") {
        return Promise.resolve(["guess_the_song", "music_timeline"]);
      }
      if (command === "music_quiz/playback_options") {
        return Promise.resolve({
          default_playback_mode: "venue",
          default_venue_player_id: "living-room",
          venue_available: true,
          remote_available: true,
          venue_players: [{ player_id: "living-room", name: "Living Room" }],
        });
      }
      return Promise.resolve(null);
    });
    mockSubscribe.mockReturnValue(() => {});
  });

  it("renders a compact empty state and opens setup on demand", async () => {
    const wrapper = mountDashboard();
    await flushPromises();

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/get");
    expect(mockSendCommand).toHaveBeenCalledWith(
      "music_quiz/available_quiz_types",
    );
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockGetProviderConfigs).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="music-quiz-settings"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("providers.music_quiz.no_active_game");
    expect(wrapper.find('[data-testid="new-game"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="new-game-empty"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="music-quiz-setup"]').exists()).toBe(
      false,
    );

    await wrapper.get('[data-testid="new-game-empty"]').trigger("click");

    const setupDialog = wrapper.get('[data-testid="setup-dialog"]');
    expect(setupDialog.classes()).toEqual(
      expect.arrayContaining(["sm:max-w-[calc(100%-2rem)]", "lg:max-w-3xl"]),
    );
    expect(setupDialog.classes()).not.toContain("sm:max-w-3xl");
    expect(wrapper.find('[data-testid="music-quiz-setup"]').exists()).toBe(
      true,
    );

    wrapper.unmount();
  });

  it("retains playback changes when setup is cancelled and reopened", async () => {
    const wrapper = mountDashboard();
    await flushPromises();

    await wrapper.get('[data-testid="new-game-empty"]').trigger("click");
    await flushPromises();
    await wrapper
      .get('[data-testid="select-remote-playback"]')
      .trigger("click");
    await wrapper.get('[data-testid="cancel-setup"]').trigger("click");

    expect(wrapper.find('[data-testid="music-quiz-setup"]').exists()).toBe(
      false,
    );

    await wrapper.get('[data-testid="new-game-empty"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="playback-mode"]').text()).toBe("remote");
  });

  it("resolves the admin settings shortcut and routes to its provider config", async () => {
    if (mockAdminState.current) mockAdminState.current.value = true;
    mockGetProviderConfigs.mockResolvedValue([
      { instance_id: "music_quiz--instance" },
    ]);
    const wrapper = mountDashboard();
    await flushPromises();

    expect(mockGetProviderConfigs).toHaveBeenCalledWith(
      ProviderType.PLUGIN,
      "music_quiz",
    );
    const settings = wrapper.get('[data-testid="music-quiz-settings"]');
    expect(settings.attributes("aria-label")).toBe(
      "providers.music_quiz.settings",
    );
    expect(settings.attributes("title")).toBe("providers.music_quiz.settings");

    await settings.trigger("click");
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "editprovider",
      params: { instanceId: "music_quiz--instance" },
    });
  });

  it("keeps Quiz available when provider settings resolution fails", async () => {
    if (mockAdminState.current) mockAdminState.current.value = true;
    mockGetProviderConfigs.mockRejectedValue(new Error("Unavailable"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const wrapper = mountDashboard();
    await flushPromises();

    expect(wrapper.find('[data-testid="music-quiz-settings"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="new-game-empty"]').exists()).toBe(true);
    expect(mockToastError).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("resolves the settings shortcut when admin access arrives after mount", async () => {
    mockGetProviderConfigs.mockResolvedValue([
      { instance_id: "music_quiz--instance" },
    ]);
    const wrapper = mountDashboard();
    await flushPromises();

    expect(mockGetProviderConfigs).not.toHaveBeenCalled();

    if (mockAdminState.current) mockAdminState.current.value = true;
    await flushPromises();

    expect(mockGetProviderConfigs).toHaveBeenCalledWith(
      ProviderType.PLUGIN,
      "music_quiz",
    );
    expect(wrapper.find('[data-testid="music-quiz-settings"]').exists()).toBe(
      true,
    );
  });

  it("opens the participant view in the current tab", async () => {
    mockResolveMusicQuizDefinition.mockReturnValue(createDefinition());
    mockSendCommand.mockImplementation((command: string) => {
      if (command === "music_quiz/get") {
        return Promise.resolve({
          quiz_type: "guess_the_song",
          answer_type: "multiple_choice",
          phase: "lobby",
          name: "Quiz",
          round_count: 3,
          players: [],
          current_round: null,
          mode: "venue",
        });
      }
      if (command === "music_quiz/available_quiz_types") {
        return Promise.resolve(["guess_the_song"]);
      }
      if (command === "music_quiz/playback_options") {
        return Promise.resolve({
          default_playback_mode: "venue",
          default_venue_player_id: "living-room",
          venue_available: true,
          remote_available: true,
          venue_players: [],
        });
      }
      return Promise.resolve(null);
    });
    const wrapper = mountDashboard();
    await flushPromises();

    await wrapper.get('[data-testid="music-quiz-play-along"]').trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({ name: "guest-quiz" });
  });
});

function mountDashboard() {
  return mount(MusicQuizDashboardView, {
    global: {
      stubs: {
        AlertDialog: true,
        Dialog: {
          props: ["open"],
          emits: ["update:open"],
          template:
            '<div v-if="open"><slot /><button data-testid="cancel-setup" @click="$emit(\'update:open\', false)">Cancel</button></div>',
        },
        DialogContent: {
          template: '<div data-testid="setup-dialog"><slot /></div>',
        },
        DialogDescription: true,
        DialogHeader: {
          template: "<header><slot /></header>",
        },
        DialogTitle: {
          template: "<h2><slot /></h2>",
        },
        Card: {
          template: "<div><slot /></div>",
        },
        CardContent: {
          template: "<div><slot /></div>",
        },
        MusicQuizConnectionBanners: true,
        MusicQuizHostPanel: {
          template: '<div><slot name="game" /></div>',
        },
        MusicQuizSessionHeader: {
          template: '<header><slot name="actions" /></header>',
        },
        MusicQuizSessionPanels: true,
        MusicQuizSetupWizard: {
          props: ["playbackSelection"],
          emits: ["update:playbackSelection"],
          template:
            '<div data-testid="music-quiz-setup"><span data-testid="playback-mode">{{ playbackSelection.mode }}</span><button data-testid="select-remote-playback" @click="$emit(\'update:playbackSelection\', { mode: \'remote\', venuePlayerId: \'living-room\' })">Remote</button></div>',
        },
      },
    },
  });
}

function createDefinition() {
  return {
    game: {
      adapters: {
        host: { template: "<div />" },
        hostPanel: { template: "<div />" },
        present: { template: "<div />" },
      },
      icon: { template: "<span />" },
      labelKey: "providers.music_quiz.title",
      supportsListenIn: false,
      usesRevealCountdown: false,
    },
    answer: {
      adapters: {
        host: { template: "<div />" },
        present: { template: "<div />" },
      },
    },
  };
}
