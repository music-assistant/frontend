import FavoriteMenu from "@/components/FavoriteMenu.vue";
import {
  EventType,
  MediaType,
  type EventMessage,
  type MediaItem,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { artist } from "../fixtures/artist";
import { audioSource } from "../fixtures/audioSource";
import { dropdownMenuStubs } from "../fixtures/dropdownMenu";
import { withoutFavorite } from "../fixtures/mediaItem";
import { podcastEpisode } from "../fixtures/podcastEpisode";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { track } from "../fixtures/track";
import { user } from "../fixtures/user";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    addItemToFavorites: vi.fn(),
    removeItemFromFavorites: vi.fn(),
    setFavorite: vi.fn(),
    getLibraryItem: vi.fn(),
    subscribe: vi.fn(),
  },
  storeMock: { currentUser: undefined as { user_id: string } | undefined },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

const TRIGGER = "button[type='button']";

function mountMenu(item: MediaItem, props: Record<string, unknown> = {}) {
  return mount(FavoriteMenu, {
    props: { item, ...props },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: dropdownMenuStubs,
    },
  });
}

/** The handler the menu registered for the user's own favorite changes. */
function favoriteUpdateHandler() {
  const call = apiMock.subscribe.mock.calls.find(
    ([type]) => type === EventType.FAVORITE_UPDATED,
  );
  if (!call) throw new Error("the menu did not subscribe to favorite updates");
  return call[1] as (evt: EventMessage) => void;
}

function entryLabels(wrapper: VueWrapper): string[] {
  return wrapper.findAll(".dropdown-item").map((entry) => entry.text());
}

async function pickEntry(wrapper: VueWrapper, label: string) {
  const entry = wrapper
    .findAll(".dropdown-item")
    .find((candidate) => candidate.text() === label);
  if (!entry) throw new Error(`the menu offers no "${label}" entry`);
  await entry.trigger("click");
  await flushPromises();
}

