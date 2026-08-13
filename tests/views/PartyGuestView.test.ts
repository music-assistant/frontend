import api from "@/plugins/api";
import PartyGuestView from "@/views/PartyGuestView.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

// Tracks live subscriptions the way the api does, so one that outlives the
// view stays listed here.
const events = vi.hoisted(() => {
  const listeners: unknown[] = [];
  return {
    listeners,
    subscribe: (_type: unknown, handler: unknown) => {
      listeners.push(handler);
      return () => {
        const index = listeners.indexOf(handler);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };
});

const guest = vi.hoisted(() => ({
  startCountdown: vi.fn(() => vi.fn()),
  subscribeToEvents: vi.fn(() => vi.fn()),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    baseUrl: "",
    players: {},
    providers: {},
    queues: {},
    sendCommand: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn(events.subscribe),
    getPlayerQueueItems: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/plugins/router", () => ({ default: {} }));
vi.mock("@/plugins/auth", () => ({ authManager: {}, default: {} }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/composables/usePartyConfig", () => ({
  usePartyConfig: () => ({
    config: ref(null),
    fetchConfig: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("@/composables/useRateLimiting", () => ({
  useRateLimiting: () => ({
    rateLimitingEnabled: ref(false),
    boostEnabled: ref(false),
    addQueueEnabled: ref(false),
    skipSongEnabled: ref(false),
    requestBadgeColor: ref("#2196F3"),
    boostBadgeColor: ref("#FF5722"),
    boostTokens: ref(0),
    addQueueTokens: ref(0),
    skipSongTokens: ref(0),
    BOOST_MAX_TOKENS: 3,
    ADD_QUEUE_MAX_TOKENS: 3,
    nextTokenCountdown: ref(""),
    addQueueTokenCountdown: ref(""),
    skipTokenCountdown: ref(""),
    consumeBoostToken: vi.fn(),
    consumeAddQueueToken: vi.fn(),
    consumeSkipSongToken: vi.fn(),
    getTimeUntilNextToken: vi.fn(),
    getTimeUntilNextAddQueueToken: vi.fn(),
    getTimeUntilNextSkipToken: vi.fn(),
    configure: vi.fn(),
    startCountdown: guest.startCountdown,
  }),
}));

vi.mock("@/composables/guest/useGuestQueue", () => ({
  useGuestQueue: () => ({
    queueItems: ref([]),
    queueFetchOffset: ref(0),
    loadingMoreQueueItems: ref(false),
    partyQueueId: ref(null),
    currentQueue: ref(null),
    currentQueueIndex: ref(0),
    fetchQueueItems: vi.fn(),
    handleQueueScroll: vi.fn(),
    subscribeToEvents: guest.subscribeToEvents,
  }),
}));

vi.mock("@/composables/guest/useGuestArtistTracks", () => ({
  useGuestArtistTracks: () => ({
    selectedArtist: ref(null),
    artistTracks: ref([]),
    loadingArtistTracks: ref(false),
    selectArtist: vi.fn(),
    clearArtistSelection: vi.fn(),
  }),
}));

/**
 * Records window listeners while a view runs.
 *
 * `stop()` restores the originals and returns the event types still attached,
 * which is what tells a removed listener apart from one added back afterwards.
 */
function trackWindowListeners() {
  const attached = new Map<unknown, string>();
  const { addEventListener, removeEventListener } = window;
  window.addEventListener = ((type: string, handler: never) => {
    attached.set(handler, type);
    return addEventListener.call(window, type, handler);
  }) as never;
  window.removeEventListener = ((type: string, handler: never) => {
    attached.delete(handler);
    return removeEventListener.call(window, type, handler);
  }) as never;
  return {
    stop: () => {
      Object.assign(window, { addEventListener, removeEventListener });
      return [...attached.values()];
    },
  };
}

function mountViewRaw() {
  return mount(PartyGuestView, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        MediaSearch: true,
        PartyListenIn: true,
        PartyQueueSection: true,
        PartyResultItem: true,
        PartyTokensBadge: true,
        Spinner: true,
        Button: { template: "<button><slot /></button>" },
      },
    },
  });
}

describe("PartyGuestView startup cleanup", () => {
  beforeEach(() => {
    events.listeners.length = 0;
    guest.startCountdown.mockClear();
    guest.subscribeToEvents.mockClear();
    vi.mocked(api.subscribe).mockClear();
  });

  afterEach(() => {
    vi.mocked(api.sendCommand).mockResolvedValue(null as never);
  });

  it("undoes everything it set up when the guest page is closed", async () => {
    const live = trackWindowListeners();
    const view = mountViewRaw();
    await flushPromises();
    // pin that the startup really ran, so the teardown assertions below mean
    // something
    expect(events.listeners.length).toBeGreaterThan(0);
    const [stopCountdown] = guest.startCountdown.mock.results.map(
      (result) => result.value,
    );
    const [stopQueueEvents] = guest.subscribeToEvents.mock.results.map(
      (result) => result.value,
    );

    view.unmount();
    const remaining = live.stop();

    expect(events.listeners).toHaveLength(0);
    expect(remaining).not.toContain("popstate");
    expect(stopCountdown).toHaveBeenCalled();
    expect(stopQueueEvents).toHaveBeenCalled();
  });

  it("stops partway through when closed while resolving the party player", async () => {
    // the startup pauses twice, and by this one the countdown and the back
    // handler are already up, so only the second half must be skipped
    let resolvePlayer: (playerId: string | null) => void = () => {};
    vi.mocked(api.sendCommand).mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolvePlayer = resolve;
      }) as never,
    );
    const live = trackWindowListeners();
    const view = mountViewRaw();
    await flushPromises();
    const [stopCountdown] = guest.startCountdown.mock.results.map(
      (result) => result.value,
    );

    view.unmount();
    resolvePlayer(null);
    await flushPromises();
    const remaining = live.stop();

    // what the first half set up is torn down, and the second half never runs
    expect(stopCountdown).toHaveBeenCalled();
    expect(remaining).not.toContain("popstate");
    expect(guest.subscribeToEvents).not.toHaveBeenCalled();
    expect(events.listeners).toHaveLength(0);
  });

  it("sets nothing up when the guest page is closed while still loading", async () => {
    const live = trackWindowListeners();
    const view = mountViewRaw();

    view.unmount();
    await flushPromises();
    const remaining = live.stop();

    expect(events.listeners).toHaveLength(0);
    expect(remaining).not.toContain("popstate");
    expect(guest.startCountdown).not.toHaveBeenCalled();
    expect(guest.subscribeToEvents).not.toHaveBeenCalled();
  });
});
