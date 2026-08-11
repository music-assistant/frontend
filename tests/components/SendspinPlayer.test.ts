import SendspinPlayer from "@/components/SendspinPlayer.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { PlaybackState } from "@/plugins/api/interfaces";
import { webPlayer, WebPlayerMode } from "@/plugins/web_player";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { originalUserAgentDescriptor } = vi.hoisted(() => {
  const originalUserAgentDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "userAgent",
  );
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: "iPhone",
  });
  return { originalUserAgentDescriptor };
});

afterAll(() => {
  if (originalUserAgentDescriptor) {
    Object.defineProperty(navigator, "userAgent", originalUserAgentDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "userAgent");
  }
});

// Only the fields the component and the timing helper read are mocked.
interface MockPlayer {
  player_id?: string;
  active_source?: string;
  playback_state?: PlaybackState;
  synced_to?: string;
  group_members: string[];
}

interface MockQueue {
  queue_id: string;
  state?: PlaybackState;
  active?: boolean;
  current_item?: { extra_attributes?: { playback_speed?: number } };
}

const {
  authState,
  apiMock,
  storeMock,
  mockPlayerCommandNext,
  mockPlayerCommandPause,
  mockPlayerCommandPlay,
  mockPlayerCommandPrevious,
  mockPlayerCommandSeek,
  mockPrepareSendspinSession,
  mockRegisterWebPlayerAudioUnlock,
  mockSendspinUnlock,
  mockUseMediaBrowserMetaData,
  routeState,
} = vi.hoisted(() => {
  const mockPlayerCommandNext = vi.fn<MusicAssistantApi["playerCommandNext"]>();
  const mockPlayerCommandPause =
    vi.fn<MusicAssistantApi["playerCommandPause"]>();
  const mockPlayerCommandPlay = vi.fn<MusicAssistantApi["playerCommandPlay"]>();
  const mockPlayerCommandPrevious =
    vi.fn<MusicAssistantApi["playerCommandPrevious"]>();
  const mockPlayerCommandSeek = vi.fn<MusicAssistantApi["playerCommandSeek"]>();
  return {
    authState: {
      guest: null as "music_quiz" | "party" | null,
    },
    // Mutable so tests can drive the players/queues the seek handlers read.
    apiMock: {
      players: {} as Record<string, MockPlayer>,
      queues: {} as Record<string, MockQueue>,
      queueElapsedTime: {} as Record<
        string,
        { elapsed_time?: number; elapsed_time_last_updated?: number }
      >,
      playerCommandNext: mockPlayerCommandNext,
      playerCommandPause: mockPlayerCommandPause,
      playerCommandPlay: mockPlayerCommandPlay,
      playerCommandPrevious: mockPlayerCommandPrevious,
      playerCommandSeek: mockPlayerCommandSeek,
    },
    storeMock: {
      activePlayerId: "active-player",
      activePlayer: undefined as MockPlayer | undefined,
    },
    mockPlayerCommandNext,
    mockPlayerCommandPause,
    mockPlayerCommandPlay,
    mockPlayerCommandPrevious,
    mockPlayerCommandSeek,
    mockPrepareSendspinSession: vi.fn(),
    mockRegisterWebPlayerAudioUnlock: vi.fn<(handler: () => boolean) => void>(),
    mockSendspinUnlock: vi.fn<() => Promise<void>>(),
    mockUseMediaBrowserMetaData: vi.fn(() => vi.fn()),
    routeState: {
      current: null as { meta: Record<string, unknown> } | null,
    },
  };
});

vi.mock("@/helpers/useMediaBrowserMetaData", () => ({
  useMediaBrowserMetaData: mockUseMediaBrowserMetaData,
}));

vi.mock("@/plugins/auth", () => ({
  default: {
    isGuestAccessSession: () => authState.guest !== null,
    isMusicQuizGuest: () => authState.guest === "music_quiz",
    isPartyGuest: () => authState.guest === "party",
  },
}));

