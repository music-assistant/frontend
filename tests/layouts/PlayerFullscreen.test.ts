import { EMPTY_COLOR_PALETTE } from "@/helpers/utils";
import PlayerFullscreen from "@/layouts/default/PlayerOSD/PlayerFullscreen.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { MediaType, PlaybackState } from "@/plugins/api/interfaces";
import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

// Only the fields the lyrics clock and its gate read are mocked; the elapsed
// time resolver reaches the queue through the player's active_source, so both
// the api and the store are seeded.
vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    queues: {},
    queueElapsedTime: {},
    // the menu's ai dj entry derives availability from the provider list
    providers: {},
    subscribe: vi.fn(() => vi.fn()),
    getTrackLyrics: vi.fn<MusicAssistantApi["getTrackLyrics"]>(),
    playerCommandSeek: vi.fn<MusicAssistantApi["playerCommandSeek"]>(),
    playMedia: vi.fn<MusicAssistantApi["playMedia"]>(),
  });
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      activePlayerQueue: undefined,
      curQueueItem: undefined,
      showFullscreenPlayer: false,
      showPlayersMenu: false,
      showQueueItems: false,
    }),
  };
});

vi.mock("@/composables/useServerTime", () => ({
  // Date.now() is intentional here: the highlight test advances fake wall time.
  serverNow: () => Date.now() / 1000,
}));

// The queue list and the waveform are unrelated to the lyrics clock and pull in
// their own scrolling/loading machinery.
vi.mock("@/layouts/default/PlayerOSD/useFullscreenQueue", async () => {
  const { computed, ref: vueRef } =
    await vi.importActual<typeof import("vue")>("vue");
  const { store } = await import("@/plugins/store");
  const api = (await import("@/plugins/api")).default;
  return {
    useFullscreenQueue: () => ({
      queueScrollRef: vueRef(null),
      virtualRows: computed(() => {
        const item = store.curQueueItem;
        if (!item) return [];
        return [
          {
            index: 0,
            vItem: { start: 0 },
            state: "playing",
            item,
            divider: null,
          },
        ];
      }),
      totalItems: computed(() => (store.curQueueItem ? 1 : 0)),
      upNextCount: computed(() => 0),
      queueEnded: computed(() => false),
      totalSize: computed(() => 0),
      measureRow: vi.fn(),
      playerActive: computed(() => false),
      hoveredMarqueeSync: vueRef(undefined),
      requestBadgeColor: computed(() => ""),
      boostBadgeColor: computed(() => ""),
      queueTitleFontSize: computed(() => "1em"),
      queueSubtitleFontSize: computed(() => "1em"),
      openQueueItemMenu: vi.fn(),
      chapterClicked: vi.fn((_item: unknown, chapter: { start: number }) => {
        const player = (store as unknown as TestStore).activePlayer;
        if (player) {
          api.playerCommandSeek(player.player_id, chapter.start);
        }
      }),
      startItemDrag: vi.fn(),
      draggingIndex: vueRef(undefined),
      isDragging: vueRef(false),
      draggedItem: vueRef(undefined),
      ghostY: vueRef(0),
      rowOffset: () => 0,
    }),
  };
});

vi.mock("@/composables/useActiveTrackWaveform", async () => {
  const { ref: vueRef } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useActiveTrackWaveform: () => ({ waveformBins: vueRef(undefined) }),
  };
});

vi.mock("@/plugins/vuetify", async () => {
  const { ref: vueRef } = await vi.importActual<typeof import("vue")>("vue");
  return {
    default: {
      display: { height: vueRef(900), mdAndUp: vueRef(true) },
      theme: { current: vueRef({ dark: true }) },
    },
  };
});

vi.mock("vuetify", async () => {
  const { ref: vueRef } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useDisplay: () => ({ name: vueRef("lg"), mdAndUp: vueRef(true) }),
  };
});

