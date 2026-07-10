import MusicQuizDashboardView from "@/views/MusicQuizDashboardView.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendCommand, mockSubscribe, mockToastError } = vi.hoisted(() => ({
  mockSendCommand: vi.fn(),
  mockSubscribe: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    sendCommand: mockSendCommand,
    subscribe: mockSubscribe,
    state: { value: "connected" },
  },
  ConnectionState: {
    RECONNECTING: "reconnecting",
    DISCONNECTED: "disconnected",
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isAdmin: () => false,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/plugins/router", () => ({
  default: {},
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
    mockSendCommand.mockResolvedValue(null);
    mockSubscribe.mockReturnValue(() => {});
  });

  it("renders the setup state when the host getter returns null", async () => {
    const wrapper = mount(MusicQuizDashboardView, {
      global: {
        stubs: {
          AlertDialog: true,
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
    expect(mockToastError).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("providers.music_quiz.no_active_game");
    expect(wrapper.find('[data-testid="music-quiz-setup"]').exists()).toBe(
      true,
    );

    wrapper.unmount();
  });
});
