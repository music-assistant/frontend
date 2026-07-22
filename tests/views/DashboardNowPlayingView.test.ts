import DashboardNowPlayingView from "@/views/DashboardNowPlayingView.vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { routeMock, storeMock } = vi.hoisted(() => ({
  routeMock: { query: {} as Record<string, string> },
  storeMock: {
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
  default: {},
}));
vi.mock("@/plugins/auth", () => ({
  authManager: {},
  default: {},
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
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
  beforeEach(() => {
    routeMock.query = {};
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
});
