import api from "@/plugins/api";
import { EventType, PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import PartyDashboardView from "@/views/PartyDashboardView.vue";
import { type VueWrapper, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Reactive, so the view's own chrome follows the flag the way it does in the app.
vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      frameless: false,
      activePlayerId: undefined,
      activePlayer: undefined,
      activePlayerQueue: undefined,
      curQueueItem: undefined,
    }),
  };
});

// Tracks live subscriptions the way the api does, so one that outlives the
// view stays listed here and keeps receiving events.
const events = vi.hoisted(() => {
  type Listener = { type: unknown; handler: (evt: unknown) => unknown };
  const listeners: Listener[] = [];
  return {
    listeners,
    subscribe: (type: unknown, handler: (evt: unknown) => unknown) => {
      const listener = { type, handler };
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
    emit: (type: unknown, evt: unknown) => {
      for (const listener of listeners) {
        if (listener.type === type) listener.handler(evt);
      }
    },
  };
});

vi.mock("@/plugins/api", () => ({
  default: {
    baseUrl: "",
    players: {},
    providers: {},
    queues: {},
    sendCommand: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn(events.subscribe),
    getPlayerQueueItems: vi.fn().mockResolvedValue([]),
    getTrackLyrics: vi.fn().mockResolvedValue([null, null]),
  },
}));

// Pulled in transitively via @/helpers/utils; mocked so their module-load side effects (AuthManager reading localStorage) don't leak into this test.
vi.mock("@/plugins/router", () => ({ default: {} }));
vi.mock("@/plugins/auth", () => ({ authManager: {}, default: {} }));

vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Only the theme read is stood in for; the dialog primitives further down the
// tree use the rest of the module for real.
vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useColorMode: () => ({ value: "light" }),
}));

