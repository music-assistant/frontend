import { useCollectionMetadata } from "@/composables/useCollectionMetadata";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type Audiobook,
  type EventMessage,
  type MediaCollection,
  type PlaylogUpdate,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, reactive, type EffectScope } from "vue";

interface Listener {
  events: EventType[];
  callback: (evt: EventMessage) => void;
}

const { getAudiobookCollection, listeners } = vi.hoisted(() => ({
  getAudiobookCollection: vi.fn<MusicAssistantApi["getAudiobookCollection"]>(),
  listeners: [] as Listener[],
}));
vi.mock("@/plugins/api", () => ({
  api: {
    getAudiobookCollection,
    subscribe_multi: (
      events: EventType[],
      callback: (evt: EventMessage) => void,
    ) => {
      const listener = { events, callback };
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
  },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/store", () => ({
  store: { currentUser: { user_id: "me" } },
}));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

const BOOK_URI = "library://audiobook/1";

// as listed on an author page: two of the author's books, unplayed
function collection(itemId: string): MediaCollection<Audiobook> {
  return reactive({
    media_type: MediaType.COLLECTION,
    item_id: itemId,
    items: [{ uri: BOOK_URI } as Audiobook],
    metadata: { total_items: 2, fully_played: false, in_progress: false },
  }) as MediaCollection<Audiobook>;
}

function played(event: EventType, update: Partial<PlaylogUpdate>) {
  const data: PlaylogUpdate = {
    uri: BOOK_URI,
    media_type: MediaType.AUDIOBOOK,
    fully_played: false,
    seconds_played: 60,
    userid: "me",
    ...update,
  };
  for (const listener of listeners)
    if (listener.events.includes(event))
      listener.callback({ event, data } as EventMessage);
}

let scope: EffectScope;

beforeEach(() => {
  // the whole series once the last book is finished, across all authors
  getAudiobookCollection.mockReset().mockResolvedValue({
    metadata: { total_items: 5, fully_played: true, in_progress: false },
  } as MediaCollection<Audiobook>);
});

afterEach(() => {
  scope.stop();
  expect(listeners).toHaveLength(0);
});

describe("useCollectionMetadata", () => {
  const FINISHED = { fully_played: true, seconds_played: 100 };

  it.each([
    // settled without the server, which would report the collection finished
    ["during playback", EventType.MEDIA_ITEM_PLAYED, {}, false, true],
    ["once stored", EventType.PLAYLOG_UPDATED, {}, false, true],
    ["finished", EventType.PLAYLOG_UPDATED, FINISHED, true, false],
    // a finished book waits for the stored playlog
    [
      "finished, not yet stored",
      EventType.MEDIA_ITEM_PLAYED,
      FINISHED,
      false,
      false,
    ],
  ])(
    "updates every collection holding a book played %s",
    async (_, event, update, fully_played, in_progress) => {
      const items = [collection("a"), collection("b")];
      scope = effectScope();
      scope.run(() => useCollectionMetadata(() => items));

      played(event, update);
      await flushPromises();

      // the count keeps the listing's scope
      const expected = { total_items: 2, fully_played, in_progress };
      expect(items.map((item) => item.metadata)).toEqual([
        expect.objectContaining(expected),
        expect.objectContaining(expected),
      ]);
    },
  );

  it.each([
    ["another user's progress", { userid: "someone-else" }],
    ["a book outside the collection", { uri: "library://audiobook/2" }],
    ["a podcast episode", { media_type: MediaType.PODCAST_EPISODE }],
  ])("ignores %s", async (_, update) => {
    const items = [collection("a")];
    scope = effectScope();
    scope.run(() => useCollectionMetadata(() => items));

    played(EventType.MEDIA_ITEM_PLAYED, update);
    played(EventType.PLAYLOG_UPDATED, update);
    await flushPromises();

    expect(items[0].metadata.in_progress).toBe(false);
  });
});
