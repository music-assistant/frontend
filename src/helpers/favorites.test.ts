import { EventType, type EventMessage } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { keepOwnFavorite, subscribeOwnFavorites } from "./favorites";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: { subscribe: vi.fn() },
  storeMock: { currentUser: undefined as { user_id: string } | undefined },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

describe("keepOwnFavorite", () => {
  it("keeps the favorite state of the item the caller holds", () => {
    const merged = keepOwnFavorite(
      { uri: "library://track/1", name: "new name", favorite: true },
      { uri: "library://track/1", name: "old name", favorite: false },
    );

    expect(merged).toEqual({
      uri: "library://track/1",
      name: "new name",
      favorite: false,
    });
  });

  it("does not touch the incoming item", () => {
    const incoming = { favorite: true };

    keepOwnFavorite(incoming, { favorite: null });

    expect(incoming.favorite).toBe(true);
  });

  it("returns the incoming item when either side has no favorite state", () => {
    const incoming = { favorite: true };

    expect(keepOwnFavorite(incoming, { uri: "library://track/1" })).toBe(
      incoming,
    );
    expect(keepOwnFavorite(incoming, undefined)).toBe(incoming);
    expect(keepOwnFavorite("library://track/1", { favorite: false })).toBe(
      "library://track/1",
    );
  });
});

describe("subscribeOwnFavorites", () => {
  const update = {
    uri: "library://track/1",
    item_id: "1",
    favorite: false,
    user_id: "me",
  };
  let emit: (evt: EventMessage) => void;
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.currentUser = { user_id: "me" };
    apiMock.subscribe.mockImplementation(
      (_event: EventType, callback: (evt: EventMessage) => void) => {
        emit = callback;
        return unsubscribe;
      },
    );
  });

  it("subscribes to the favorite event and returns its unsubscribe", () => {
    expect(subscribeOwnFavorites(vi.fn())).toBe(unsubscribe);
    expect(apiMock.subscribe).toHaveBeenCalledWith(
      EventType.FAVORITE_UPDATED,
      expect.any(Function),
    );
  });

  it("reports the signed-in user's own changes", () => {
    const onUpdate = vi.fn();
    subscribeOwnFavorites(onUpdate);

    emit({ event: EventType.FAVORITE_UPDATED, data: update });

    expect(onUpdate).toHaveBeenCalledWith(update);
  });

  it("ignores changes of another user, and events without data", () => {
    const onUpdate = vi.fn();
    subscribeOwnFavorites(onUpdate);

    emit({
      event: EventType.FAVORITE_UPDATED,
      data: { ...update, user_id: "somebody-else" },
    });
    emit({ event: EventType.FAVORITE_UPDATED });
    storeMock.currentUser = undefined;
    emit({ event: EventType.FAVORITE_UPDATED, data: update });

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
