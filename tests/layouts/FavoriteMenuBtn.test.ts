import FavoriteMenuBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/FavoriteMenuBtn.vue";
import api from "@/plugins/api";
import {
  MediaType,
  type PlayableMediaItemType,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { dropdownMenuStubs } from "../fixtures/dropdownMenu";
import { queueItem } from "../fixtures/queueItem";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { track } from "../fixtures/track";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => {
  const api = {
    addItemToFavorites: vi.fn(),
    removeItemFromFavorites: vi.fn(),
    setFavorite: vi.fn(),
    getLibraryItem: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    providers: {},
    players: {},
  };
  return { api, default: api };
});

vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));

// signed in as a member unless a test says otherwise
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../fixtures/scopes");
  return {
    authManager: { hasScope: vi.fn(scopeChecker(BUILTIN_ROLE_SCOPES.user)) },
  };
});

const addItemToFavorites = vi.mocked(api.addItemToFavorites);
const removeItemFromFavorites = vi.mocked(api.removeItemFromFavorites);
const setFavorite = vi.mocked(api.setFavorite);

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      curQueueItem: undefined,
    }),
  };
});

const mockStore = store as unknown as { curQueueItem?: QueueItem };

const TRIGGER = "button[type='button']";

// the favourite state is shared app-wide and only re-seeds when the playing
// item changes, so every fixture stands for a different one
let queueItemCount = 0;
async function setPlaying(mediaItem: PlayableMediaItemType) {
  mockStore.curQueueItem = queueItem({
    queue_item_id: `item-${++queueItemCount}`,
    media_item: mediaItem,
  });
  // the shared state re-seeds from a watcher, which vue flushes before render
  await nextTick();
}

// the stubs keep the entries reachable without reka-ui; the trigger's own
// attributes only show up with the real component
function mountButton() {
  return mount(FavoriteMenuBtn, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: dropdownMenuStubs,
    },
  });
}

function mountWithDropdown() {
  return mount(FavoriteMenuBtn, {
    // the class the player bar passes, which the open-state colour keys off
    attrs: { class: "player-control-button" },
    global: { mocks: { $t: (key: string) => key } },
  });
}

async function pickEntry(wrapper: VueWrapper, label: string) {
  const entry = wrapper
    .findAll(".dropdown-item")
    .find((candidate) => candidate.text() === label);
  if (!entry) throw new Error(`the menu offers no "${label}" entry`);
  await entry.trigger("click");
  await flushPromises();
}

enableAutoUnmount(afterEach);

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(authManager.hasScope).mockImplementation(
    scopeChecker(BUILTIN_ROLE_SCOPES.user),
  );
  await setPlaying(track());
});

describe("FavoriteMenuBtn", () => {
  // one slot, three looks: the trigger carries the state of the playing item
  it.each([
    { favorite: true, icon: "lucide-heart", fill: "currentColor" },
    { favorite: null, icon: "lucide-heart", fill: "none" },
    { favorite: false, icon: "lucide-thumbs-down", fill: "none" },
  ])(
    "shows $icon on the trigger for favorite $favorite",
    async ({ favorite, icon, fill }) => {
      await setPlaying(track({ favorite }));

      const trigger = mountButton().get(TRIGGER);

      expect(trigger.findAll("svg")).toHaveLength(1);
      expect(trigger.get("svg").classes()).toContain(icon);
      expect(trigger.get("svg").attributes("fill")).toBe(fill);
    },
  );

  it.each([
    { favorite: null, entries: ["favorites_add", "favorites_dislike"] },
    { favorite: true, entries: ["favorites_remove", "favorites_dislike"] },
    { favorite: false, entries: ["favorites_add", "favorites_dislike_remove"] },
  ])(
    "offers $entries for the playing item's favorite $favorite",
    async ({ favorite, entries }) => {
      await setPlaying(track({ favorite }));

      expect(
        mountButton()
          .findAll(".dropdown-item")
          .map((e) => e.text()),
      ).toEqual([...entries, "add_playlist"]);
    },
  );

  it("adds the playing item to the favourites", async () => {
    const item = track({ favorite: null });
    await setPlaying(item);

    await pickEntry(mountButton(), "favorites_add");

    expect(addItemToFavorites).toHaveBeenCalledWith(item);
    expect(removeItemFromFavorites).not.toHaveBeenCalled();
  });

  it("dislikes the playing item", async () => {
    const item = track({ favorite: null });
    await setPlaying(item);

    await pickEntry(mountButton(), "favorites_dislike");

    expect(setFavorite).toHaveBeenCalledWith(item, false);
  });

  it("clears the state of the playing item", async () => {
    await setPlaying(track({ favorite: false }));

    await pickEntry(mountButton(), "favorites_dislike_remove");

    expect(removeItemFromFavorites).toHaveBeenCalledWith(MediaType.TRACK, "1");
    expect(setFavorite).not.toHaveBeenCalled();
  });

  // the state is held apart from the queue item, which the server replaces
  // whole on every refresh
  it("keeps a state of its own when the queue item is re-sent", async () => {
    await setPlaying(track({ favorite: null }));
    const wrapper = mountButton();

    await pickEntry(wrapper, "favorites_add");
    mockStore.curQueueItem = queueItem({
      queue_item_id: mockStore.curQueueItem!.queue_item_id,
      media_item: track({ favorite: null }),
    });
    await nextTick();

    expect(wrapper.get(TRIGGER).get("svg").attributes("fill")).toBe(
      "currentColor",
    );
  });

  it("hands the playing item to the playlist dialog", async () => {
    const item = track();
    await setPlaying(item);

    await pickEntry(mountButton(), "add_playlist");

    expect(eventbus.emit).toHaveBeenCalledWith("playlistdialog", {
      items: [item],
    });
  });

  // a line-in or other live source is not a library item
  it("disables itself for an audio source", async () => {
    await setPlaying(track({ media_type: MediaType.AUDIO_SOURCE }));

    expect(mountButton().get(TRIGGER).attributes("disabled")).toBeDefined();
  });

  it("is not offered to a role that may not change the library", () => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );

    const wrapper = mountButton();

    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("favorites_add");
  });

  // the stubs cannot show the attribute surviving reka-ui's as-child merge onto
  // the same button the player control colour keys off
  it("suppresses hover color through the real menu too", async () => {
    const trigger = mountWithDropdown().get(TRIGGER);

    expect(trigger.attributes("data-suppress-hover")).toBe("false");
    expect(trigger.attributes("data-state")).toBe("closed");

    await trigger.trigger("pointerenter", { pointerType: "touch" });
    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();

    // the bar colours the open button off this, so it has to survive reka's
    // as-child merge onto the same button the call site's class lands on
    expect(trigger.attributes("data-state")).toBe("open");
    expect(trigger.classes()).toContain("player-control-button");

    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();

    expect(trigger.attributes("data-state")).toBe("closed");
    expect(trigger.attributes("data-suppress-hover")).toBe("true");
  });
});
