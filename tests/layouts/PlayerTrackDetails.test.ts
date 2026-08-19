import PlayerIcon from "@/components/PlayerIcon.vue";
import PlayerTrackDetails from "@/layouts/default/PlayerOSD/PlayerTrackDetails.vue";
import { openCurrentTrackDetails } from "@/helpers/now_playing";
import { store } from "@/plugins/store";
import { EMPTY_COLOR_PALETTE } from "@/helpers/utils";
import { mount, type VueWrapper } from "@vue/test-utils";
import { radio } from "../fixtures/radio";
import { streamDetails } from "../fixtures/streamDetails";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
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
  const api = {
    players: {},
    queues: {},
    queueElapsedTime: {},
    providers: {},
    providerManifests: {},
  };
  return { api, default: api };
});

vi.mock("@/composables/useServerTime", () => ({
  serverNow: () => Date.now() / 1000,
}));

vi.mock("@/helpers/now_playing", () => ({
  openCurrentTrackDetails: vi.fn(),
}));

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
      curQueueItem: undefined,
      currentUser: undefined,
      showFullscreenPlayer: false,
      showPlayersMenu: false,
    }),
  };
});

const vuetify = createVuetify({ components, directives });

const NOW = 1_700_000_000;
let wrapper: VueWrapper | undefined;

// MarqueeText pulls in resize/intersection observers unrelated to this test.
function mountDetails(compact: boolean, titleOpensDetails = false) {
  wrapper = mount(PlayerTrackDetails, {
    props: {
      compact,
      titleOpensDetails,
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

describe("PlayerTrackDetails chapters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
    (
      store.activePlayer as unknown as { current_media: unknown }
    ).current_media = {
      title: "Song title",
      artist: "Artist",
      album: "Album",
    };
    store.activePlayerQueue = undefined;
    store.curQueueItem = undefined;
    store.currentUser = undefined;
    (
      store.activePlayer as unknown as { active_source?: string }
    ).active_source = undefined;
  });

  it("updates the chapter subtitle when the preference is enabled after mount", async () => {
    const details = mountDetails(false);
    const testStore = store as typeof store & {
      currentUser?: { preferences?: Record<string, unknown> };
    };
    const testApi = (await import("@/plugins/api")).default as unknown as {
      queues: Record<string, unknown>;
      queueElapsedTime: Record<string, unknown>;
    };
    testApi.queues.q1 = {
      queue_id: "q1",
      active: true,
      state: "playing",
      current_item: { extra_attributes: {} },
    };
    testApi.queueElapsedTime.q1 = {
      elapsed_time: 59,
      elapsed_time_last_updated: NOW,
    };
    testStore.currentUser = {
      user_id: "test-user",
      username: "test-user",
      role: "user",
      enabled: true,
      preferences: { audiobook_chapter_progress: true },
    } as never;
    testStore.activePlayerQueue = {
      queue_id: "q1",
      active: true,
      state: "playing" as never,
    } as never;
    testStore.activePlayer = {
      ...testStore.activePlayer!,
      active_source: "q1",
      playback_state: "playing" as never,
      current_media: {
        title: "Book",
        artist: "Author",
        album: null,
        media_type: "audiobook" as never,
        duration: 120,
        elapsed_time: 59,
        elapsed_time_last_updated: NOW,
        queue_item_id: "item-1",
      } as never,
    };
    testStore.curQueueItem = {
      queue_item_id: "item-1",
      media_item: {
        media_type: "audiobook" as never,
        metadata: {
          chapters: [
            { position: 1, name: "First", start: 0, end: 60 },
            { position: 2, name: "Second", start: 60, end: 120 },
          ],
        },
      },
    } as never;
    await nextTick();
    expect(details.text()).toContain("First");

    await vi.advanceTimersByTimeAsync(2000);
    await nextTick();
    expect(details.text()).toContain("Second");
    expect(details.get(".player-track-chapter-button").element.tagName).toBe(
      "BUTTON",
    );
  });
});

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

describe("PlayerTrackDetails title", () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    store.showFullscreenPlayer = false;
    vi.mocked(openCurrentTrackDetails).mockClear();
  });

  // the artwork and the bar around it are what open the player, so the title is
  // free to be the way into the track itself
  it("opens the track details where the bar asks for it", async () => {
    const details = mountDetails(false, true);

    await details.get(".v-list-item-title .ma-line-clamp-1").trigger("click");

    expect(openCurrentTrackDetails).toHaveBeenCalled();
    expect(store.showFullscreenPlayer).toBe(false);
  });

  // the floating mobile bar is one big target for the player, and the title is
  // most of it
  it("opens the player everywhere else", async () => {
    const details = mountDetails(true);

    await details.get(".v-list-item-title .ma-line-clamp-1").trigger("click");

    expect(openCurrentTrackDetails).not.toHaveBeenCalled();
    expect(store.showFullscreenPlayer).toBe(true);
  });

  // the artwork keeps opening the player on both bars
  it("opens the player from the artwork even where the title does not", async () => {
    const details = mountDetails(false, true);

    await details.get(".player-media-thumb").trigger("click");

    expect(openCurrentTrackDetails).not.toHaveBeenCalled();
    expect(store.showFullscreenPlayer).toBe(true);
  });
});

describe("PlayerTrackDetails source badge", () => {
  beforeEach(() => {
    (
      store.activePlayer as unknown as { active_source?: string }
    ).active_source = undefined;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    store.activePlayerQueue = undefined;
    store.curQueueItem = undefined;
    (
      store.activePlayer as unknown as { current_media: unknown }
    ).current_media = {
      title: "Song title",
      artist: "Artist",
      album: "Album",
    };
  });

  // the server puts the station name in the album slot when the station has no
  // real album, so the badge would otherwise repeat what is already on the line
  it("names the station and drops it from the metadata line", () => {
    store.activePlayerQueue = { queue_id: "q1", active: true } as never;
    store.curQueueItem = {
      media_item: radio({ name: "Radio 538" }),
      streamdetails: streamDetails({
        stream_metadata: {
          title: "Live track",
          artist: null,
          album: null,
          image_url: null,
          duration: null,
          uri: null,
        },
      }),
    } as never;
    (
      store.activePlayer as unknown as { current_media: unknown }
    ).current_media = {
      title: "Live track",
      artist: "Artist",
      album: "Radio 538",
    };

    const details = mountDetails(false);

    expect(details.get(".player-track-source").text()).toBe("Radio 538");
    expect(details.get(".player-track-subtitle-text").text()).toBe("Artist");
  });

  it("leaves an ordinary album on the metadata line", () => {
    const details = mountDetails(false);

    expect(details.find(".player-track-source").exists()).toBe(false);
    expect(details.get(".player-track-subtitle-text").text()).toContain(
      "Album",
    );
  });
});