vi.mock("@/composables/usePartyConfig", () => ({
  usePartyConfig: () => ({
    config: { value: null },
    fetchConfig: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("@/composables/visualizer/useVisualizer", () => ({
  useVisualizer: () => ({
    visualizerEnabledPref: { value: false },
    visualizerPresetPref: { value: "" },
    visualizerBlurPref: { value: 0 },
    visualizerOpacityPref: { value: 1 },
    visualizerAvailable: { value: false },
    visualizerActive: { value: false },
    toggleVisualizer: vi.fn(),
  }),
}));

vi.mock("@/composables/lyrics/useLyricsElapsedTime", () => ({
  useLyricsElapsedTime: () => ({ elapsedTime: { value: 0 } }),
}));

// The view drives the real Fullscreen API, which happy-dom does not implement,
// so it is stood up here as a small state machine that fires the same event the
// browser does.
let fullscreenElement: Element | null = null;
const requestFullscreen = vi.fn(() => {
  fullscreenElement = document.documentElement;
  document.dispatchEvent(new Event("fullscreenchange"));
  return Promise.resolve();
});
const exitFullscreen = vi.fn(() => {
  fullscreenElement = null;
  document.dispatchEvent(new Event("fullscreenchange"));
  return Promise.resolve();
});

const ButtonStub = { template: "<button><slot /></button>" };

let wrapper: VueWrapper | undefined;

function mountViewRaw() {
  wrapper = mount(PartyDashboardView, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Badge: { template: "<span><slot /></span>" },
        Button: ButtonStub,
        LyricsViewer: true,
        PartyQR: true,
        PartyTrackCard: true,
        ShowDashboardButton: true,
        VisualizerCanvas: true,
      },
    },
  });
  return wrapper;
}

async function mountView() {
  const view = mountViewRaw();
  await flushPromises();
  return view;
}

const ENTER_FULLSCREEN = '[aria-label="tooltip.enter_fullscreen"]';
const EXIT_FULLSCREEN = '[aria-label="tooltip.exit_fullscreen"]';

const enterFullscreen = (view: VueWrapper) =>
  view.get(ENTER_FULLSCREEN).trigger("click");

/**
 * Stands in for the Wake Lock API, which happy-dom does not implement.
 *
 * `settle()` resolves a pending request, so a test can leave the view while
 * one is still in flight. Sentinels fire `release` on release, the way the
 * browser does.
 */
function fakeWakeLock() {
  let pending: ((sentinel: unknown) => void) | undefined;
  const request = vi.fn(
    () =>
      new Promise((resolve) => {
        pending = resolve;
      }),
  );
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  return {
    request,
    settle: () => {
      const listeners: (() => void)[] = [];
      const sentinel = {
        released: false,
        release: vi.fn(() => {
          sentinel.released = true;
          listeners.forEach((listener) => listener());
          return Promise.resolve();
        }),
        addEventListener: (_type: string, listener: () => void) =>
          listeners.push(listener),
      };
      pending?.(sentinel);
      pending = undefined;
      return sentinel;
    },
    restore: () => {
      delete (navigator as { wakeLock?: unknown }).wakeLock;
    },
  };
}

/**
 * Records document listeners while a view runs.
 *
 * `stop()` restores the originals and returns the event types still attached,
 * which is what tells a removed listener apart from one added back afterwards.
 */
function trackDocumentListeners() {
  const attached = new Map<unknown, string>();
  const { addEventListener, removeEventListener } = document;
  document.addEventListener = ((type: string, handler: never) => {
    attached.set(handler, type);
    return addEventListener.call(document, type, handler);
  }) as never;
  document.removeEventListener = ((type: string, handler: never) => {
    attached.delete(handler);
    return removeEventListener.call(document, type, handler);
  }) as never;
  return {
    stop: () => {
      Object.assign(document, { addEventListener, removeEventListener });
      return [...attached.values()];
    },
  };
}

describe("PartyDashboardView fullscreen", () => {
  beforeEach(() => {
    store.frameless = false;
    fullscreenElement = null;
    requestFullscreen.mockClear();
    exitFullscreen.mockClear();
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    document.documentElement.requestFullscreen = requestFullscreen;
    document.exitFullscreen = exitFullscreen;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("drops the app chrome when the dashboard goes fullscreen", async () => {
    const view = await mountView();

    await enterFullscreen(view);

    expect(store.frameless).toBe(true);
    expect(requestFullscreen).toHaveBeenCalled();
    expect(view.find(EXIT_FULLSCREEN).exists()).toBe(true);
  });

  it("hands the chrome back when the dashboard is left while fullscreen", async () => {
    // browser back skips the minimize button, so the view has to undo its own
    // fullscreen on the way out or the next route has no navigation at all
    const view = await mountView();
    await enterFullscreen(view);

    view.unmount();
    wrapper = undefined;

    expect(store.frameless).toBe(false);
    expect(exitFullscreen).toHaveBeenCalled();
  });

  it("leaves a frameless session it did not start alone", async () => {
    // a dashboard viewer login and a ?frameless deep link are both meant to
    // stay frameless for the whole session
    store.frameless = true;
    const view = await mountView();

    // what makes the flag enough to tell the two apart: the control that would
    // claim ownership is not on screen while the session is already frameless
    expect(view.find(ENTER_FULLSCREEN).exists()).toBe(false);

    view.unmount();
    wrapper = undefined;

    expect(store.frameless).toBe(true);
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("leaves fullscreen once for the minimize button", async () => {
    const view = await mountView();
    await enterFullscreen(view);

    await view.get(EXIT_FULLSCREEN).trigger("click");
    expect(store.frameless).toBe(false);

    view.unmount();
    wrapper = undefined;

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("stays out of the way once the browser has left fullscreen", async () => {
    const view = await mountView();
    await enterFullscreen(view);

    // Escape, which the browser reports as a fullscreen change
    fullscreenElement = null;
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(store.frameless).toBe(false);

    view.unmount();
    wrapper = undefined;

    expect(store.frameless).toBe(false);
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("keeps a frameless session started after the browser left fullscreen", async () => {
    const view = await mountView();
    await enterFullscreen(view);

    fullscreenElement = null;
    document.dispatchEvent(new Event("fullscreenchange"));
    // the router guard re-frames a dashboard viewer on its next navigation
    store.frameless = true;

    view.unmount();
    wrapper = undefined;

    expect(store.frameless).toBe(true);
  });
});

describe("PartyDashboardView event subscriptions", () => {
  beforeEach(() => {
    events.listeners.length = 0;
    // the last fullscreen test deliberately leaves this set
    store.frameless = false;
    store.activePlayerQueue = { queue_id: "q1" } as never;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    store.activePlayerQueue = undefined;
  });

  it("stops listening once the dashboard is closed", async () => {
    const view = await mountView();
    // the subscriptions are set up after several awaits, so pin that they ran
    // at all before reading anything into them being gone
    expect(events.listeners.length).toBeGreaterThan(0);

    view.unmount();
    wrapper = undefined;

    expect(events.listeners).toHaveLength(0);
  });

  it("leaves the queue alone for events that arrive after it closed", async () => {
    api.queues.other = {
      queue_id: "other",
      state: PlaybackState.PLAYING,
    } as never;
    const view = await mountView();

    view.unmount();
    wrapper = undefined;
    vi.mocked(api.getPlayerQueueItems).mockClear();
    vi.mocked(api.sendCommand).mockClear();
    // one event per subscription, including the queue that is not the active
    // one, which is what the fourth subscription watches for
    events.emit(EventType.QUEUE_ITEMS_UPDATED, { object_id: "q1" });
    events.emit(EventType.QUEUE_UPDATED, { object_id: "q1" });
    events.emit(EventType.QUEUE_UPDATED, { object_id: "other" });
    events.emit(EventType.PROVIDERS_UPDATED, {});
    await flushPromises();

    expect(api.getPlayerQueueItems).not.toHaveBeenCalled();
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("never starts listening when closed while still loading", async () => {
    // leaving before the config round-trips resolve runs the unmount hook
    // first, so anything subscribing afterwards would never be cleaned up
    const view = mountViewRaw();

    view.unmount();
    wrapper = undefined;
    await flushPromises();

    expect(events.listeners).toHaveLength(0);
  });

  it("drops its visibility listener when closed while still loading", async () => {
    const live = trackDocumentListeners();
    const view = mountViewRaw();

    view.unmount();
    wrapper = undefined;
    await flushPromises();
    const remaining = live.stop();

    expect(remaining).not.toContain("visibilitychange");
  });
});

describe("PartyDashboardView screen wake lock", () => {
  let wakeLock: ReturnType<typeof fakeWakeLock>;

  beforeEach(() => {
    store.frameless = false;
    wakeLock = fakeWakeLock();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    wakeLock.restore();
  });

  it("lets the screen sleep again once the dashboard is closed", async () => {
    const view = mountViewRaw();
    const sentinel = wakeLock.settle();
    await flushPromises();
    expect(wakeLock.request).toHaveBeenCalledTimes(1);

    view.unmount();
    wrapper = undefined;
    await flushPromises();

    expect(sentinel.released).toBe(true);
    // releasing fires the sentinel's own release event, whose handler would
    // otherwise take the still-visible page as a cue to acquire a new one
    expect(wakeLock.request).toHaveBeenCalledTimes(1);
  });

  it("releases a wake lock that only arrives after it closed", async () => {
    const view = mountViewRaw();

    view.unmount();
    wrapper = undefined;
    const sentinel = wakeLock.settle();
    await flushPromises();

    expect(sentinel.released).toBe(true);
  });

  it("re-acquires when the screen is released while still open", async () => {
    // the handler exists because the system can drop the lock on its own, so
    // pin that the guard above did not cost the view that behaviour
    const view = mountViewRaw();
    const sentinel = wakeLock.settle();
    await flushPromises();

    sentinel.release();
    await flushPromises();

    expect(wakeLock.request).toHaveBeenCalledTimes(2);
    view.unmount();
    wrapper = undefined;
  });
});

describe("PartyDashboardView active player", () => {
  beforeEach(() => {
    store.frameless = false;
    store.activePlayerId = "the_users_own_pick";
    vi.mocked(api.sendCommand).mockResolvedValue("party_player_1" as never);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    store.activePlayerId = undefined;
    vi.mocked(api.sendCommand).mockResolvedValue(null as never);
  });

  it("takes over the active player while open", async () => {
    await mountView();

    expect(store.activePlayerId).toBe("party_player_1");
  });

  it("leaves the active player alone when closed mid-request", async () => {
    const view = mountViewRaw();

    view.unmount();
    wrapper = undefined;
    await flushPromises();

    expect(store.activePlayerId).toBe("the_users_own_pick");
  });
});
