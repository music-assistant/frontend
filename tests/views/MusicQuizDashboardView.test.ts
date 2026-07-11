import MusicQuizDashboardView from "@/views/MusicQuizDashboardView.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendCommand, mockSubscribe, mockToastError } = vi.hoisted(() => ({
  mockSendCommand: vi.fn(),
  mockSubscribe: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/components/music-quiz/game_types", () => ({
  MUSIC_QUIZ_GAME_TYPES: [],
  resolveMusicQuizDefinition: vi.fn(),
}));

vi.mock("@/plugins/api", () => {
  const api = {
    sendCommand: mockSendCommand,
    subscribe: mockSubscribe,
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
    isAdmin: () => false,
  },
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
    mockSendCommand.mockImplementation((command: string) =>
      command === "music_quiz/available_quiz_types"
        ? Promise.resolve(["guess_the_song", "music_timeline"])
        : Promise.resolve(null),
    );
    mockSubscribe.mockReturnValue(() => {});
  });

  it("renders a compact empty state and opens setup on demand", async () => {
    const wrapper = mount(MusicQuizDashboardView, {
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
    await flushPromises();

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/get");
    expect(mockSendCommand).toHaveBeenCalledWith(
      "music_quiz/available_quiz_types",
    );
    expect(mockToastError).not.toHaveBeenCalled();
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
});