vi.mock("@/plugins/router", () => ({ default: { push: vi.fn() } }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the overflow menu is handed to the app-wide context menu over the event bus,
// which is where a test can read the entries it was built with
vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

const NOW = 1_700_000_000;
const QUEUE_ID = "q1";

interface Chapter {
  position: number;
  name: string;
  start: number;
  end: number | null;
}

interface TestStore {
  activePlayer?: {
    player_id: string;
    active_source?: string;
    name?: string;
    group_members?: string[];
    source_list?: unknown[];
    sound_mode_list?: unknown[];
    playback_state?: PlaybackState;
    current_media?: {
      media_type?: MediaType;
      duration?: number | null;
      elapsed_time?: number | null;
      elapsed_time_last_updated?: number | null;
      queue_item_id?: string | null;
    };
  };
  activePlayerQueue?: {
    queue_id: string;
    state: PlaybackState;
    active: boolean;
  };
  curQueueItem?: {
    queue_item_id?: string;
    name?: string;
    media_item?: {
      media_type: MediaType;
      metadata?: { chapters?: Chapter[] };
    };
  };
  showFullscreenPlayer: boolean;
  showPlayersMenu: boolean;
  showQueueItems: boolean;
}

interface TestApi {
  queues: Record<
    string,
    { queue_id: string; state: PlaybackState; active: boolean }
  >;
  queueElapsedTime: Record<
    string,
    { elapsed_time?: number; elapsed_time_last_updated?: number }
  >;
}

// Records scheduled callbacks instead of running them, so a test can see how
// many frames the component's lyrics clock has pending.
let pendingFrames: Map<number, FrameRequestCallback>;
let nextRafId: number;
let wrapper: VueWrapper | undefined;

/** Put a playing queue on the active player, the way the store reports one. */
async function seedPlayingQueue(): Promise<void> {
  const { store } = await import("@/plugins/store");
  const api = (await import("@/plugins/api")).default;
  const testStore = store as unknown as TestStore;
  const testApi = api as unknown as TestApi;

  testApi.queues[QUEUE_ID] = {
    queue_id: QUEUE_ID,
    state: PlaybackState.PLAYING,
    active: true,
  };
  testApi.queueElapsedTime[QUEUE_ID] = {
    elapsed_time: 10,
    elapsed_time_last_updated: NOW,
  };
  testStore.activePlayer = {
    player_id: "p1",
    active_source: QUEUE_ID,
    group_members: [],
    playback_state: PlaybackState.PLAYING,
    current_media: {
      media_type: MediaType.AUDIOBOOK,
      queue_item_id: "item-1",
    },
  };
  testStore.curQueueItem = {
    queue_item_id: "item-1",
    media_item: {
      media_type: MediaType.AUDIOBOOK,
      metadata: {
        chapters: [
          { position: 1, name: "First", start: 0, end: 60 },
          { position: 2, name: "Second", start: 60, end: 120 },
        ],
      },
    },
  };
  testStore.activePlayerQueue = {
    queue_id: QUEUE_ID,
    state: PlaybackState.PLAYING,
    active: true,
  };
}

beforeEach(() => {
  pendingFrames = new Map();
  nextRafId = 0;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const id = ++nextRafId;
      pendingFrames.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => {
      pendingFrames.delete(id);
    }),
  );
});

afterEach(async () => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.unstubAllGlobals();

  const { store } = await import("@/plugins/store");
  const api = (await import("@/plugins/api")).default;
  const testStore = store as unknown as TestStore;
  const testApi = api as unknown as TestApi;
  testStore.activePlayer = undefined;
  testStore.activePlayerQueue = undefined;
  testStore.showFullscreenPlayer = false;
  testStore.showPlayersMenu = false;
  testStore.showQueueItems = false;
  testStore.curQueueItem = undefined;
  testApi.queues = {};
  testApi.queueElapsedTime = {};
});