vi.mock("vue-router", async () => {
  const { shallowReactive } =
    await vi.importActual<typeof import("vue")>("vue");
  routeState.current = shallowReactive({ meta: {} });
  return {
    useRoute: () => routeState.current,
  };
});

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/web_player", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    WebPlayerMode: {
      DISABLED: "disabled",
      CONTROLS_ONLY: "controls_only",
      SENDSPIN_ONLY: "sendspin_only",
      SENDSPIN_WITH_CONTROLS: "sendspin_with_controls",
    },
    clearWebPlayerAudioUnlock: vi.fn(),
    registerWebPlayerAudioUnlock: mockRegisterWebPlayerAudioUnlock,
    webPlayer: reactive({
      interacted: false,
      tabMode: "sendspin_only",
    }),
  };
});

vi.mock("@/plugins/sendspin-connection", () => ({
  isDirectConnection: () => true,
  prepareSendspinSession: mockPrepareSendspinSession,
}));

vi.mock("@/plugins/api/helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/api/helpers")>()),
  getDeviceName: () => "Browser",
}));

vi.mock("@sendspin/sendspin-js", () => ({
  SendspinPlayer: class {
    connect = vi.fn();
    disconnect = vi.fn();
    setCorrectionMode = vi.fn();
    setMuted = vi.fn();
    setVolume = vi.fn();
    unlock = mockSendspinUnlock;
  },
}));

type ActionHandler = ((details: MediaSessionActionDetails) => void) | null;

const handlers = new Map<MediaSessionAction, ActionHandler>();
const mediaSession = {
  metadata: {} as MediaMetadata | null,
  playbackState: "playing" as MediaSessionPlaybackState,
  setActionHandler: vi.fn(
    (action: MediaSessionAction, handler: ActionHandler) => {
      handlers.set(action, handler);
    },
  ),
  setPositionState: vi.fn(),
};

const actions: MediaSessionAction[] = [
  "play",
  "pause",
  "nexttrack",
  "previoustrack",
  "seekto",
  "seekforward",
  "seekbackward",
];

// epoch seconds the fake clock starts at; timestamps below are relative to this
const ANCHOR = 1_700_000_000;

