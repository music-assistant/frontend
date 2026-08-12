import PlayerTrackDetails from "@/layouts/default/PlayerOSD/PlayerTrackDetails.vue";
import { EMPTY_COLOR_PALETTE } from "@/helpers/utils";
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

// Non-phone, so the non-compact outer thumb container uses its wider 64px
// size; the artwork/fallback content size is asserted independently of it.
vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: () => false,
}));

// Pulls in the fullscreen dialog's own player/queue/waveform machinery,
// unrelated to the track details compact layout under test here.
vi.mock("@/layouts/default/PlayerOSD/PlayerFullscreen.vue", () => ({
  default: { template: "<div />" },
}));

// QualityDetailsBtn's audio-processing chain imports ProviderIcon, which
// needs the real api singleton; stub it since it is never shown here
// (showQualityDetailsBtn is false in every test below).
vi.mock("@/plugins/api", () => {
  const api = { players: {}, queues: {} };
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: {
        powered: true,
        icon: undefined,
        type: "player",
        group_members: [],
        current_media: {
          title: "Song title",
          artist: "Artist",
          album: "Album",
        },
      },
      activePlayerQueue: undefined,
      showFullscreenPlayer: false,
      showPlayersMenu: false,
    }),
  };
});

const vuetify = createVuetify({ components, directives });

let wrapper: VueWrapper | undefined;

// MarqueeText pulls in resize/intersection observers unrelated to this test.
function mountDetails(compact: boolean) {
  wrapper = mount(PlayerTrackDetails, {
    props: {
      compact,
      showQualityDetailsBtn: false,
      colorPalette: EMPTY_COLOR_PALETTE,
    },
    global: {
      plugins: [vuetify],
      mocks: { $t: (key: string) => key },
      stubs: {
        MarqueeText: { template: "<span><slot /></span>" },
      },
    },
  });
  return wrapper;
}

describe("PlayerTrackDetails compact mode", () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("keeps the existing two-line layout and 60px artwork outside compact mode", () => {
    const details = mountDetails(false);

    expect(details.findComponent({ name: "VListItem" }).props("lines")).toBe(
      "two",
    );
    const iconThumb = details.get(".icon-thumb");
    expect(iconThumb.attributes("style")).toContain("height: 60px");
    expect(iconThumb.attributes("style")).toContain("width: 60px");
    // the wider non-phone container still grows to 64px, independent of the
    // 60px artwork/fallback content size
    expect(details.get(".player-media-thumb").attributes("style")).toContain(
      "height: 64px",
    );
    expect(details.text()).toContain("Artist");
  });

  it("collapses to one line, 44px artwork, and no subtitle in compact mode", () => {
    const details = mountDetails(true);

    expect(details.findComponent({ name: "VListItem" }).props("lines")).toBe(
      "one",
    );
    const iconThumb = details.get(".icon-thumb");
    expect(iconThumb.attributes("style")).toContain("height: 44px");
    expect(iconThumb.attributes("style")).toContain("width: 44px");
    expect(details.get(".player-media-thumb").attributes("style")).toContain(
      "height: 44px",
    );
    expect(details.text()).not.toContain("Artist");
  });
});
