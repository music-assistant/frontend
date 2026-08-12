import { EMPTY_COLOR_PALETTE } from "@/helpers/utils";
import PlayerFullscreen from "@/layouts/default/PlayerOSD/PlayerFullscreen.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { PlaybackState } from "@/plugins/api/interfaces";
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
  serverNow: () => NOW,
}));

// The queue list and the waveform are unrelated to the lyrics clock and pull in
// their own scrolling/loading machinery.
vi.mock("@/layouts/default/PlayerOSD/useFullscreenQueue", async () => {
  const { computed, ref: vueRef } =
    await vi.importActual<typeof import("vue")>("vue");
  return {
    useFullscreenQueue: () => ({
      queueScrollRef: vueRef(null),
      virtualRows: computed(() => []),
      totalItems: computed(() => 0),
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
      chapterClicked: vi.fn(),
      startItemDrag: vi.fn(),
      draggingIndex: vueRef(undefined),
      isDragging: vueRef(false),
      draggedItem: vueRef(undefined),
      ghostY: vueRef(0),
      rowOffset: computed(() => 0),
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

const NOW = 1_700_000_000;
const QUEUE_ID = "q1";

interface TestStore {
  activePlayer?: {
    player_id: string;
    active_source?: string;
    name?: string;
    group_members?: string[];
  };
  activePlayerQueue?: {
    queue_id: string;
    state: PlaybackState;
    active: boolean;
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
  testStore.activePlayer = { player_id: "p1", active_source: QUEUE_ID };
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
  testApi.queues = {};
  testApi.queueElapsedTime = {};
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
  async function mountFullscreenDialog(): Promise<VueWrapper> {
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
});
