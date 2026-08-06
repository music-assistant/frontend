import {
  cleanupCompanionIntegration,
  initializeCompanionIntegration,
  NowPlaying,
} from "@/plugins/companion";
import { PlaybackState } from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

// Only the fields the companion payload and the timing resolver actually read.
interface MockQueue {
  queue_id: string;
  state?: PlaybackState;
  active?: boolean;
  current_item?: { extra_attributes?: { playback_speed?: number } };
}

interface MockPlayer {
  player_id: string;
  name?: string;
  active_source?: string;
  playback_state?: PlaybackState;
  elapsed_time?: number;
  elapsed_time_last_updated?: number;
  current_media?: {
    uri?: string;
    title?: string;
    artist?: string;
    album?: string;
    duration?: number;
    elapsed_time?: number;
    elapsed_time_last_updated?: number;
  };
}

// The store has to be reactive for the now-playing watcher to fire on changes.
const { apiMock, storeMock } = await vi.hoisted(async () => {
  const { reactive } = await import("vue");
  return {
    apiMock: {
      players: {} as Record<string, MockPlayer>,
      queues: {} as Record<string, MockQueue>,
      queueElapsedTime: {} as Record<
        string,
        { elapsed_time?: number; elapsed_time_last_updated?: number }
      >,
    },
    storeMock: reactive({
      activePlayer: undefined as MockPlayer | undefined,
      companionPlayerId: undefined as string | undefined,
    }),
  };
});

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

// epoch seconds the fake clock starts at; timestamps below are relative to this
const NOW = 1_700_000_000;

const PLAYER_ID = "p1";

const invoke = vi.fn().mockResolvedValue(undefined);

/**
 * Seed a queue and point the active player at it.
 *
 * The queue is reached through the player's `active_source`, so a queue on its
 * own is invisible to the timing resolver.
 */
function seedQueue(queue: MockQueue): void {
  apiMock.queues[queue.queue_id] = queue;
  storeMock.activePlayer = {
    ...storeMock.activePlayer,
    player_id: PLAYER_ID,
    active_source: queue.queue_id,
  };
}

/** Seed the active player's own fields, keeping any queue already seeded. */
function seedPlayer(player: Omit<MockPlayer, "player_id">): void {
  storeMock.activePlayer = {
    ...storeMock.activePlayer,
    player_id: PLAYER_ID,
    ...player,
  };
  apiMock.players[PLAYER_ID] = storeMock.activePlayer!;
}

/** Every now-playing payload pushed to the companion app, in order. */
function nowPlayingPushes(): NowPlaying[] {
  return invoke.mock.calls
    .filter((call) => call[0] === "update_now_playing")
    .map((call) => call[1].nowPlaying);
}

/** The most recent now-playing payload pushed to the companion app. */
function lastNowPlaying(): NowPlaying {
  const pushes = nowPlayingPushes();
  expect(pushes.length).toBeGreaterThan(0);
  return pushes[pushes.length - 1];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
  apiMock.players = {};
  apiMock.queues = {};
  apiMock.queueElapsedTime = {};
  storeMock.activePlayer = undefined;
  invoke.mockClear();
  window.__COMPANION__ = { invoke };
});

afterEach(() => {
  cleanupCompanionIntegration();
  delete window.__COMPANION__;
  vi.useRealTimers();
});

