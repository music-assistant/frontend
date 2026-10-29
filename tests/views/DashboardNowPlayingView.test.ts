import DashboardNowPlayingView from "@/views/DashboardNowPlayingView.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, routeMock, routerMock, storeMock } = vi.hoisted(() => ({
  authMock: { isDashboardViewer: (): boolean => false },
  routeMock: { query: {} as Record<string, string> },
  routerMock: {
    options: { history: { state: { back: "/discover" as string | null } } },
    back: vi.fn(),
    push: vi.fn(),
  },
  storeMock: {
    frameless: false,
    showFullscreenPlayer: false,
    activePlayerId: undefined as string | undefined,
    activePlayer: undefined as
      | {
          icon?: string | null;
          name: string;
          powered?: boolean;
          current_media?: {
            title?: string;
            artist?: string;
            image_url?: string;
          };
        }
      | undefined,
  },
}));

vi.mock("@/plugins/api", () => ({
  default: { baseUrl: "" },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("vue-router", () => ({
  useRoute: () => routeMock,
}));

// Pulled in transitively via @/helpers/utils; mocked so their module-load side effects (AuthManager reading localStorage) don't leak into this test.
vi.mock("@/plugins/router", () => ({
  default: routerMock,
}));
vi.mock("@/plugins/auth", () => ({
  authManager: authMock,
  default: {},
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/players", () => ({
  getPlayerDisplayName: (player: { name: string }) => player.name,
}));

vi.mock("@vueuse/core", () => ({
  useColorMode: () => ({ value: "light" }),
}));

// PlayerTimeline stub avoids pulling in transport/waveform machinery; MarqueeText needs a slot passthrough so title/artist text stays assertable.
function mountView() {
  return mount(DashboardNowPlayingView, {
    global: {
      stubs: {
        PlayerTimeline: true,
        MarqueeText: { template: "<span><slot /></span>" },
      },
    },
  });
}

describe("DashboardNowPlayingView", () => {
  // a view left mounted would still answer the next test's Escape
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    authMock.isDashboardViewer = () => false;
    routeMock.query = {};
    routerMock.options.history.state.back = "/discover";
    routerMock.back.mockClear();
    routerMock.push.mockClear();
    storeMock.frameless = false;
    storeMock.showFullscreenPlayer = false;
    storeMock.activePlayerId = undefined;
    storeMock.activePlayer = undefined;
  });

  it("pins the active player from the player query param on mount", () => {
    routeMock.query = { player: "player-1" };
    mountView();
    expect(storeMock.activePlayerId).toBe("player-1");
  });

  it("shows a fallback message when no player is active", () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain("no_player");
  });

  it("renders the current track's title and artist with artwork", () => {
    storeMock.activePlayer = {
      name: "Kitchen",
      powered: true,
      current_media: {
        title: "Song Title",
        artist: "Artist Name",
        image_url: "http://example.com/art.jpg",
      },
    };
    const wrapper = mountView();

    expect(wrapper.text()).toContain("Song Title");
    expect(wrapper.text()).toContain("Artist Name");
    expect(wrapper.get("img").attributes("src")).toBe(
      "http://example.com/art.jpg",
    );
  });

  it("shows the player name instead of track info when powered off", () => {
    storeMock.activePlayer = {
      name: "Kitchen",
      powered: false,
      current_media: { title: "Song Title" },
    };
    const wrapper = mountView();

    expect(wrapper.text()).toContain("Kitchen");
    expect(wrapper.text()).not.toContain("Song Title");
  });

  describe("opened from the player on this device", () => {
    it("hides the app's chrome and leaves on a click, back to the player", async () => {
      const wrapper = mountView();
      expect(storeMock.frameless).toBe(true);

      await wrapper.get(".now-playing-view").trigger("click");
      expect(routerMock.back).toHaveBeenCalledTimes(1);

      wrapper.unmount();
      expect(storeMock.frameless).toBe(false);
      expect(storeMock.showFullscreenPlayer).toBe(true);
    });

    it("leaves on Escape", () => {
      mountView();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("stays while the timeline is used", async () => {
      storeMock.activePlayer = { name: "Kitchen" };
      const wrapper = mountView();

      await wrapper.get(".now-playing-timeline").trigger("click");

      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("goes to the start page when there is nothing to go back to", async () => {
      routerMock.options.history.state.back = null;
      const wrapper = mountView();

      await wrapper.get(".now-playing-view").trigger("click");

      expect(routerMock.push).toHaveBeenCalledWith("/");
    });
  });

  it.each([
    ["cast to a display", () => (authMock.isDashboardViewer = () => true)],
    ["opened as a kiosk link", () => (routeMock.query = { frameless: "" })],
  ])("stays as it is when %s", async (_case, setUp) => {
    setUp();
    const wrapper = mountView();

    await wrapper.get(".now-playing-view").trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    wrapper.unmount();

    expect(routerMock.back).not.toHaveBeenCalled();
    expect(storeMock.frameless).toBe(false);
    expect(storeMock.showFullscreenPlayer).toBe(false);
  });
});
