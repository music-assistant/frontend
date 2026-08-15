import { useChapterNavigation } from "@/composables/useChapterNavigation";
import {
  MediaType,
  PlaybackState,
  Player,
  PlayerQueue,
  QueueItem,
} from "@/plugins/api/interfaces";
import apiDefault from "@/plugins/api";
import { store as storeModule } from "@/plugins/store";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({ queues: {}, queueElapsedTime: {} });
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      activePlayerQueue: undefined,
      curQueueItem: undefined,
      currentUser: undefined,
    }),
  };
});

const api = apiDefault as unknown as {
  queues: Record<string, unknown>;
  queueElapsedTime: Record<
    string,
    { elapsed_time?: number; elapsed_time_last_updated?: number }
  >;
};
const store = storeModule as unknown as {
  activePlayer?: Player;
  activePlayerQueue?: PlayerQueue;
  curQueueItem?: QueueItem;
  currentUser?: { preferences?: Record<string, unknown> };
};

const NOW = 1_700_000_000;
const QUEUE_ID = "q1";

const Consumer = defineComponent({
  setup() {
    return useChapterNavigation();
  },
  template: "<div />",
});

function seedPlayingChapterMedia(
  elapsedTime: number,
  mediaType: MediaType = MediaType.AUDIOBOOK,
) {
  store.currentUser = {
    preferences: { audiobook_chapter_progress: true },
  };
  store.activePlayerQueue = {
    queue_id: QUEUE_ID,
    active: true,
    state: PlaybackState.PLAYING,
  } as typeof store.activePlayerQueue;
  store.activePlayer = {
    player_id: "p1",
    active_source: QUEUE_ID,
    playback_state: PlaybackState.PLAYING,
    current_media: {
      media_type: mediaType,
      duration: 120,
      elapsed_time: elapsedTime,
      elapsed_time_last_updated: NOW,
      queue_item_id: "item-1",
    },
  } as typeof store.activePlayer;
  store.curQueueItem = {
    queue_item_id: "item-1",
    media_item: {
      media_type: mediaType,
      metadata: {
        chapters: [
          { position: 1, name: "First", start: 0, end: 60 },
          { position: 2, name: "Second", start: 60, end: 120 },
        ],
      },
    } as unknown as NonNullable<QueueItem["media_item"]>,
  } as unknown as QueueItem;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
  api.queues = {};
  api.queueElapsedTime = {};
  store.activePlayer = undefined;
  store.activePlayerQueue = undefined;
  store.curQueueItem = undefined;
  store.currentUser = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useChapterNavigation", () => {
  it("targets adjacent chapters in both directions", async () => {
    seedPlayingChapterMedia(30);
    const wrapper = mount(Consumer);
    await nextTick();

    expect(wrapper.vm.chapterMode).toBe(true);
    expect(wrapper.vm.previousChapter).toBeUndefined();
    expect(wrapper.vm.nextChapter?.start).toBe(60);

    await vi.advanceTimersByTimeAsync(31_000);
    await nextTick();
    expect(wrapper.vm.previousChapter?.start).toBe(0);
    expect(wrapper.vm.nextChapter).toBeUndefined();

    wrapper.unmount();
  });

  it("targets chapters while paused", async () => {
    seedPlayingChapterMedia(30);
    store.activePlayer!.playback_state = PlaybackState.PAUSED;
    store.activePlayerQueue!.state = PlaybackState.PAUSED;
    const wrapper = mount(Consumer);
    await nextTick();

    expect(wrapper.vm.chapterMode).toBe(true);
    expect(wrapper.vm.previousChapter).toBeUndefined();
    expect(wrapper.vm.nextChapter?.start).toBe(60);

    wrapper.unmount();
  });

  it.each([
    [MediaType.TRACK, "ordinary tracks"],
    [MediaType.AUDIOBOOK, "the preference is disabled"],
  ])("does not enter chapter mode for %s", async (mediaType, reason) => {
    seedPlayingChapterMedia(30, mediaType);
    if (reason === "the preference is disabled") {
      store.currentUser = {
        preferences: { audiobook_chapter_progress: false },
      };
    }
    const wrapper = mount(Consumer);
    await nextTick();

    expect(wrapper.vm.previousChapter).toBeUndefined();
    expect(wrapper.vm.nextChapter).toBeUndefined();
    wrapper.unmount();
  });
});
