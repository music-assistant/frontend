import SendspinPlayer from "@/components/SendspinPlayer.vue";
import { webPlayer, WebPlayerMode } from "@/plugins/web_player";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  authState,
  mockPlayerCommandNext,
  mockPlayerCommandPause,
  mockPlayerCommandPlay,
  mockPlayerCommandPrevious,
  mockPlayerCommandSeek,
  mockPrepareSendspinSession,
  mockUseMediaBrowserMetaData,
  routeState,
} = vi.hoisted(() => ({
  authState: {
    guest: null as "music_quiz" | "party" | null,
  },
  mockPlayerCommandNext: vi.fn(),
  mockPlayerCommandPause: vi.fn(),
  mockPlayerCommandPlay: vi.fn(),
  mockPlayerCommandPrevious: vi.fn(),
  mockPlayerCommandSeek: vi.fn(),
  mockPrepareSendspinSession: vi.fn(),
  mockUseMediaBrowserMetaData: vi.fn(() => vi.fn()),
  routeState: {
    current: null as { meta: Record<string, unknown> } | null,
  },
}));

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
  default: {
    players: {
      "web-player": {
        playback_state: "playing",
        group_members: [],
      },
    },
    queueElapsedTime: {
      queue: {
        elapsed_time: 30,
      },
    },
    playerCommandNext: mockPlayerCommandNext,
    playerCommandPause: mockPlayerCommandPause,
    playerCommandPlay: mockPlayerCommandPlay,
    playerCommandPrevious: mockPlayerCommandPrevious,
    playerCommandSeek: mockPlayerCommandSeek,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: {
    activePlayerId: "active-player",
    activePlayer: {
      playback_state: "playing",
    },
    activePlayerQueue: {
      queue_id: "queue",
    },
  },
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
    registerWebPlayerAudioUnlock: vi.fn(),
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

vi.mock("@/plugins/api/helpers", () => ({
  getDeviceName: () => "Browser",
}));

vi.mock("@sendspin/sendspin-js", () => ({
  SendspinPlayer: class {
    connect = vi.fn();
    disconnect = vi.fn();
    setCorrectionMode = vi.fn();
    setMuted = vi.fn();
    setVolume = vi.fn();
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
    webPlayer.interacted = false;
    webPlayer.tabMode = WebPlayerMode.SENDSPIN_ONLY;
    if (routeState.current) routeState.current.meta = {};
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: mediaSession,
    });
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.useRealTimers();
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
});

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