describe("SendspinPlayer MediaSession", () => {
  beforeEach(() => {
    authState.guest = null;
    handlers.clear();
    mediaSession.metadata = {} as MediaMetadata;
    mediaSession.playbackState = "playing";
    mediaSession.setActionHandler.mockClear();
    mediaSession.setActionHandler.mockImplementation((action, handler) => {
      handlers.set(action, handler);
    });
    mediaSession.setPositionState.mockClear();
    mockPrepareSendspinSession.mockReset();
    mockPrepareSendspinSession.mockReturnValue(new Promise(() => {}));
    mockUseMediaBrowserMetaData.mockClear();
    mockPlayerCommandNext.mockReset();
    mockPlayerCommandPause.mockReset();
    mockPlayerCommandPlay.mockReset();
    mockPlayerCommandPrevious.mockReset();
    mockPlayerCommandSeek.mockReset();
    mockRegisterWebPlayerAudioUnlock.mockClear();
    mockSendspinUnlock.mockReset();
    mockSendspinUnlock.mockResolvedValue(undefined);
    webPlayer.interacted = false;
    webPlayer.tabMode = WebPlayerMode.SENDSPIN_ONLY;
    if (routeState.current) routeState.current.meta = {};
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: mediaSession,
    });
    vi.stubGlobal("localStorage", createStorage());
    apiMock.players = {
      "web-player": {
        player_id: "web-player",
        playback_state: PlaybackState.PLAYING,
        active_source: "queue",
        group_members: [],
      },
    };
    apiMock.queues = { queue: { queue_id: "queue", active: true } };
    apiMock.queueElapsedTime = { queue: { elapsed_time: 30 } };
    storeMock.activePlayer = {
      player_id: "active-player",
      playback_state: PlaybackState.PLAYING,
      group_members: [],
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(["party", "music_quiz"] as const)(
    "keeps %s guests receive-only",
    (guest) => {
      authState.guest = guest;
      seedStaleMediaSession();

      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });

      expect(mediaSession.metadata).toBeNull();
      expect(mediaSession.playbackState).toBe("none");
      expect(mediaSession.setPositionState).toHaveBeenCalledWith();
      expect(mockUseMediaBrowserMetaData).not.toHaveBeenCalled();
      expect(actions.every((action) => handlers.get(action) === null)).toBe(
        true,
      );

      invokeAllActions();
      expectPlayerCommandsNotCalled();
      wrapper.unmount();
    },
  );

  it("keeps Sendspin audio hidden behind custom controls", () => {
    const wrapper = mount(SendspinPlayer, {
      props: { playerId: "web-player" },
    });

    const audioElements = wrapper.findAll("audio");
    expect(audioElements).toHaveLength(2);
    expect(
      audioElements.every((audio) => !("controls" in audio.attributes())),
    ).toBe(true);
    wrapper.unmount();
  });

  it("unlocks iOS audio once the Sendspin player is ready", async () => {
    let resolvePrepare!: () => void;
    mockPrepareSendspinSession.mockReturnValue(
      new Promise<void>((resolve) => {
        resolvePrepare = resolve;
      }),
    );
    const wrapper = mount(SendspinPlayer, {
      props: { playerId: "web-player" },
    });
    const unlockAudio = getAudioUnlockHandler();

    expect(unlockAudio()).toBe(false);
    expect(mockSendspinUnlock).not.toHaveBeenCalled();

    resolvePrepare();
    await flushPromises();

    expect(unlockAudio()).toBe(true);
    expect(mockSendspinUnlock).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("logs rejected iOS audio unlocks", async () => {
    const error = new Error("unlock failed");
    mockPrepareSendspinSession.mockResolvedValue(undefined);
    mockSendspinUnlock.mockRejectedValue(error);
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const wrapper = mount(SendspinPlayer, {
      props: { playerId: "web-player" },
    });
    await flushPromises();

    expect(getAudioUnlockHandler()()).toBe(true);
    await flushPromises();

    expect(debugSpy).toHaveBeenCalledWith(
      "Sendspin: failed to prime audio for listen-in",
      error,
    );
    wrapper.unmount();
  });

  it("clears stale guest state again when the player mode changes", async () => {
    authState.guest = "music_quiz";
    const wrapper = mount(SendspinPlayer, {
      props: { playerId: "web-player" },
    });
    seedStaleMediaSession();

    webPlayer.tabMode = WebPlayerMode.SENDSPIN_WITH_CONTROLS;
    await nextTick();

    expect(mediaSession.metadata).toBeNull();
    expect(mediaSession.playbackState).toBe("none");
    expect(actions.every((action) => handlers.get(action) === null)).toBe(true);
    invokeAllActions();
    expectPlayerCommandsNotCalled();
    wrapper.unmount();
  });

  it("disables controls while a signed-in user plays along", async () => {
    const wrapper = mount(SendspinPlayer, {
      props: { playerId: "web-player" },
    });
    seedStaleMediaSession();

    if (routeState.current) {
      routeState.current.meta = { disableMediaSession: true };
    }
    await nextTick();

    expect(mediaSession.metadata).toBeNull();
    expect(mediaSession.playbackState).toBe("none");
    expect(actions.every((action) => handlers.get(action) === null)).toBe(true);
    invokeAllActions();
    expectPlayerCommandsNotCalled();

    if (routeState.current) routeState.current.meta = {};
    await nextTick();

    expect(mockUseMediaBrowserMetaData).toHaveBeenCalledTimes(2);
    invokeAction("play");
    expect(mockPlayerCommandPlay).toHaveBeenCalledWith("web-player");
    wrapper.unmount();
  });

  it("does not enable controls without MediaSession support", async () => {
    if (routeState.current) {
      routeState.current.meta = { disableMediaSession: true };
    }
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: undefined,
    });
    const wrapper = mount(SendspinPlayer, {
      props: { playerId: "web-player" },
    });

    if (routeState.current) routeState.current.meta = {};
    await nextTick();

    expect(mockUseMediaBrowserMetaData).not.toHaveBeenCalled();
    expectPlayerCommandsNotCalled();
    wrapper.unmount();
  });

  it.each(["party", "music_quiz"] as const)(
    "does not require MediaSession for %s guests",
    async (guest) => {
      authState.guest = guest;
      Object.defineProperty(navigator, "mediaSession", {
        configurable: true,
        value: undefined,
      });

      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });
      webPlayer.tabMode = WebPlayerMode.SENDSPIN_WITH_CONTROLS;
      await nextTick();

      wrapper.unmount();
      expectPlayerCommandsNotCalled();
    },
  );

  it("registers existing controls for normal users", () => {
    vi.useFakeTimers();
    const wrapper = mount(SendspinPlayer, {
      props: { playerId: "web-player" },
    });

    invokeAction("play");
    invokeAction("pause");
    invokeAction("nexttrack");
    invokeAction("previoustrack");
    invokeAction("seekto", { seekTime: 12.6 });
    vi.advanceTimersByTime(250);

    expect(mockUseMediaBrowserMetaData).toHaveBeenCalledWith("web-player");
    expect(mockPlayerCommandPlay).toHaveBeenCalledWith("web-player");
    expect(mockPlayerCommandPause).toHaveBeenCalledWith("web-player");
    expect(mockPlayerCommandNext).toHaveBeenCalledWith("web-player");
    expect(mockPlayerCommandPrevious).toHaveBeenCalledWith("web-player");
    expect(mockPlayerCommandSeek).toHaveBeenCalledWith("web-player", 13);

    wrapper.unmount();
    expect(actions.every((action) => handlers.get(action) === null)).toBe(true);
  });

  it("continues clearing actions when an action is unsupported", () => {
    authState.guest = "party";
    mediaSession.setActionHandler.mockImplementation((action, handler) => {
      if (action === "seekforward") {
        throw new DOMException("Unsupported", "NotSupportedError");
      }
      handlers.set(action, handler);
    });

    const wrapper = mount(SendspinPlayer, {
      props: { playerId: "web-player" },
    });

    expect(handlers.get("seekbackward")).toBeNull();
    wrapper.unmount();
  });

  // Registering seekforward/seekbackward is skipped on iOS/Mac (see
  // registerMediaSessionActionHandlers), so these override the file-wide
  // "iPhone" user agent to exercise the handlers.
  describe("seekforward/seekbackward extrapolation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(ANCHOR * 1000);
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: "Android",
      });
    });

    afterEach(() => {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: "iPhone",
      });
    });

    it("seeks forward from the extrapolated (displayed) position at 2x speed", () => {
      seedPlayingQueue({ elapsed_time: 30, secondsAgo: 3, playback_speed: 2 });

      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });
      invokeAction("seekforward", { seekOffset: 10 });

      // Displayed position is 30 + 3s * 2x = 36, so a +10s skip lands on 46;
      // the raw stored position would give 40.
      expect(mockPlayerCommandSeek).toHaveBeenCalledWith("web-player", 46);
      wrapper.unmount();
    });

    it("seeks backward from the extrapolated (displayed) position at 2x speed", () => {
      seedPlayingQueue({ elapsed_time: 30, secondsAgo: 3, playback_speed: 2 });

      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });
      invokeAction("seekbackward", { seekOffset: 10 });

      expect(mockPlayerCommandSeek).toHaveBeenCalledWith("web-player", 26);
      wrapper.unmount();
    });

    it("clamps seekbackward at 0 instead of going negative", () => {
      seedPlayingQueue({ elapsed_time: 2, secondsAgo: 1, playback_speed: 2 });

      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });
      invokeAction("seekbackward", { seekOffset: 10 });

      // Displayed position is 2 + 1s * 2x = 4; 4 - 10 would go negative.
      expect(mockPlayerCommandSeek).toHaveBeenCalledWith("web-player", 0);
      wrapper.unmount();
    });

    it("chains repeated seekforward presses off the previous target instead of re-resolving", () => {
      seedPlayingQueue({ elapsed_time: 30, secondsAgo: 3, playback_speed: 2 });

      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });
      invokeAction("seekforward", { seekOffset: 10 });
      expect(mockPlayerCommandSeek).toHaveBeenLastCalledWith("web-player", 46);

      // Resolving the position again instead of chaining would land on 16 here.
      apiMock.queueElapsedTime.queue.elapsed_time = 0;
      invokeAction("seekforward", { seekOffset: 10 });
      expect(mockPlayerCommandSeek).toHaveBeenLastCalledWith("web-player", 56);

      wrapper.unmount();
    });

    it("resolves the position again once the chained seek position expires", () => {
      seedPlayingQueue({ elapsed_time: 30, secondsAgo: 3, playback_speed: 2 });

      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });
      invokeAction("seekforward", { seekOffset: 10 });
      expect(mockPlayerCommandSeek).toHaveBeenLastCalledWith("web-player", 46);

      vi.advanceTimersByTime(2000);

      // Displayed position is now 30 + 5s * 2x = 40, so the skip lands on 50;
      // chaining off the previous target would give 56.
      invokeAction("seekforward", { seekOffset: 10 });
      expect(mockPlayerCommandSeek).toHaveBeenLastCalledWith("web-player", 50);

      wrapper.unmount();
    });

    it("seeks relative to the target player, not the active player", () => {
      // The web player is listening in at 36s while the selected player, whose
      // metadata the media session would otherwise follow, sits at 500s.
      seedPlayingQueue({ elapsed_time: 30, secondsAgo: 3, playback_speed: 2 });
      apiMock.players["active-player"] = {
        player_id: "active-player",
        playback_state: PlaybackState.PLAYING,
        active_source: "other-queue",
        group_members: [],
      };
      apiMock.queues["other-queue"] = {
        queue_id: "other-queue",
        state: PlaybackState.PLAYING,
        active: true,
      };
      apiMock.queueElapsedTime["other-queue"] = {
        elapsed_time: 500,
        elapsed_time_last_updated: ANCHOR,
      };
      storeMock.activePlayer = apiMock.players["active-player"];

      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });
      invokeAction("seekforward", { seekOffset: 10 });

      // The active player's position would give 510.
      expect(mockPlayerCommandSeek).toHaveBeenCalledWith("web-player", 46);
      wrapper.unmount();
    });

    it("does not seek when no timing source is available", () => {
      apiMock.queues = {};
      apiMock.queueElapsedTime = {};

      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });
      invokeAction("seekforward", { seekOffset: 10 });
      invokeAction("seekbackward", { seekOffset: 10 });

      expect(mockPlayerCommandSeek).not.toHaveBeenCalled();
      wrapper.unmount();
    });

    it("seeks to the start for a seekto of 0", () => {
      const wrapper = mount(SendspinPlayer, {
        props: { playerId: "web-player" },
      });
      invokeAction("seekto", { seekTime: 0 });

      expect(mockPlayerCommandSeek).toHaveBeenCalledWith("web-player", 0);
      wrapper.unmount();
    });
  });
});

