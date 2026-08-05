import PlayerTimeline from "@/layouts/default/PlayerOSD/PlayerTimeline.vue";
import apiDefault from "@/plugins/api";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store as storeModule } from "@/plugins/store";
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

// Only the fields the timeline and the elapsed-time resolver read are mocked;
// both are reactive so a state change is picked up the way the real store's is.
vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    queues: {},
    queueElapsedTime: {},
    playerCommandSeek: vi.fn(),
    playMedia: vi.fn(),
  });
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      curQueueItem: undefined,
    }),
  };
});

// The timeline only consults the sources to decide whether seeking is allowed,
// which is unrelated to the tick.
vi.mock("@/composables/activeSource", () => ({
  useActiveSource: () => ({ activeSource: { value: undefined } }),
}));

vi.mock("@/composables/activeAudioSource", () => ({
  useActiveAudioSource: () => ({ activeAudioSource: { value: undefined } }),
}));

interface TestTiming {
  elapsed_time?: number;
  elapsed_time_last_updated?: number;
}

interface TestStore {
  activePlayer?: TestTiming & {
    player_id: string;
    active_source?: string;
    playback_state?: PlaybackState;
    current_media?: TestTiming & { duration?: number };
  };
  curQueueItem?: { queue_item_id?: string };
}

const api = apiDefault as unknown as {
  queues: Record<
    string,
    { queue_id: string; state?: PlaybackState; active?: boolean }
  >;
  queueElapsedTime: Record<string, TestTiming>;
};
const store = storeModule as unknown as TestStore;

// epoch seconds the fake clock starts at; timestamps below are relative to this
const NOW = 1_700_000_000;

let wrapper: VueWrapper | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
  api.queues = {};
  api.queueElapsedTime = {};
  store.activePlayer = undefined;
  store.curQueueItem = undefined;
});

afterEach(() => {
  // the store is shared, so an instance left mounted would react to the next
  // test's state and its timers would count towards that test's timer budget
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
});

describe("PlayerTimeline", () => {
  it.each([
    ["playing", PlaybackState.PLAYING],
    ["paused", PlaybackState.PAUSED],
  ])("shows the position it mounts on for a %s player", (_state, state) => {
    store.activePlayer = {
      player_id: "p1",
      playback_state: state,
      elapsed_time: 30,
      elapsed_time_last_updated: NOW,
      current_media: { duration: 300 },
    };

    mountTimeline();
    expect(elapsedLabel()).toBe("00:30");
  });

  it("animates a queue-sourced position", async () => {
    api.queues["q1"] = {
      queue_id: "q1",
      state: PlaybackState.PLAYING,
      active: true,
    };
    api.queueElapsedTime["q1"] = {
      elapsed_time: 10,
      elapsed_time_last_updated: NOW,
    };
    store.activePlayer = {
      player_id: "p1",
      active_source: "q1",
      playback_state: PlaybackState.PLAYING,
      current_media: { duration: 300 },
    };

    mountTimeline();
    expect(await elapsedLabelAfter(4)).toBe("00:14");
  });

  it("animates a current_media position for an external source", async () => {
    store.activePlayer = {
      player_id: "p1",
      playback_state: PlaybackState.PLAYING,
      current_media: {
        duration: 300,
        elapsed_time: 20,
        elapsed_time_last_updated: NOW,
      },
    };

    mountTimeline();
    expect(await elapsedLabelAfter(5)).toBe("00:25");
  });

  it("animates a player-level position when current_media reports none", async () => {
    // players that only report their position at player level, e.g. a Home
    // Assistant media_player with a media_position but no media_title
    store.activePlayer = {
      player_id: "p1",
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 30,
      elapsed_time_last_updated: NOW,
      current_media: { duration: 300 },
    };

    mountTimeline();
    expect(await elapsedLabelAfter(6)).toBe("00:36");
  });

  it("animates a player-level position with no current_media at all", async () => {
    store.activePlayer = {
      player_id: "p1",
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 30,
      elapsed_time_last_updated: NOW,
    };

    mountTimeline();
    expect(await elapsedLabelAfter(6)).toBe("00:36");
  });

  it("does not start the tick for a source that is paused", async () => {
    store.activePlayer = {
      player_id: "p1",
      playback_state: PlaybackState.PAUSED,
      elapsed_time: 30,
      elapsed_time_last_updated: NOW,
      current_media: { duration: 300 },
    };

    mountTimeline();
    expect(await elapsedLabelAfter(10)).toBe("00:30");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops ticking once playback stops", async () => {
    store.activePlayer = {
      player_id: "p1",
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 30,
      elapsed_time_last_updated: NOW,
      current_media: { duration: 300 },
    };

    mountTimeline();
    expect(await elapsedLabelAfter(4)).toBe("00:34");

    store.activePlayer = {
      player_id: "p1",
      playback_state: PlaybackState.PAUSED,
      elapsed_time: 34,
      elapsed_time_last_updated: NOW + 4,
      current_media: { duration: 300 },
    };
    await nextTick();
    // the timers are released rather than left spinning behind a frozen label
    expect(vi.getTimerCount()).toBe(0);
    expect(await elapsedLabelAfter(20)).toBe("00:34");
  });

  it("shows no position when no source reports one", async () => {
    store.activePlayer = {
      player_id: "p1",
      playback_state: PlaybackState.PLAYING,
      current_media: { duration: 300 },
    };

    mountTimeline();
    expect(await elapsedLabelAfter(10)).toBe("00:00");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases the tick on unmount", async () => {
    store.activePlayer = {
      player_id: "p1",
      playback_state: PlaybackState.PLAYING,
      elapsed_time: 30,
      elapsed_time_last_updated: NOW,
      current_media: { duration: 300 },
    };

    mountTimeline();
    await elapsedLabelAfter(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    wrapper!.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

function mountTimeline() {
  wrapper = mount(PlayerTimeline, {
    props: { showLabels: true },
    global: {
      // mounting reka's slider for real costs orders of magnitude more than the
      // rest of the component; the time labels render outside of it anyway.
      stubs: {
        SliderRoot: true,
        SliderTrack: true,
        SliderRange: true,
        SliderThumb: true,
      },
    },
  });
}

function elapsedLabel(): string {
  return wrapper!.find(".time-text-left").text();
}

/**
 * The elapsed-time label after `seconds` of wall-clock time have passed with no
 * store update in between, so only the component's own tick can move it.
 */
async function elapsedLabelAfter(seconds: number): Promise<string> {
  await vi.advanceTimersByTimeAsync(seconds * 1000);
  await nextTick();
  return elapsedLabel();
}