describe("PlayerFullscreen chapter queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function mountChapterQueue(): Promise<VueWrapper> {
    await seedPlayingQueue();
    const { store } = await import("@/plugins/store");
    const testStore = store as unknown as TestStore;
    testStore.showFullscreenPlayer = true;
    testStore.showQueueItems = true;
    wrapper = shallowMount(PlayerFullscreen, {
      props: { colorPalette: EMPTY_COLOR_PALETTE },
      global: {
        mocks: { $vuetify: { display: { height: 900, mdAndUp: true } } },
        stubs: {
          "v-dialog": { template: "<div><slot /></div>" },
          "v-card": { template: "<div><slot /></div>" },
        },
      },
    });
    await nextTick();
    return wrapper;
  }

  it("highlights the active chapter and moves at the next boundary", async () => {
    const fullscreen = await mountChapterQueue();
    const chapters = fullscreen.findAll(".queue-chapter");
    expect(chapters).toHaveLength(2);
    expect(chapters[0].classes()).toContain("queue-chapter--active");
    expect(chapters[0].attributes("aria-current")).toBe("true");
    expect(chapters[1].attributes("aria-current")).toBeUndefined();

    await vi.advanceTimersByTimeAsync(51_000);
    await nextTick();
    expect(fullscreen.findAll(".queue-chapter")[1].classes()).toContain(
      "queue-chapter--active",
    );
    expect(
      fullscreen.findAll(".queue-chapter")[0].attributes("aria-current"),
    ).toBeUndefined();
  });

  it("seeks to a chapter start without reloading the media", async () => {
    const fullscreen = await mountChapterQueue();
    const api = (await import("@/plugins/api")).default as unknown as {
      playerCommandSeek: ReturnType<typeof vi.fn>;
      playMedia: ReturnType<typeof vi.fn>;
    };
    api.playerCommandSeek.mockClear();
    api.playMedia.mockClear();

    await fullscreen.findAll(".queue-chapter")[1].trigger("click");

    expect(api.playerCommandSeek).toHaveBeenCalledWith("p1", 60);
    expect(api.playMedia).not.toHaveBeenCalled();
  });
});

describe("PlayerFullscreen lyrics clock", () => {
  it("only runs while the lyrics panel is on screen", async () => {
    await seedPlayingQueue();
    const { store } = await import("@/plugins/store");
    const testStore = store as unknown as TestStore;

    wrapper = shallowMount(PlayerFullscreen, {
      props: { colorPalette: EMPTY_COLOR_PALETTE },
    });
    await nextTick();

    // The component stays mounted while the dialog is closed.
    expect(pendingFrames.size).toBe(0);

    testStore.showFullscreenPlayer = true;
    await nextTick();
    // Open, but showing the queue rather than the lyrics.
    expect(pendingFrames.size).toBe(0);

    // The lyrics toggle lives on a header button inside the dialog, which a
    // shallow mount does not render, so the panel is opened through the binding
    // that button drives.
    const vm = wrapper.vm as unknown as { showLyrics: boolean };
    vm.showLyrics = true;
    await nextTick();
    expect(pendingFrames.size).toBe(1);

    testStore.showFullscreenPlayer = false;
    await nextTick();
    expect(pendingFrames.size).toBe(0);
  });
});

