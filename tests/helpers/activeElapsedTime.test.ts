import {
  resolveActiveElapsedTime,
  resolveActiveTiming,
  resolveQueueElapsedTime,
  resolveQueueTiming,
} from "@/helpers/activeElapsedTime";
import { PlaybackState } from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Only the fields the helper actually reads are mocked.
interface MockQueue {
  queue_id: string;
  state?: PlaybackState;
  active?: boolean;
  current_item?: { extra_attributes?: { playback_speed?: number } };
}

interface MockPlayer {
  player_id: string;
  active_source?: string;
  playback_state?: PlaybackState;
  elapsed_time?: number;
  elapsed_time_last_updated?: number;
  current_media?: {
    elapsed_time?: number;
    elapsed_time_last_updated?: number;
  };
}

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, MockPlayer>,
    queues: {} as Record<string, MockQueue>,
    queueElapsedTime: {} as Record<
      string,
      { elapsed_time?: number; elapsed_time_last_updated?: number }
    >,
  },
  storeMock: {
    activePlayer: undefined as MockPlayer | undefined,
  },
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

// epoch seconds the fake clock starts at; timestamps below are relative to this
const NOW = 1_700_000_000;

const ACTIVE_PLAYER_ID = "p1";

/**
 * Seed a queue and point the active player at it.
 *
 * The queue is reached through the player's `active_source`, so a queue on its
 * own is invisible to the resolver.
 */
function seedQueue(queue: MockQueue): void {
  apiMock.queues[queue.queue_id] = queue;
  storeMock.activePlayer = {
    ...storeMock.activePlayer,
    player_id: ACTIVE_PLAYER_ID,
    active_source: queue.queue_id,
  };
}

/** Seed the active player's own fields, keeping any queue already seeded. */
function seedPlayer(player: Omit<MockPlayer, "player_id">): void {
  storeMock.activePlayer = {
    ...storeMock.activePlayer,
    player_id: ACTIVE_PLAYER_ID,
    ...player,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
  apiMock.players = {};
  apiMock.queues = {};
  apiMock.queueElapsedTime = {};
  storeMock.activePlayer = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resolveActiveTiming / resolveActiveElapsedTime", () => {
  it("returns undefined when neither the queue nor the player reports a timing", () => {
    expect(resolveActiveTiming()).toBeUndefined();
    expect(resolveActiveElapsedTime()).toBeUndefined();

    // an active queue without a timing entry, on a player reporting none either
    seedQueue({ queue_id: "q1", active: true });
    expect(resolveActiveTiming()).toBeUndefined();
  });

  it("falls back to the player when the queue is not active", () => {
    // a queue still selected on the player, holding the position it stopped at
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: false,
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      current_media: { elapsed_time: 20, elapsed_time_last_updated: NOW },
    });

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveActiveElapsedTime()).toBeCloseTo(24, 6);
  });

  it("reports no position for an inactive queue when the player has none either", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: false,
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({ playback_state: PlaybackState.IDLE });

    expect(resolveActiveTiming()).toBeUndefined();
    expect(resolveActiveElapsedTime()).toBeUndefined();
  });

  it("prefers queue timing, paired with the queue's own state", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };
    // player disagrees on both state and position; it must be ignored
    seedPlayer({
      playback_state: PlaybackState.PAUSED,
      current_media: { elapsed_time: 999, elapsed_time_last_updated: NOW },
    });

    expect(resolveActiveTiming()?.playbackState).toBe(PlaybackState.PLAYING);

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveActiveElapsedTime()).toBeCloseTo(14, 6);
  });

  it("does not advance when the queue is paused, even if the player is playing", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PAUSED,
      active: true,
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({ playback_state: PlaybackState.PLAYING });

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveActiveElapsedTime()).toBe(10);
  });

  it("falls back to current_media timing, paired with the player's playback_state", () => {
    // a queue is active but has no reported elapsed time of its own
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
    });
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      current_media: { elapsed_time: 20, elapsed_time_last_updated: NOW },
    });

    expect(resolveActiveTiming()?.playbackState).toBe(PlaybackState.PLAYING);

    vi.setSystemTime((NOW + 3) * 1000);
    expect(resolveActiveElapsedTime()).toBeCloseTo(23, 6);
  });

  it("falls back to player-level elapsed_time when there is no queue or current_media timing", () => {
    seedPlayer({
      playback_state: PlaybackState.PAUSED,
      elapsed_time: 5,
      elapsed_time_last_updated: NOW,
    });

    vi.setSystemTime((NOW + 100) * 1000);
    expect(resolveActiveElapsedTime()).toBe(5);
  });

  it("falls through an empty current_media to the player-level elapsed_time", () => {
    // the shape players report when they only expose a position at player
    // level, e.g. a Home Assistant media_player with a media_position
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 30,
      elapsed_time_last_updated: NOW,
      current_media: {},
    });

    vi.setSystemTime((NOW + 6) * 1000);
    expect(resolveActiveElapsedTime()).toBeCloseTo(36, 6);
  });

  it("prefers a queue elapsed_time of 0 over a player timing", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 0,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 500,
      elapsed_time_last_updated: NOW,
    });

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveActiveElapsedTime()).toBeCloseTo(4, 6);
  });

  it("falls through to the player when the queue reports no last-updated time", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
    });
    apiMock.queueElapsedTime["q1"] = { elapsed_time: 10 };
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 500,
      elapsed_time_last_updated: NOW,
    });

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveActiveElapsedTime()).toBeCloseTo(504, 6);
  });

  it.each([
    [
      "current_media",
      {
        current_media: { elapsed_time: 10, elapsed_time_last_updated: NOW },
      },
    ],
    ["player-level", { elapsed_time: 10, elapsed_time_last_updated: NOW }],
  ])(
    "does not extrapolate a %s timing when the player reports no state",
    (_source, player) => {
      seedPlayer(player);

      vi.setSystemTime((NOW + 4) * 1000);
      expect(resolveActiveTiming()?.playbackState).toBe(PlaybackState.IDLE);
      expect(resolveActiveElapsedTime()).toBe(10);
    },
  );

  it("scales the queue-sourced delta by the current item's playback_speed", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
      current_item: { extra_attributes: { playback_speed: 1.5 } },
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveActiveElapsedTime()).toBeCloseTo(16, 6); // 10 + 4 * 1.5
  });

  it("scales a player-level fallback delta by the current item's playback_speed too", () => {
    // the queue reports no position of its own, but its item sets the speed
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
      current_item: { extra_attributes: { playback_speed: 1.5 } },
    });
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    });

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveActiveElapsedTime()).toBeCloseTo(16, 6);
  });

  it("defaults playback_speed to 1 when the current item has no extra_attributes", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
      current_item: {},
    });
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    });

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveActiveElapsedTime()).toBeCloseTo(14, 6);
  });

  it("returns the stored elapsed_time unchanged when paused, regardless of speed", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PAUSED,
      active: true,
      current_item: { extra_attributes: { playback_speed: 2 } },
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 42,
      elapsed_time_last_updated: NOW,
    };

    vi.setSystemTime((NOW + 50) * 1000);
    expect(resolveActiveElapsedTime()).toBe(42);
  });

  it("resolves the requested player, not the active one", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };
    // a second player, playing something else at its own speed
    apiMock.players["p2"] = { player_id: "p2", active_source: "q2" };
    apiMock.queues["q2"] = {
      queue_id: "q2",
      state: PlaybackState.PLAYING,
      active: true,
      current_item: { extra_attributes: { playback_speed: 2 } },
    };
    apiMock.queueElapsedTime["q2"] = {
      elapsed_time: 100,
      elapsed_time_last_updated: NOW,
    };

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveActiveTiming("p2")?.playbackSpeed).toBe(2);
    expect(resolveActiveElapsedTime("p2")).toBeCloseTo(108, 6); // 100 + 4 * 2
    // the active player sits at 14, so falling back to it is unmistakable
    expect(resolveActiveElapsedTime()).toBeCloseTo(14, 6);
  });

  it("returns undefined for an unknown player id", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };

    expect(resolveActiveTiming("unknown")).toBeUndefined();
    expect(resolveActiveElapsedTime("unknown")).toBeUndefined();
  });
});

