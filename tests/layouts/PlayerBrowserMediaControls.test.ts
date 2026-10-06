import PlayerBrowserMediaControls from "@/layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { MediaType, PlaybackState } from "@/plugins/api/interfaces";
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
  mockQueueCommandSkip,
  mockUseMediaBrowserMetaData,
} = vi.hoisted(() => {
  const mockPlayerCommandSeek = vi.fn<MusicAssistantApi["playerCommandSeek"]>();
  const mockQueueCommandSkip = vi.fn<MusicAssistantApi["queueCommandSkip"]>();
  return {
    apiMock: {
      players: {} as Record<string, MockPlayer>,
      queues: {} as Record<string, MockQueue>,
      queueElapsedTime: {} as Record<
        string,
        { elapsed_time?: number; elapsed_time_last_updated?: number }
      >,
      playerCommandPlay: vi.fn<MusicAssistantApi["playerCommandPlay"]>(),
      playerCommandPause: vi.fn<MusicAssistantApi["playerCommandPause"]>(),
      playerCommandNext: vi.fn<MusicAssistantApi["playerCommandNext"]>(),
      playerCommandPrevious:
        vi.fn<MusicAssistantApi["playerCommandPrevious"]>(),
      playerCommandSeek: mockPlayerCommandSeek,
      queueCommandSkip: mockQueueCommandSkip,
    },
    storeMock: {
      activePlayer: undefined as MockPlayer | undefined,
      activePlayerQueue: undefined as
        { queue_id: string; current_item?: { duration?: number } } | undefined,
      curQueueItem: undefined as
        { media_item: { media_type: MediaType } } | undefined,
    },
    mockPlayerCommandSeek,
    mockQueueCommandSkip,
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
    storeMock.curQueueItem = undefined;
    storeMock.activePlayerQueue = undefined;
    mockPlayerCommandSeek.mockClear();
    mockQueueCommandSkip.mockClear();
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

  it("keeps the 10 second jump for a track", () => {
    seedPlayingQueue({ elapsed_time: 30, secondsAgo: 0, playback_speed: 1 });
    storeMock.curQueueItem = {
      media_item: { media_type: MediaType.TRACK },
    };

    const wrapper = mount(PlayerBrowserMediaControls);
    invokeAction("seekforward");

    expect(mockPlayerCommandSeek).toHaveBeenCalledWith("player-1", 40);
    expect(mockQueueCommandSkip).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  // audiobooks and podcasts skip the same amounts as the skip buttons
  it.each([
    { mediaType: MediaType.AUDIOBOOK, action: "seekforward", seconds: 30 },
    { mediaType: MediaType.AUDIOBOOK, action: "seekbackward", seconds: -10 },
    {
      mediaType: MediaType.PODCAST_EPISODE,
      action: "seekforward",
      seconds: 30,
    },
  ] as const)(
    "skips $seconds seconds on a $action for a $mediaType",
    ({ mediaType, action, seconds }) => {
      seedSkipCapableQueue(mediaType);

      const wrapper = mount(PlayerBrowserMediaControls);
      invokeAction(action);

      expect(mockQueueCommandSkip).toHaveBeenCalledWith("queue", seconds);
      expect(mockPlayerCommandSeek).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

  it("keeps the offset the OS sends for an audiobook", () => {
    seedSkipCapableQueue(MediaType.AUDIOBOOK);

    const wrapper = mount(PlayerBrowserMediaControls);
    invokeAction("seekforward", { seekOffset: 5 });

    expect(mockQueueCommandSkip).toHaveBeenCalledWith("queue", 5);
    wrapper.unmount();
  });

  // the server rejects a skip in an item without a duration
  it.each([
    { label: "missing", currentItem: {} },
    { label: "zero", currentItem: { duration: 0 } },
  ])(
    "does not skip or seek an audiobook with a $label duration",
    ({ currentItem }) => {
      seedSkipCapableQueue(MediaType.AUDIOBOOK, currentItem);

      const wrapper = mount(PlayerBrowserMediaControls);
      invokeAction("seekforward");
      invokeAction("seekbackward");

      expect(mockQueueCommandSkip).not.toHaveBeenCalled();
      expect(mockPlayerCommandSeek).not.toHaveBeenCalled();
      wrapper.unmount();
    },
  );

  it("keeps seeking a track by 10 seconds on a server with accurate skip", () => {
    seedSkipCapableQueue(MediaType.TRACK);

    const wrapper = mount(PlayerBrowserMediaControls);
    invokeAction("seekforward");

    expect(mockPlayerCommandSeek).toHaveBeenCalledWith("player-1", 40);
    expect(mockQueueCommandSkip).not.toHaveBeenCalled();
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

function seedSkipCapableQueue(
  mediaType: MediaType,
  currentItem: { duration?: number } = { duration: 3600 },
): void {
  seedPlayingQueue({ elapsed_time: 30, secondsAgo: 0, playback_speed: 1 });
  storeMock.activePlayerQueue = {
    queue_id: "queue",
    current_item: currentItem,
  };
  storeMock.curQueueItem = { media_item: { media_type: mediaType } };
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