describe("companion now-playing position", () => {
  it("reports the position extrapolated to now, not the last one the server sent", async () => {
    seedQueue({ queue_id: "q1", state: PlaybackState.PLAYING, active: true });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({ playback_state: PlaybackState.PLAYING });

    vi.setSystemTime((NOW + 4) * 1000);
    await initializeCompanionIntegration("");

    expect(lastNowPlaying().elapsed).toBe(14);
  });

  it("scales the position by the playback speed of the current item", async () => {
    // an audiobook or podcast played at 1.5x drifts without this
    seedQueue({
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
      current_item: { extra_attributes: { playback_speed: 1.5 } },
    });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 100,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({ playback_state: PlaybackState.PLAYING });

    vi.setSystemTime((NOW + 10) * 1000);
    await initializeCompanionIntegration("");

    expect(lastNowPlaying().elapsed).toBe(115); // 100 + 10 * 1.5
  });

  it("prefers current_media timing over the legacy player-level fields", async () => {
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      current_media: {
        title: "Track",
        elapsed_time: 20,
        elapsed_time_last_updated: NOW,
      },
      elapsed_time: 999,
      elapsed_time_last_updated: NOW,
    });

    vi.setSystemTime((NOW + 3) * 1000);
    await initializeCompanionIntegration("");

    expect(lastNowPlaying().elapsed).toBe(23);
  });

  it("falls back to the player-level position when current_media reports none", async () => {
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      current_media: { title: "Track" },
      elapsed_time: 30,
      elapsed_time_last_updated: NOW,
    });

    vi.setSystemTime((NOW + 6) * 1000);
    await initializeCompanionIntegration("");

    expect(lastNowPlaying().elapsed).toBe(36);
  });

  it("holds the position while paused", async () => {
    seedQueue({ queue_id: "q1", state: PlaybackState.PAUSED, active: true });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 42,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({ playback_state: PlaybackState.PAUSED });

    vi.setSystemTime((NOW + 50) * 1000);
    await initializeCompanionIntegration("");

    const nowPlaying = lastNowPlaying();
    expect(nowPlaying.elapsed).toBe(42);
    expect(nowPlaying.is_playing).toBe(false);
  });

  it("reports no position when no timing source is available", async () => {
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      current_media: { title: "Track" },
    });

    await initializeCompanionIntegration("");

    expect(lastNowPlaying().elapsed).toBeNull();
  });

  it("ignores the position of players the payload is not about", async () => {
    seedQueue({ queue_id: "q1", state: PlaybackState.PLAYING, active: true });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({ playback_state: PlaybackState.PLAYING });
    // another player, playing something else at its own speed
    apiMock.players["p2"] = { player_id: "p2", active_source: "q2" };
    apiMock.queues["q2"] = {
      queue_id: "q2",
      state: PlaybackState.PLAYING,
      active: true,
      current_item: { extra_attributes: { playback_speed: 2 } },
    };
    apiMock.queueElapsedTime["q2"] = {
      elapsed_time: 500,
      elapsed_time_last_updated: NOW,
    };

    vi.setSystemTime((NOW + 4) * 1000);
    await initializeCompanionIntegration("");

    const nowPlaying = lastNowPlaying();
    expect(nowPlaying.player_id).toBe(PLAYER_ID);
    expect(nowPlaying.elapsed).toBe(14);
  });

  it("pushes the position as of each push, so a later push carries a fresh one", async () => {
    // The companion only consumes this for Discord Rich Presence, which turns it
    // into an absolute start timestamp and runs its own progress bar from there,
    // so an accurate value per push is enough and no periodic tick is needed.
    seedQueue({ queue_id: "q1", state: PlaybackState.PLAYING, active: true });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 0,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      current_media: { uri: "track://1", title: "First" },
    });

    await initializeCompanionIntegration("");
    expect(lastNowPlaying().elapsed).toBe(0);

    // a track change 30s later re-pushes, with the position as of then
    vi.setSystemTime((NOW + 30) * 1000);
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 5,
      elapsed_time_last_updated: NOW + 28,
    };
    seedPlayer({ current_media: { uri: "track://2", title: "Second" } });
    await nextTick();

    const nowPlaying = lastNowPlaying();
    expect(nowPlaying.track).toBe("Second");
    expect(nowPlaying.elapsed).toBe(7); // 5 + (30 - 28)
  });

  it("does not push on its own while a track plays on", async () => {
    // Guards the no-tick decision above: pushes follow track and state changes,
    // not the clock, so nothing keeps re-sending a position Discord already has.
    seedQueue({ queue_id: "q1", state: PlaybackState.PLAYING, active: true });
    apiMock.queueElapsedTime["q1"] = {
      elapsed_time: 0,
      elapsed_time_last_updated: NOW,
    };
    seedPlayer({
      playback_state: PlaybackState.PLAYING,
      current_media: { uri: "track://1", title: "First" },
    });

    await initializeCompanionIntegration("");
    const pushCount = nowPlayingPushes().length;

    // the position advances and any interval would come due
    vi.setSystemTime((NOW + 60) * 1000);
    await vi.advanceTimersByTimeAsync(60_000);
    await nextTick();

    expect(nowPlayingPushes()).toHaveLength(pushCount);
  });
});