describe("PlayerFullscreen player select button", () => {
  async function mountFullscreenDialog(
    extraStubs: Record<string, unknown> = {},
  ): Promise<VueWrapper> {
    const { store } = await import("@/plugins/store");
    (store as unknown as TestStore).showFullscreenPlayer = true;

    wrapper = shallowMount(PlayerFullscreen, {
      props: { colorPalette: EMPTY_COLOR_PALETTE },
      global: {
        mocks: { $vuetify: { display: { height: 900, mdAndUp: true } } },
        // the button lives inside the dialog, which a shallow mount leaves empty
        stubs: {
          "v-dialog": { template: "<div><slot /></div>" },
          "v-card": { template: "<div><slot /></div>" },
          ...extraStubs,
        },
      },
    });
    await nextTick();
    return wrapper;
  }

  it("opens the player list on top of the fullscreen player", async () => {
    const { store } = await import("@/plugins/store");
    const testStore = store as unknown as TestStore;
    const fullscreen = await mountFullscreenDialog();

    await fullscreen.find("#fullscreen-player-select-button").trigger("click");

    expect(testStore.showPlayersMenu).toBe(true);
    expect(testStore.showFullscreenPlayer).toBe(true);
  });

  it("announces the player list panel it opens", async () => {
    const { store } = await import("@/plugins/store");
    const testStore = store as unknown as TestStore;
    const fullscreen = await mountFullscreenDialog();
    const selectButton = fullscreen.get("#fullscreen-player-select-button");

    expect(selectButton.attributes("aria-haspopup")).toBe("dialog");
    expect(selectButton.attributes("aria-expanded")).toBe("false");
    // no player selected, so the label carries no trailing player name
    expect(selectButton.attributes("aria-label")).toBe("tooltip.select_player");

    testStore.showPlayersMenu = true;
    await nextTick();

    expect(selectButton.attributes("aria-expanded")).toBe("true");
  });

  it("names the selected player it opens the list from", async () => {
    const { store } = await import("@/plugins/store");
    const testStore = store as unknown as TestStore;
    testStore.activePlayer = {
      player_id: "p1",
      name: "Kitchen",
      group_members: [],
    };
    const fullscreen = await mountFullscreenDialog();

    expect(
      fullscreen
        .get("#fullscreen-player-select-button")
        .attributes("aria-label"),
    ).toBe("tooltip.select_player: Kitchen");
  });

  // Rendered through the real Button so the variant classes actually go through
  // class-variance-authority and tailwind-merge; a stub would only echo back the
  // class prop and never show which of the two hover colours survives.
  it("keeps the label colour on hover", async () => {
    const fullscreen = await mountFullscreenDialog({ Button: false });
    const classes = fullscreen
      .get("#fullscreen-player-select-button")
      .classes();

    // the bare border width comes from the outline variant alone, so it pins
    // both halves of the merge this test reads: cva ran, and it contributed
    expect(classes).toContain("border");
    expect(classes).toContain("hover:text-[var(--text-color)]");
    // the outline variant also offers this one, and it resolves to the theme
    // foreground rather than the white forced over a dominant visualizer
    expect(classes).not.toContain("hover:text-accent-foreground");
  });
});

describe("PlayerFullscreen overflow menu", () => {
  async function openOverflowMenu(mediaType: MediaType) {
    const { store } = await import("@/plugins/store");
    const { eventbus } = await import("@/plugins/eventbus");
    const testStore = store as unknown as TestStore;
    testStore.activePlayer = {
      player_id: "p1",
      group_members: [],
      source_list: [],
      sound_mode_list: [],
    };
    // a track sends the view looking for lyrics on the way past
    testStore.curQueueItem = {
      media_item: { media_type: mediaType, metadata: {} },
    };
    testStore.showFullscreenPlayer = true;

    wrapper = shallowMount(PlayerFullscreen, {
      props: { colorPalette: EMPTY_COLOR_PALETTE },
      global: {
        mocks: { $vuetify: { display: { height: 900, mdAndUp: true } } },
        stubs: {
          "v-dialog": { template: "<div><slot /></div>" },
          "v-card": { template: "<div><slot /></div>" },
          // the overflow button rides in the toolbar's append slot
          "v-toolbar": { template: "<div><slot name='append' /></div>" },
        },
      },
    });
    await nextTick();

    const emit = vi.mocked(eventbus.emit);
    emit.mockClear();
    await wrapper.get('[aria-label="tooltip.more_options"]').trigger("click");

    // the bus is typed per event, so the payload only takes a shape here
    const calls = emit.mock.calls as unknown as [
      string,
      { items: { label: string }[] },
    ][];
    const call = calls.find(([event]) => event === "contextmenu");
    if (!call) throw new Error("the overflow button opened no menu");
    return call[1].items.map((item) => item.label);
  }

  // the playback speed is a per-item setting, so it only belongs to the
  // spoken-word content that carries one
  it.each([
    { mediaType: MediaType.AUDIOBOOK, offered: true },
    { mediaType: MediaType.PODCAST_EPISODE, offered: true },
    { mediaType: MediaType.TRACK, offered: false },
  ])("offers the playback speed for $mediaType: $offered", async (testCase) => {
    const labels = await openOverflowMenu(testCase.mediaType);

    expect(labels.includes("change_playback_speed")).toBe(testCase.offered);
  });
});
