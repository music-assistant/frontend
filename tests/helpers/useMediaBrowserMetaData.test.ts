import { useMediaBrowserMetaData } from "@/helpers/useMediaBrowserMetaData";
import {
  MediaType,
  PlaybackState,
  type PlayableMediaItemType,
  type Player,
  type PlayerQueue,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Reactive api mock so mutating a queue fires the composable's watchers.
const { apiMock } = await vi.hoisted(async () => {
  const { reactive } = await import("vue");
  return {
    apiMock: reactive({
      players: {} as Record<string, Player>,
      queues: {} as Record<string, PlayerQueue>,
      queueElapsedTime: {} as Record<
        string,
        { elapsed_time?: number; elapsed_time_last_updated?: number }
      >,
    }),
  };
});

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

// The real helpers/utils pulls in the router and the whole component tree; only
// the artwork url helper is needed here.
vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url?: string) => url ?? "",
}));

vi.mock("@/composables/useServerTime", () => ({
  serverNow: () => serverTime,
}));

vi.mock("@/plugins/store", () => ({
  store: { activePlayerId: undefined },
}));

vi.mock("@/plugins/auth", () => ({
  default: { isMusicQuizGuest: () => false },
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ currentRoute: { value: { path: "/" } } }),
}));

const PLAYER_ID = "player-1";
const QUEUE_ID = "queue-1";
const ANCHOR = 1_000_000;

const setPositionState = vi.fn();
let serverTime = ANCHOR;
let teardown: (() => void) | undefined;

function makeQueue(
  currentItem: Partial<QueueItem>,
  queue: Partial<PlayerQueue> = {},
): PlayerQueue {
  apiMock.players[PLAYER_ID] = {
    player_id: PLAYER_ID,
    active_source: QUEUE_ID,
  } as Player;
  apiMock.queueElapsedTime[QUEUE_ID] = {
    elapsed_time: 30,
    elapsed_time_last_updated: ANCHOR,
  };
  apiMock.queues[QUEUE_ID] = {
    queue_id: QUEUE_ID,
    active: true,
    state: PlaybackState.PLAYING,
    current_item: {
      queue_id: QUEUE_ID,
      queue_item_id: "queue-item-1",
      name: "Item",
      duration: 200,
      sort_index: 0,
      available: true,
      media_item: { media_type: MediaType.TRACK } as PlayableMediaItemType,
      ...currentItem,
    },
    ...queue,
  } as PlayerQueue;
  return apiMock.queues[QUEUE_ID];
}

beforeEach(() => {
  for (const key of Object.keys(apiMock.players)) delete apiMock.players[key];
  for (const key of Object.keys(apiMock.queues)) delete apiMock.queues[key];
  for (const key of Object.keys(apiMock.queueElapsedTime))
    delete apiMock.queueElapsedTime[key];
  serverTime = ANCHOR;
  setPositionState.mockClear();
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: { setPositionState },
  });
});

afterEach(() => {
  teardown?.();
  teardown = undefined;
  Reflect.deleteProperty(navigator, "mediaSession");
});

describe("useMediaBrowserMetaData position state", () => {
  it("reports the playback speed of the current queue item", () => {
    makeQueue({ extra_attributes: { playback_speed: 1.5 } });

    teardown = useMediaBrowserMetaData(PLAYER_ID);

    expect(setPositionState).toHaveBeenCalledWith({
      duration: 200,
      playbackRate: 1.5,
      position: 30,
    });
  });

  it("reports the new speed when the queue item is replaced", async () => {
    const queue = makeQueue({ extra_attributes: { playback_speed: 1 } });

    teardown = useMediaBrowserMetaData(PLAYER_ID);

    queue.current_item = {
      ...queue.current_item!,
      extra_attributes: { playback_speed: 2 },
    };
    await nextTick();

    expect(setPositionState).toHaveBeenLastCalledWith({
      duration: 200,
      playbackRate: 2,
      position: 30,
    });
  });

  it("re-fires when only the playback speed of the current item changes", async () => {
    const queue = makeQueue({ extra_attributes: { playback_speed: 1 } });

    teardown = useMediaBrowserMetaData(PLAYER_ID);
    expect(setPositionState).toHaveBeenCalledTimes(1);

    queue.current_item!.extra_attributes = { playback_speed: 2 };
    await nextTick();

    expect(setPositionState).toHaveBeenCalledTimes(2);
    expect(setPositionState).toHaveBeenLastCalledWith(
      expect.objectContaining({ playbackRate: 2 }),
    );
  });

  it("carries the stored position forward at the playback speed", () => {
    makeQueue({ extra_attributes: { playback_speed: 2 } });
    serverTime = ANCHOR + 10;

    teardown = useMediaBrowserMetaData(PLAYER_ID);

    expect(setPositionState).toHaveBeenCalledWith(
      expect.objectContaining({ position: 50 }),
    );
  });

  it("keeps the stored position while paused", () => {
    makeQueue(
      { extra_attributes: { playback_speed: 2 } },
      { state: PlaybackState.PAUSED },
    );
    serverTime = ANCHOR + 10;

    teardown = useMediaBrowserMetaData(PLAYER_ID);

    expect(setPositionState).toHaveBeenCalledWith(
      expect.objectContaining({ position: 30 }),
    );
  });

  it.each([
    ["no playback speed", undefined],
    ["a zero playback speed", 0],
    ["a negative playback speed", -1],
    ["a NaN playback speed", NaN],
    ["an infinite playback speed", Infinity],
  ])("falls back to normal speed for %s", (_label, playback_speed) => {
    makeQueue({
      extra_attributes:
        playback_speed === undefined ? undefined : { playback_speed },
    });

    teardown = useMediaBrowserMetaData(PLAYER_ID);

    expect(setPositionState).toHaveBeenCalledWith(
      expect.objectContaining({ playbackRate: 1, position: 30 }),
    );
  });

  it.each([MediaType.AUDIOBOOK, MediaType.PODCAST_EPISODE])(
    "reports position state for %s",
    (mediaType) => {
      makeQueue({
        duration: 3600,
        media_item: { media_type: mediaType } as PlayableMediaItemType,
        extra_attributes: { playback_speed: 1.25 },
      });

      teardown = useMediaBrowserMetaData(PLAYER_ID);

      expect(setPositionState).toHaveBeenCalledWith({
        duration: 3600,
        playbackRate: 1.25,
        position: 30,
      });
    },
  );

  it("clears the progress bar for an item without a known duration", () => {
    makeQueue({
      duration: 0,
      media_item: {
        media_type: MediaType.PODCAST_EPISODE,
      } as PlayableMediaItemType,
    });

    teardown = useMediaBrowserMetaData(PLAYER_ID);

    expect(setPositionState).toHaveBeenCalledWith();
  });

  it("clears the progress bar for a source without a fixed duration", () => {
    makeQueue({
      media_item: { media_type: MediaType.RADIO } as PlayableMediaItemType,
    });

    teardown = useMediaBrowserMetaData(PLAYER_ID);

    expect(setPositionState).toHaveBeenCalledWith();
  });

  it("clears the progress bar for an inactive queue", () => {
    makeQueue({}, { active: false });

    teardown = useMediaBrowserMetaData(PLAYER_ID);

    expect(setPositionState).toHaveBeenCalledWith();
  });
});
