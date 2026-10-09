import {
  EventType,
  MediaType,
  type Artist,
  type EventMessage,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import { artist } from "../../tests/fixtures/artist";
import { providerMapping } from "../../tests/fixtures/providerMapping";
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
    vi.clearAllMocks();
    listeners.clear();
    apiMock.subscribe.mockImplementation(
      (event: EventType, callback: (evt: EventMessage) => void) => {
        listeners.set(event, callback);
        return unsubscribe;
      },
    );
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

    expect(item.value?.name).toBe("Renamed");
    expect(item.value?.favorite).toBe(true);
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it("ignores an update of another item", () => {
    const onUpdate = vi.fn();
    const { item } = setup(artist(), { onUpdate });

    emit(EventType.MEDIA_ITEM_UPDATED, artist({ item_id: "2", name: "Other" }));

    expect(item.value?.name).toBe("Artist");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("replaces the item with an update mapped to the provider item it was opened with", () => {
    const { item } = setup(undefined, {
      providerItem: { itemId: "item-1", provider: "test_provider" },
    });
    const added = artist({
      item_id: "7",
      provider_mappings: [providerMapping()],
    });

    emit(EventType.MEDIA_ITEM_UPDATED, added);

    expect(item.value?.uri).toBe(added.uri);
  });

  it("ignores a mapped update without a provider item to match", () => {
    const { item } = setup(artist());

    emit(
      EventType.MEDIA_ITEM_UPDATED,
      artist({ item_id: "7", provider_mappings: [providerMapping()] }),
    );

    expect(item.value?.item_id).toBe("1");
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
});