describe("FavoriteMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    storeMock.currentUser = user();
    apiMock.subscribe.mockImplementation(() => vi.fn());
  });

  // one slot, three looks: the trigger carries the state, the menu the actions
  it.each([
    { favorite: true, icon: "lucide-heart", fill: "currentColor" },
    { favorite: null, icon: "lucide-heart", fill: "none" },
    { favorite: false, icon: "lucide-thumbs-down", fill: "none" },
  ])(
    "shows $icon on the trigger for favorite $favorite",
    ({ favorite, icon, fill }) => {
      const trigger = mountMenu(track({ favorite })).get(TRIGGER);

      // one slot, so the dislike replaces the heart rather than joining it
      expect(trigger.findAll("svg")).toHaveLength(1);
      expect(trigger.get("svg").classes()).toContain(icon);
      expect(trigger.get("svg").attributes("fill")).toBe(fill);
      expect(trigger.attributes("data-active")).toBe(
        favorite === true ? "true" : undefined,
      );
    },
  );

  // a listing leaves the key out of an item the user has no state on
  it("shows the outline heart for an item without the favorite key", () => {
    const trigger = mountMenu(withoutFavorite(track())).get(TRIGGER);

    expect(trigger.get("svg").classes()).toContain("lucide-heart");
    expect(trigger.get("svg").attributes("fill")).toBe("none");
  });

  it.each([
    { favorite: null, entries: ["favorites_add", "favorites_dislike"] },
    { favorite: true, entries: ["favorites_remove", "favorites_dislike"] },
    {
      favorite: false,
      entries: ["favorites_add", "favorites_dislike_remove"],
    },
  ])("offers $entries for favorite $favorite", ({ favorite, entries }) => {
    expect(entryLabels(mountMenu(track({ favorite })))).toEqual([
      ...entries,
      "add_playlist",
    ]);
  });

  it("likes an item that has no state", async () => {
    const item = track({ favorite: null });
    const wrapper = mountMenu(item);

    await pickEntry(wrapper, "favorites_add");

    expect(apiMock.addItemToFavorites).toHaveBeenCalledWith(item);
    // the state shows before the server confirms it
    expect(item.favorite).toBe(true);
    expect(wrapper.emitted("update:favorite")).toEqual([[true]]);
  });

  it("likes an item it was told to dislike before", async () => {
    const item = track({ favorite: false });

    await pickEntry(mountMenu(item), "favorites_add");

    expect(apiMock.addItemToFavorites).toHaveBeenCalledWith(item);
    expect(apiMock.removeItemFromFavorites).not.toHaveBeenCalled();
  });

  it("dislikes an item", async () => {
    const item = track({ favorite: null });
    const wrapper = mountMenu(item);

    await pickEntry(wrapper, "favorites_dislike");

    expect(apiMock.setFavorite).toHaveBeenCalledWith(item, false);
    expect(item.favorite).toBe(false);
    expect(wrapper.emitted("update:favorite")).toEqual([[false]]);
  });

  it.each([
    { favorite: true, entry: "favorites_remove" },
    { favorite: false, entry: "favorites_dislike_remove" },
  ])(
    "clears favorite $favorite through $entry",
    async ({ favorite, entry }) => {
      const item = track({ favorite });
      const wrapper = mountMenu(item);

      await pickEntry(wrapper, entry);

      expect(apiMock.removeItemFromFavorites).toHaveBeenCalledWith(
        MediaType.TRACK,
        "1",
      );
      expect(item.favorite).toBeNull();
      expect(wrapper.emitted("update:favorite")).toEqual([[null]]);
    },
  );

  // a row can hold the provider's copy of the item, whose id the library does
  // not know
  it("clears the state on the library item behind a provider item", async () => {
    const item = track({ provider: "spotify", item_id: "sp1", favorite: true });
    apiMock.getLibraryItem.mockResolvedValue(track({ item_id: "42" }));

    await pickEntry(mountMenu(item), "favorites_remove");

    expect(apiMock.getLibraryItem).toHaveBeenCalledWith(
      MediaType.TRACK,
      "sp1",
      "spotify",
    );
    expect(apiMock.removeItemFromFavorites).toHaveBeenCalledWith(
      MediaType.TRACK,
      "42",
    );
  });

  // the state is still on the server, so the heart must not claim otherwise
  it("keeps the state when the library cannot resolve the item", async () => {
    const item = track({ provider: "spotify", item_id: "sp1", favorite: true });
    apiMock.getLibraryItem.mockResolvedValue(null);
    const wrapper = mountMenu(item);

    await pickEntry(wrapper, "favorites_remove");

    expect(apiMock.removeItemFromFavorites).not.toHaveBeenCalled();
    expect(item.favorite).toBe(true);
    expect(wrapper.emitted("update:favorite")).toBeUndefined();
  });

  it("hands the item to the playlist dialog", async () => {
    const item = track();

    await pickEntry(mountMenu(item), "add_playlist");

    expect(eventbus.emit).toHaveBeenCalledWith("playlistdialog", {
      items: [item],
    });
  });

  // only some media types can be a playlist entry
  it("leaves the playlist entry out for an artist", () => {
    expect(entryLabels(mountMenu(artist({ favorite: null })))).toEqual([
      "favorites_add",
      "favorites_dislike",
    ]);
  });

  it("is not offered to a role that may not change the library", () => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );

    expect(mountMenu(track()).find(TRIGGER).exists()).toBe(false);
  });

  // the caller can hold the state apart from the item, as the player bar does
  it("shows and acts on the state it is given over the item's own", async () => {
    const item = track({ favorite: null });
    const wrapper = mountMenu(item, { favorite: true });

    expect(wrapper.get(TRIGGER).get("svg").attributes("fill")).toBe(
      "currentColor",
    );

    await pickEntry(wrapper, "favorites_remove");

    expect(apiMock.removeItemFromFavorites).toHaveBeenCalledWith(
      MediaType.TRACK,
      "1",
    );
  });

  // touch browsers keep hovering whatever was tapped last, so the tap that
  // opened the menu leaves the trigger reading as active once the menu is gone
  it("suppresses hover color after tapping the menu closed", async () => {
    const wrapper = mountMenu(track());
    const trigger = wrapper.get(TRIGGER);

    expect(trigger.attributes("data-suppress-hover")).toBe("false");

    await trigger.trigger("pointerenter", { pointerType: "touch" });
    await trigger.trigger("click");
    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("true");
    expect(trigger.attributes("data-suppress-hover")).toBe("false");

    await trigger.trigger("click");
    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("false");
    expect(trigger.attributes("data-suppress-hover")).toBe("true");

    await trigger.trigger("pointerenter", { pointerType: "touch" });
    expect(trigger.attributes("data-suppress-hover")).toBe("false");
  });

  // the mouse that clicked the menu shut is still on the button, and no second
  // pointerenter is coming to say so
  it("keeps the hover color when a mouse clicks the menu closed", async () => {
    const wrapper = mountMenu(track());
    const trigger = wrapper.get(TRIGGER);

    await trigger.trigger("pointerenter", { pointerType: "mouse" });
    await trigger.trigger("click");
    await trigger.trigger("click");

    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("false");
    expect(trigger.attributes("data-suppress-hover")).toBe("false");
  });

  // dismissing the menu anywhere but on the trigger would leave it reading as
  // active just the same
  it("suppresses it when the menu closes on its own", async () => {
    const wrapper = mountMenu(track());
    const trigger = wrapper.get(TRIGGER);

    await trigger.trigger("pointerenter", { pointerType: "touch" });
    await trigger.trigger("click");
    await wrapper.get(".dropdown-dismiss").trigger("click");

    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("false");
    expect(trigger.attributes("data-suppress-hover")).toBe("true");
  });

  it("disables the trigger without an item", () => {
    const wrapper = mount(FavoriteMenu, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: dropdownMenuStubs,
      },
    });

    expect(wrapper.get(TRIGGER).attributes("disabled")).toBeDefined();
  });

  // the icon alone carries no state to a screen reader
  it.each([
    { favorite: null, key: "favorites_menu" },
    { favorite: true, key: "favorites_menu_liked" },
    { favorite: false, key: "favorites_menu_disliked" },
  ])("labels the trigger $key for favorite $favorite", ({ favorite, key }) => {
    const trigger = mountMenu(track({ favorite })).get(TRIGGER);

    expect(trigger.attributes("aria-label")).toBe(key);
    expect(trigger.attributes("title")).toBe(key);
  });

  // the player bar hands over whatever is playing, including a type the
  // server keeps no favorite state for
  it("offers only 'add to playlist' for a podcast episode", () => {
    const wrapper = mountMenu(podcastEpisode());

    expect(entryLabels(wrapper)).toEqual(["add_playlist"]);
  });

  it("renders no trigger for an item that offers nothing at all", () => {
    expect(mountMenu(audioSource()).find(TRIGGER).exists()).toBe(false);
  });

  // a like or dislike made elsewhere (another tab, another row showing the
  // same item) still has to reach this one
  it("shows a favorite update made elsewhere on the item it renders", () => {
    const item = track({ favorite: null });
    mountMenu(item);

    favoriteUpdateHandler()({
      event: EventType.FAVORITE_UPDATED,
      data: {
        uri: item.uri,
        media_type: MediaType.TRACK,
        item_id: item.item_id,
        favorite: false,
        user_id: user().user_id,
      },
    } as EventMessage);

    expect(item.favorite).toBe(false);
  });

  it("ignores a favorite update for a different item", () => {
    const item = track({ item_id: "1", favorite: null });
    mountMenu(item);

    favoriteUpdateHandler()({
      event: EventType.FAVORITE_UPDATED,
      data: {
        uri: "library://track/2",
        media_type: MediaType.TRACK,
        item_id: "2",
        favorite: true,
        user_id: user().user_id,
      },
    } as EventMessage);

    expect(item.favorite).toBeNull();
  });

  it("unsubscribes from favorite updates on unmount", () => {
    const unsubscribe = vi.fn();
    apiMock.subscribe.mockReturnValue(unsubscribe);

    const wrapper = mountMenu(track());
    wrapper.unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});

// the real menu decides for itself when the trigger's click counts as an open
describe("FavoriteMenu inside a clickable row", () => {
  const Row = {
    components: { FavoriteMenu },
    props: { item: { type: Object, required: true } },
    emits: ["row-click"],
    template: `<div @click="$emit('row-click')">
      <FavoriteMenu :item="item" />
    </div>`,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
  });

  it("opens the menu without opening the row", async () => {
    const wrapper = mount(Row, {
      props: { item: track() },
      global: { mocks: { $t: (key: string) => key } },
    });
    const trigger = wrapper.get(TRIGGER);

    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();

    expect(trigger.attributes("data-state")).toBe("open");
    expect(wrapper.emitted("row-click")).toBeUndefined();
  });
});
