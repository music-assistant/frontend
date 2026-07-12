import MusicQuizDashboardView from "@/views/MusicQuizDashboardView.vue";
import { ProviderType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetProviderConfigs,
  mockIsAdmin,
  mockRouterPush,
  mockSendCommand,
  mockSubscribe,
  mockToastError,
} = vi.hoisted(() => ({
  mockGetProviderConfigs: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockRouterPush: vi.fn(),
  mockSendCommand: vi.fn(),
  mockSubscribe: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/components/music-quiz/game_types", () => ({
  MUSIC_QUIZ_GAME_TYPES: [],
  resolveMusicQuizDefinition: vi.fn(),
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

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isAdmin: mockIsAdmin,
  },
}));

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
    mockIsAdmin.mockReset();
    mockRouterPush.mockReset();
    mockIsAdmin.mockReturnValue(false);
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
    expect(wrapper.find('[data-testid="music-quiz-setup"]').exists()).toBe(
      false,
    );

    await wrapper.get('[data-testid="new-game-empty"]').trigger("click");

    expect(wrapper.find('[data-testid="setup-dialog"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="music-quiz-setup"]').exists()).toBe(
      true,
    );

    wrapper.unmount();
  });

  it("resolves the admin settings shortcut and routes to its provider config", async () => {
    mockIsAdmin.mockReturnValue(true);
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
    mockIsAdmin.mockReturnValue(true);
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
});

function mountDashboard() {
  return mount(MusicQuizDashboardView, {
    global: {
      stubs: {
        AlertDialog: true,
        Dialog: {
          props: ["open"],
          template: '<div v-if="open"><slot /></div>',
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
        MusicQuizSetupWizard: {
          template: '<div data-testid="music-quiz-setup" />',
        },
      },
    },
  });
}
