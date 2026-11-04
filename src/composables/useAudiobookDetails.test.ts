import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type Audiobook,
  type EventMessage,
  type PlaylogUpdate,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, reactive, type EffectScope } from "vue";
import { audiobook } from "../../tests/fixtures/audiobook";
import { useAudiobookDetails } from "./useAudiobookDetails";

const { getAudiobook, subscribe, storeMock } = vi.hoisted(() => ({
  getAudiobook: vi.fn<MusicAssistantApi["getAudiobook"]>(),
  subscribe:
    vi.fn<
      (event: EventType, callback: (event: EventMessage) => void) => () => void
    >(),
  storeMock: { currentUser: { user_id: "me" } },
}));
vi.mock("@/plugins/api", () => ({ api: { getAudiobook, subscribe } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

const listeners = new Map<EventType, (event: EventMessage) => void>();
const unsubs: ReturnType<typeof vi.fn>[] = [];
const scopes: EffectScope[] = [];

function setup() {
  const route = reactive({ itemId: "1", provider: "library" });
  const scope = effectScope();
  scopes.push(scope);
  const { itemDetails } = scope.run(() => useAudiobookDetails(() => route))!;
  return { route, scope, itemDetails };
}

function playlog(overrides: Partial<PlaylogUpdate> = {}) {
  listeners.get(EventType.PLAYLOG_UPDATED)!({
    data: {
      uri: "library://audiobook/1",
      media_type: MediaType.AUDIOBOOK,
      fully_played: false,
      seconds_played: 900,
      userid: "me",
      ...overrides,
    },
  } as EventMessage);
}

function deferred() {
  let resolve!: (value: Audiobook) => void;
  const promise = new Promise<Audiobook>((res) => (resolve = res));
  return { promise, resolve };
}

describe("useAudiobookDetails", () => {
  beforeEach(() => {
    getAudiobook.mockReset().mockResolvedValue(audiobook());
    listeners.clear();
    unsubs.length = 0;
    subscribe.mockReset().mockImplementation((event, callback) => {
      listeners.set(event, callback);
      const unsub = vi.fn();
      unsubs.push(unsub);
      return unsub;
    });
  });
  afterEach(() => {
    for (const scope of scopes.splice(0)) scope.stop();
    vi.useRealTimers();
  });

  it("loads and clears the previous book when only the provider changes", async () => {
    const { route, itemDetails } = setup();
    await flushPromises();
    expect(itemDetails.value?.uri).toBe("library://audiobook/1");
    const pending = deferred();
    getAudiobook.mockReturnValueOnce(pending.promise);
    route.provider = "other";
    await flushPromises();
    expect(itemDetails.value).toBeUndefined();
    expect(getAudiobook).toHaveBeenLastCalledWith("1", "other");
    pending.resolve(audiobook({ provider: "other" }));
    await flushPromises();
    expect(itemDetails.value?.provider).toBe("other");
  });

  it("rejects an old response after navigating away and back", async () => {
    const pending = deferred();
    getAudiobook.mockReturnValueOnce(pending.promise);
    const { route, itemDetails } = setup();
    route.itemId = "2";
    await flushPromises();
    route.itemId = "1";
    await flushPromises();
    pending.resolve(audiobook({ name: "Stale" }));
    await flushPromises();
    expect(itemDetails.value?.name).toBe("Audiobook");
  });

  it("keeps a playlog update received before the load completes", async () => {
    const pending = deferred();
    getAudiobook.mockReturnValueOnce(pending.promise);
    const { itemDetails } = setup();
    playlog({ fully_played: true });
    pending.resolve(audiobook());
    await flushPromises();
    expect(itemDetails.value).toMatchObject({
      fully_played: true,
      resume_position_ms: 900000,
    });
  });

  it("ignores other users, media types and items, but accepts shared updates", async () => {
    const { itemDetails } = setup();
    await flushPromises();
    playlog({ userid: "other" });
    playlog({ media_type: MediaType.TRACK });
    playlog({ uri: "library://audiobook/2" });
    expect(itemDetails.value?.resume_position_ms).toBe(0);
    playlog({ userid: null });
    expect(itemDetails.value?.resume_position_ms).toBe(900000);
  });

  it.each([false, true])(
    "preserves personal progress across metadata events (updated: %s)",
    async (updated) => {
      getAudiobook.mockResolvedValue(audiobook({ resume_position_ms: 600000 }));
      const { itemDetails } = setup();
      await flushPromises();
      vi.useFakeTimers();
      if (updated) playlog();
      listeners.get(EventType.MEDIA_ITEM_UPDATED)!({
        data: audiobook({ name: "New metadata", fully_played: true }),
      } as EventMessage);
      await vi.advanceTimersByTimeAsync(2000);
      expect(itemDetails.value).toMatchObject({
        name: "New metadata",
        fully_played: false,
        resume_position_ms: updated ? 900000 : 600000,
      });
    },
  );

  it("retains shared personal favorite handling", async () => {
    const { itemDetails } = setup();
    await flushPromises();
    for (const favorite of [true, false, null]) {
      listeners.get(EventType.FAVORITE_UPDATED)!({
        data: { uri: itemDetails.value?.uri, user_id: "me", favorite },
      } as EventMessage);
      expect(itemDetails.value?.favorite).toBe(favorite);
    }
  });

  it("unsubscribes and ignores in-flight responses when disposed", async () => {
    const pending = deferred();
    getAudiobook.mockReturnValueOnce(pending.promise);
    const { scope, itemDetails } = setup();
    scope.stop();
    for (const unsub of unsubs) expect(unsub).toHaveBeenCalledOnce();
    pending.resolve(audiobook());
    await flushPromises();
    expect(itemDetails.value).toBeUndefined();
  });
});
