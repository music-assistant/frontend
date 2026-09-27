import {
  EventType,
  MediaType,
  type EventMessage,
  type ItemMapping,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { artist } from "../../tests/fixtures/artist";
import { withoutFavorite } from "../../tests/fixtures/mediaItem";
import { track } from "../../tests/fixtures/track";
import {
  canHoldFavorite,
  favoriteActionKey,
  favoriteState,
  keepOwnFavorite,
  setFavoriteState,
  subscribeOwnFavorites,
} from "./favorites";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: { subscribe: vi.fn() },
  storeMock: { currentUser: undefined as { user_id: string } | undefined },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

// the lightweight reference a row card holds: no provider mappings, so no
// favorite state of its own
const itemMapping: ItemMapping = {
  item_id: "1",
  provider: "spotify--1",
  name: "Track",
  version: "",
  uri: "spotify--1://track/1",
  external_ids: [],
  is_playable: true,
  media_type: MediaType.TRACK,
  available: true,
};

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

  it("returns the incoming item when there is no state to keep", () => {
    const incoming = { favorite: true };

    expect(keepOwnFavorite(incoming, undefined)).toBe(incoming);
    expect(keepOwnFavorite("library://track/1", { favorite: false })).toBe(
      "library://track/1",
    );
  });

  // a listing leaves the key out when the user has no state on the item, so the
  // state of whoever triggered the event must not stick to the caller's copy
  it("clears the state when the item the caller holds carries none", () => {
    expect(
      keepOwnFavorite({ favorite: true }, { uri: "library://track/1" }),
    ).toEqual({ favorite: null });
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

describe("favoriteActionKey", () => {
  // one slot, one tap: the label has to say what that tap does
  it("names the action a tap performs on every state", () => {
    expect(favoriteActionKey(true)).toBe("favorites_remove");
    expect(favoriteActionKey(false)).toBe("favorites_dislike_remove");
    expect(favoriteActionKey(null)).toBe("favorites_add");
    expect(favoriteActionKey(undefined)).toBe("favorites_add");
  });
});

describe("favoriteState", () => {
  // a summary item from a listing carries no key at all without a state
  it("reads a missing key as no state", () => {
    expect(favoriteState(withoutFavorite(track()))).toBeNull();
    expect(favoriteState(track({ favorite: null }))).toBeNull();
    expect(favoriteState(track({ favorite: true }))).toBe(true);
    expect(favoriteState(track({ favorite: false }))).toBe(false);
    expect(favoriteState(undefined)).toBeNull();
  });
});

describe("canHoldFavorite", () => {
  it("tells a media item apart from an item mapping", () => {
    expect(canHoldFavorite(withoutFavorite(track()))).toBe(true);
    expect(canHoldFavorite(artist({ favorite: true }))).toBe(true);
    expect(canHoldFavorite(itemMapping)).toBe(false);
  });
});

describe("setFavoriteState", () => {
  it("shows the state on an item that holds one", () => {
    const item = withoutFavorite(track());

    setFavoriteState(item, false);

    expect(item.favorite).toBe(false);
  });

  it("leaves an item that holds none alone", () => {
    setFavoriteState(itemMapping, true);
    setFavoriteState(undefined, true);

    expect("favorite" in itemMapping).toBe(false);
  });
});
