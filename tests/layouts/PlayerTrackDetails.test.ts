import PlayerIcon from "@/components/PlayerIcon.vue";
import PlayerTrackDetails from "@/layouts/default/PlayerOSD/PlayerTrackDetails.vue";
import { store } from "@/plugins/store";
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
    store.activePlayer!.current_media!.image_url = null;
  });

  it.each([
    { compact: false, size: 60, iconSize: 32, containerSize: 64 },
    { compact: true, size: 40, iconSize: 22, containerSize: 40 },
  ])(
    "falls back to a $size px icon and keeps both text lines when compact=$compact",
    ({ compact, size, iconSize, containerSize }) => {
      const details = mountDetails(compact);

      // compact only shrinks the row, so the subtitle line stays either way
      expect(details.findComponent({ name: "VListItem" }).props("lines")).toBe(
        "two",
      );
      expect(details.text()).toContain("Artist");
      // the shallower row height rides on this class
      expect(
        details
          .get(".player-track-details")
          .classes("player-track-details--compact"),
      ).toBe(compact);
      const iconThumb = details.get(".icon-thumb");
      expect(iconThumb.attributes("style")).toContain(`height: ${size}px`);
      expect(iconThumb.attributes("style")).toContain(`width: ${size}px`);
      expect(details.findComponent(PlayerIcon).props("size")).toBe(iconSize);
      // the wider non-phone container still grows to 64px outside compact
      // mode, independent of the fallback icon's own content size
      expect(details.get(".player-media-thumb").attributes("style")).toContain(
        `height: ${containerSize}px`,
      );
    },
  );

  it.each([
    { compact: false, containerSize: 64 },
    { compact: true, containerSize: 40 },
  ])(
    "renders cover art sized to its $containerSize px wrapper when compact=$compact",
    ({ compact, containerSize }) => {
      store.activePlayer!.current_media!.image_url =
        "https://example.com/art.jpg";
      const details = mountDetails(compact);

      expect(details.find(".icon-thumb").exists()).toBe(false);
      expect(details.findComponent({ name: "VImg" }).exists()).toBe(true);
      // cover art fills its w-full h-full wrapper, so the outer container
      // is what actually controls the rendered artwork size
      expect(details.get(".player-media-thumb").attributes("style")).toContain(
        `height: ${containerSize}px`,
      );
    },
  );
});