function getAudioUnlockHandler(): () => boolean {
  const handler = mockRegisterWebPlayerAudioUnlock.mock.calls.at(-1)?.[0];
  if (!handler) throw new Error("Audio unlock handler was not registered");
  return handler;
}

/**
 * Set the queue the web player is attached to playing at the given position.
 */
function seedPlayingQueue(timing: {
  elapsed_time: number;
  secondsAgo: number;
  playback_speed: number;
}): void {
  apiMock.queues.queue = {
    queue_id: "queue",
    state: PlaybackState.PLAYING,
    active: true,
    current_item: {
      extra_attributes: { playback_speed: timing.playback_speed },
    },
  };
  apiMock.queueElapsedTime.queue = {
    elapsed_time: timing.elapsed_time,
    elapsed_time_last_updated: ANCHOR - timing.secondsAgo,
  };
}

function seedStaleMediaSession(): void {
  mediaSession.metadata = {} as MediaMetadata;
  mediaSession.playbackState = "playing";
  for (const action of actions) {
    handlers.set(action, () => {
      mockPlayerCommandPlay("stale-player");
    });
  }
}

function invokeAction(
  action: MediaSessionAction,
  details: Partial<MediaSessionActionDetails> = {},
): void {
  handlers.get(action)?.({
    action,
    ...details,
  } as MediaSessionActionDetails);
}

function invokeAllActions(): void {
  for (const action of actions) invokeAction(action);
}

function expectPlayerCommandsNotCalled(): void {
  expect(mockPlayerCommandPlay).not.toHaveBeenCalled();
  expect(mockPlayerCommandPause).not.toHaveBeenCalled();
  expect(mockPlayerCommandNext).not.toHaveBeenCalled();
  expect(mockPlayerCommandPrevious).not.toHaveBeenCalled();
  expect(mockPlayerCommandSeek).not.toHaveBeenCalled();
}

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