describe("resolveQueueTiming / resolveQueueElapsedTime", () => {
  it("returns the queue timing, paired with the queue's own state", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
      current_item: { extra_attributes: { playback_speed: 1.5 } },
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };

    expect(resolveQueueTiming()?.playbackState).toBe(PlaybackState.PLAYING);

    vi.setSystemTime((NOW + 4) * 1000);
    expect(resolveQueueElapsedTime()).toBeCloseTo(16, 6); // 10 + 4 * 1.5
  });

  it("returns undefined when there is no queue, whatever the player reports", () => {
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      current_media: { elapsed_time: 20, elapsed_time_last_updated: NOW },
      elapsed_time: 30,
      elapsed_time_last_updated: NOW,
    });

    expect(resolveQueueTiming()).toBeUndefined();
    expect(resolveQueueElapsedTime()).toBeUndefined();
    // the general resolver still falls back to the player for external sources
    expect(resolveActiveElapsedTime()).toBeCloseTo(20, 6);
  });

  it("returns undefined for a queue that is no longer active", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: false,
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };

    expect(resolveQueueTiming()).toBeUndefined();
    expect(resolveQueueElapsedTime()).toBeUndefined();
  });

  it("returns undefined when the queue reports no timing, instead of falling back to the player", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
    });
    apiMock.queueElapsedTime["q1"] = { elapsed_time: 10 };
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 500,
      elapsed_time_last_updated: NOW,
    });

    expect(resolveQueueElapsedTime()).toBeUndefined();
  });

  it("does not advance while the queue is paused", () => {
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PAUSED,
      active: true,
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 42,
      elapsed_time_last_updated: NOW,
    };

    vi.setSystemTime((NOW + 50) * 1000);
    expect(resolveQueueElapsedTime()).toBe(42);
  });
});
