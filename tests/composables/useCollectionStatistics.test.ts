import { useCollectionStatistics } from "@/composables/useCollectionStatistics";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type Audiobook,
  type EventMessage,
  type MediaCollection,
  type MediaItemType,
  type PlaylogUpdate,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, reactive, type EffectScope } from "vue";

const { getAudiobookCollection, listeners } = vi.hoisted(() => ({
  getAudiobookCollection: vi.fn<MusicAssistantApi["getAudiobookCollection"]>(),
  listeners: [] as ((evt: EventMessage) => void)[],
}));
vi.mock("@/plugins/api", () => ({
  api: {
    getAudiobookCollection,
    subscribe: (_: EventType, callback: (evt: EventMessage) => void) => {
      listeners.push(callback);
      return () => listeners.splice(listeners.indexOf(callback), 1);
    },
  },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/store", () => ({
  store: { currentUser: { user_id: "me" } },
}));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

const BOOK_URI = "library://audiobook/1";

function collection(itemId: string): MediaCollection<Audiobook> {
  return reactive({
    media_type: MediaType.COLLECTION,
    item_id: itemId,
    items: [{ uri: BOOK_URI } as Audiobook],
    total_items: 2,
    duration: 100,
    fully_played: false,
    in_progress: false,
  }) as MediaCollection<Audiobook>;
}

function playlogUpdate(update: Partial<PlaylogUpdate>) {
  const data: PlaylogUpdate = {
    uri: BOOK_URI,
    media_type: MediaType.AUDIOBOOK,
    fully_played: false,
    seconds_played: 60,
    userid: "me",
    ...update,
  };
  for (const listener of listeners)
    listener({ event: EventType.PLAYLOG_UPDATED, data } as EventMessage);
}

let scope: EffectScope;

beforeEach(() => {
  // what the server computes once the last book is finished
  getAudiobookCollection.mockReset().mockResolvedValue({
    total_items: 2,
    duration: 100,
    fully_played: true,
    in_progress: false,
  } as MediaCollection<Audiobook>);
});

afterEach(() => {
  scope.stop();
  expect(listeners).toHaveLength(0);
});

describe("useCollectionStatistics", () => {
  it.each([
    // settled without the server, which would report the collection finished
    ["in progress", { seconds_played: 60 }, false, true],
    ["finished", { fully_played: true, seconds_played: 100 }, true, false],
  ])(
    "updates every collection holding a book played %s",
    async (_, update, fully_played, in_progress) => {
      const items: MediaItemType[] = [collection("a"), collection("b")];
      scope = effectScope();
      scope.run(() => useCollectionStatistics(() => items));

      playlogUpdate(update);
      await flushPromises();

      expect(items).toEqual([
        expect.objectContaining({ fully_played, in_progress }),
        expect.objectContaining({ fully_played, in_progress }),
      ]);
    },
  );

  it.each([
    ["another user's progress", { userid: "someone-else" }],
    ["a book outside the collection", { uri: "library://audiobook/2" }],
    ["a podcast episode", { media_type: MediaType.PODCAST_EPISODE }],
  ])("ignores %s", async (_, update) => {
    const items: MediaItemType[] = [collection("a")];
    scope = effectScope();
    scope.run(() => useCollectionStatistics(() => items));

    playlogUpdate(update);
    await flushPromises();

    expect("in_progress" in items[0] && items[0].in_progress).toBe(false);
  });
});
