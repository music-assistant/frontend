import {
  EventType,
  MediaType,
  type Artist,
  type EventMessage,
} from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import { artist } from "../../tests/fixtures/artist";
import { providerMapping } from "../../tests/fixtures/providerMapping";
import { track } from "../../tests/fixtures/track";
import { useDetailItemUpdates } from "./useDetailItemUpdates";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: { subscribe: vi.fn() },
  storeMock: { currentUser: { user_id: "me" } },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

describe("useDetailItemUpdates", () => {
  const listeners = new Map<EventType, (evt: EventMessage) => void>();
  const unsubscribe = vi.fn();
  const emit = (event: EventType, data: unknown) =>
    listeners.get(event)!({ event, data } as EventMessage);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    listeners.clear();
    apiMock.subscribe.mockImplementation(
      (event: EventType, callback: (evt: EventMessage) => void) => {
        listeners.set(event, callback);
        return unsubscribe;
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(
    shown: Artist | undefined,
    options?: Parameters<typeof useDetailItemUpdates>[1],
  ) {
    const item = ref<Artist | undefined>(shown);
    const scope = effectScope();
    scope.run(() => useDetailItemUpdates(item, options));
    return { item, scope };
  }

  it("replaces the item with an update of the same uri, keeping its favorite", () => {
    const onUpdate = vi.fn();
    const { item } = setup(artist({ favorite: true }), { onUpdate });

    emit(
      EventType.MEDIA_ITEM_UPDATED,
      artist({ name: "Renamed", favorite: false }),
    );
    vi.runAllTimers();

    expect(item.value?.name).toBe("Renamed");
    expect(item.value?.favorite).toBe(true);
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it("ignores an update of another item", () => {
    const onUpdate = vi.fn();
    const { item } = setup(artist(), { onUpdate });

    emit(EventType.MEDIA_ITEM_UPDATED, artist({ item_id: "2", name: "Other" }));
    vi.runAllTimers();

    expect(item.value?.name).toBe("Artist");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("replaces the item with an update mapped to the provider item it was opened with", () => {
    const { item } = setup(undefined, {
      providerItem: {
        itemId: "item-1",
        provider: "test_provider",
        mediaType: MediaType.ARTIST,
      },
    });
    const added = artist({
      item_id: "7",
      provider_mappings: [providerMapping()],
    });

    emit(EventType.MEDIA_ITEM_UPDATED, added);
    vi.runAllTimers();

    expect(item.value?.uri).toBe(added.uri);
  });

  it("ignores a mapped update without a provider item to match", () => {
    const { item } = setup(artist());

    emit(
      EventType.MEDIA_ITEM_UPDATED,
      artist({ item_id: "7", provider_mappings: [providerMapping()] }),
    );
    vi.runAllTimers();

    expect(item.value?.item_id).toBe("1");
  });

  it("ignores a mapped update of another media type while the item loads", () => {
    const { item } = setup(undefined, {
      providerItem: {
        itemId: "item-1",
        provider: "test_provider",
        mediaType: MediaType.ARTIST,
      },
    });

    emit(
      EventType.MEDIA_ITEM_UPDATED,
      track({ provider_mappings: [providerMapping()] }),
    );
    vi.runAllTimers();

    expect(item.value).toBeUndefined();
  });

  it("does not let another media type replace a pending mapped update", () => {
    const { item } = setup(undefined, {
      providerItem: {
        itemId: "item-1",
        provider: "test_provider",
        mediaType: MediaType.ARTIST,
      },
    });
    const updated = artist({
      item_id: "7",
      provider_mappings: [providerMapping()],
    });

    emit(EventType.MEDIA_ITEM_UPDATED, updated);
    emit(
      EventType.MEDIA_ITEM_UPDATED,
      track({ provider_mappings: [providerMapping()] }),
    );
    vi.runAllTimers();

    expect(item.value?.uri).toBe(updated.uri);
  });

  it("rechecks the provider route before applying a pending mapped update", () => {
    const providerItem = {
      itemId: "item-1",
      provider: "test_provider",
      mediaType: MediaType.ARTIST,
    };
    const { item } = setup(undefined, { providerItem });

    emit(
      EventType.MEDIA_ITEM_UPDATED,
      artist({ provider_mappings: [providerMapping()] }),
    );
    providerItem.itemId = "another-item";
    vi.runAllTimers();

    expect(item.value).toBeUndefined();
  });

  it("applies only the last of a burst of updates, once they stop", () => {
    const onUpdate = vi.fn();
    const { item } = setup(artist(), { onUpdate });

    emit(EventType.MEDIA_ITEM_UPDATED, artist({ name: "First" }));
    vi.advanceTimersByTime(1500);
    emit(EventType.MEDIA_ITEM_UPDATED, artist({ name: "Second" }));
    vi.advanceTimersByTime(1500);
    emit(EventType.MEDIA_ITEM_UPDATED, artist({ name: "Last" }));
    vi.advanceTimersByTime(1999);

    expect(item.value?.name).toBe("Artist");
    expect(onUpdate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(item.value?.name).toBe("Last");
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it("drops a waiting update once the page shows another item", () => {
    const onUpdate = vi.fn();
    const { item } = setup(artist(), { onUpdate });

    emit(EventType.MEDIA_ITEM_UPDATED, artist({ name: "Renamed" }));
    item.value = artist({ item_id: "2", name: "Other" });
    vi.runAllTimers();

    expect(item.value?.name).toBe("Other");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("keeps a favorite made while an update waits", () => {
    const { item } = setup(artist({ favorite: false }));

    emit(EventType.MEDIA_ITEM_UPDATED, artist({ name: "Renamed" }));
    emit(EventType.FAVORITE_UPDATED, {
      uri: item.value!.uri,
      media_type: MediaType.ARTIST,
      item_id: "1",
      favorite: true,
      user_id: "me",
    });
    vi.runAllTimers();

    expect(item.value?.name).toBe("Renamed");
    expect(item.value?.favorite).toBe(true);
  });

  it("applies the signed-in user's own favorite to the item", () => {
    const { item } = setup(artist());

    emit(EventType.FAVORITE_UPDATED, {
      uri: item.value!.uri,
      media_type: MediaType.ARTIST,
      item_id: "1",
      favorite: false,
      user_id: "me",
    });

    expect(item.value?.favorite).toBe(false);
  });

  it("unsubscribes from both events when its scope ends", () => {
    const { scope } = setup(artist());

    scope.stop();

    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it("reports own favorite events even when neutral stays neutral", () => {
    const onFavoriteUpdate = vi.fn();
    const { item } = setup(artist({ favorite: null }), { onFavoriteUpdate });

    emit(EventType.FAVORITE_UPDATED, {
      uri: item.value!.uri,
      media_type: MediaType.ARTIST,
      item_id: "1",
      favorite: null,
      user_id: "me",
    });

    expect(onFavoriteUpdate).toHaveBeenCalledOnce();
    expect(item.value?.favorite).toBeNull();
  });

  it("does not report favorites for another item or another user", () => {
    const onFavoriteUpdate = vi.fn();
    setup(artist(), { onFavoriteUpdate });
    emit(EventType.FAVORITE_UPDATED, {
      uri: artist({ item_id: "2" }).uri,
      favorite: true,
      user_id: "me",
    });
    emit(EventType.FAVORITE_UPDATED, {
      uri: artist().uri,
      favorite: true,
      user_id: "someone-else",
    });

    expect(onFavoriteUpdate).not.toHaveBeenCalled();
  });

  it("drops a waiting update when its scope ends", () => {
    const onUpdate = vi.fn();
    const { item, scope } = setup(artist(), { onUpdate });

    emit(EventType.MEDIA_ITEM_UPDATED, artist({ name: "Renamed" }));
    scope.stop();
    vi.runAllTimers();

    expect(item.value?.name).toBe("Artist");
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
