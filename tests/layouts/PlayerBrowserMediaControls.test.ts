import PlayerBrowserMediaControls from "@/layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import { PlaybackState } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Only the fields the component and the timing helper read are mocked.
interface MockPlayer {
  player_id?: string;
  active_source?: string;
  playback_state?: PlaybackState;
}

interface MockQueue {
  queue_id: string;
  state?: PlaybackState;
  active?: boolean;
  current_item?: { extra_attributes?: { playback_speed?: number } };
}

const {
  apiMock,
  storeMock,
  mockPlayerCommandSeek,
  mockUseMediaBrowserMetaData,
} = vi.hoisted(() => {
  const mockPlayerCommandSeek = vi.fn();
  return {
    apiMock: {
      players: {} as Record<string, MockPlayer>,
      queues: {} as Record<string, MockQueue>,
      queueElapsedTime: {} as Record<
        string,
        { elapsed_time?: number; elapsed_time_last_updated?: number }
      >,
      playerCommandPlay: vi.fn(),
      playerCommandPause: vi.fn(),
      playerCommandNext: vi.fn(),
      playerCommandPrevious: vi.fn(),
      playerCommandSeek: mockPlayerCommandSeek,
    },
    storeMock: {
      activePlayer: undefined as MockPlayer | undefined,
    },
    mockPlayerCommandSeek,
    mockUseMediaBrowserMetaData: vi.fn(),
  };
});

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/helpers/useMediaBrowserMetaData", () => ({
  useMediaBrowserMetaData: mockUseMediaBrowserMetaData,
}));

type ActionHandler = ((details: MediaSessionActionDetails) => void) | null;

const handlers = new Map<MediaSessionAction, ActionHandler>();
const mediaSession = {
  setActionHandler: vi.fn(
    (action: MediaSessionAction, handler: ActionHandler) => {
      handlers.set(action, handler);
    },
  ),
};

const ANCHOR = 1_700_000_000;

describe("PlayerBrowserMediaControls seek handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(ANCHOR * 1000);
    handlers.clear();
    mediaSession.setActionHandler.mockClear();
    mediaSession.setActionHandler.mockImplementation((action, handler) => {
      handlers.set(action, handler);
    });
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: mediaSession,
    });
    // Registering seekforward/seekbackward is skipped on iOS/Mac.
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Android",
    });
    apiMock.queues = {};
    apiMock.queueElapsedTime = {};
    // The component seeks store.activePlayer, and the timing helper looks that
    // same player up in api.players.
    apiMock.players = { "player-1": { player_id: "player-1" } };
    storeMock.activePlayer = apiMock.players["player-1"];
    mockPlayerCommandSeek.mockClear();
    mockUseMediaBrowserMetaData.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, "mediaSession");
    Reflect.deleteProperty(navigator, "userAgent");
  });

  it("seeks forward from the extrapolated (displayed) position at 2x speed", () => {
    seedPlayingQueue({ elapsed_time: 30, secondsAgo: 3, playback_speed: 2 });

    const wrapper = mount(PlayerBrowserMediaControls);
    invokeAction("seekforward", { seekOffset: 10 });

    // Displayed position is 30 + 3s * 2x = 36, so a +10s skip lands on 46; the
    // raw stored position would give 40.
    expect(mockPlayerCommandSeek).toHaveBeenCalledWith("player-1", 46);
    wrapper.unmount();
  });

  it("seeks backward from the extrapolated (displayed) position at 2x speed", () => {
    seedPlayingQueue({ elapsed_time: 30, secondsAgo: 3, playback_speed: 2 });

    const wrapper = mount(PlayerBrowserMediaControls);
    invokeAction("seekbackward", { seekOffset: 10 });

    expect(mockPlayerCommandSeek).toHaveBeenCalledWith("player-1", 26);
    wrapper.unmount();
  });

  it("clamps seekbackward at 0 instead of going negative", () => {
    seedPlayingQueue({ elapsed_time: 2, secondsAgo: 1, playback_speed: 2 });

    const wrapper = mount(PlayerBrowserMediaControls);
    invokeAction("seekbackward", { seekOffset: 10 });

    expect(mockPlayerCommandSeek).toHaveBeenCalledWith("player-1", 0);
    wrapper.unmount();
  });

  it("passes seekTime straight through for seekto", () => {
    const wrapper = mount(PlayerBrowserMediaControls);
    invokeAction("seekto", { seekTime: 12.6 });

    expect(mockPlayerCommandSeek).toHaveBeenCalledWith("player-1", 13);
    wrapper.unmount();
  });

  it("seeks to the start for a seekto of 0", () => {
    const wrapper = mount(PlayerBrowserMediaControls);
    invokeAction("seekto", { seekTime: 0 });

    expect(mockPlayerCommandSeek).toHaveBeenCalledWith("player-1", 0);
    wrapper.unmount();
  });

  it("does not seek when no timing source is available", () => {
    const wrapper = mount(PlayerBrowserMediaControls);
    invokeAction("seekforward", { seekOffset: 10 });

    expect(mockPlayerCommandSeek).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

function seedPlayingQueue(timing: {
  elapsed_time: number;
  secondsAgo: number;
  playback_speed: number;
}): void {
  apiMock.players["player-1"] = {
    player_id: "player-1",
    active_source: "queue",
  };
  storeMock.activePlayer = apiMock.players["player-1"];
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

function invokeAction(
  action: MediaSessionAction,
  details: Partial<MediaSessionActionDetails> = {},
): void {
  handlers.get(action)?.({
    action,
    ...details,
  } as MediaSessionActionDetails);
}
