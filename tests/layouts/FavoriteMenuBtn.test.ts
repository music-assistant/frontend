import FavoriteMenuBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/FavoriteMenuBtn.vue";
import api from "@/plugins/api";
import {
  MediaType,
  type PlayableMediaItemType,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { queueItem } from "../fixtures/queueItem";
import { track } from "../fixtures/track";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import {
  h,
  inject,
  provide,
  ref,
  type InjectionKey,
  type SetupContext,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => {
  const api = {
    addItemToFavorites: vi.fn(),
    removeItemFromFavorites: vi.fn(),
    getLibraryItem: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    providers: {},
    players: {},
  };
  return { api, default: api };
});

vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));

const addItemToFavorites = vi.mocked(api.addItemToFavorites);
const removeItemFromFavorites = vi.mocked(api.removeItemFromFavorites);
const getLibraryItem = vi.mocked(api.getLibraryItem);

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

function queueItemFor(mediaItem: PlayableMediaItemType) {
  return queueItem({ media_item: mediaItem });
}

// reka-ui owns the open state, so the stub owns it too and reports every change
// the way the real menu does. Its dismiss button stands in for everything that
// closes the menu without touching the trigger: an outside tap, escape, or
// picking an entry.
const dropdownToggleKey: InjectionKey<() => void> = Symbol();
const DropdownMenuStub = {
  emits: ["update:open"],
  setup(_: unknown, { emit, slots }: SetupContext<["update:open"]>) {
    const open = ref(false);
    const setOpen = (value: boolean) => {
      open.value = value;
      emit("update:open", value);
    };
    provide(dropdownToggleKey, () => setOpen(!open.value));
    return () =>
      h("div", { class: "dropdown", "data-open": String(open.value) }, [
        h("button", {
          class: "dropdown-dismiss",
          onClick: () => setOpen(false),
        }),
        slots.default?.(),
      ]);
  },
};
const DropdownMenuTriggerStub = {
  setup(_: unknown, { slots }: SetupContext) {
    const toggle = inject(dropdownToggleKey);
    if (!toggle)
      throw new Error("DropdownMenuTrigger must be inside DropdownMenu");
    return () => h("div", { onClick: toggle }, slots.default?.());
  },
};

// reka only renders its content while the menu holds it open, which its own
// context decides - these keep the entries reachable without it
const DropdownMenuContentStub = {
  setup(_: unknown, { slots }: SetupContext) {
    return () => h("div", { class: "dropdown-content" }, slots.default?.());
  },
};
const DropdownMenuItemStub = {
  setup(_: unknown, { attrs, slots }: SetupContext) {
    return () =>
      h("button", { ...attrs, class: "dropdown-item" }, slots.default?.());
  },
};

function mountButton() {
  return mount(FavoriteMenuBtn, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        DropdownMenu: DropdownMenuStub,
        DropdownMenuTrigger: DropdownMenuTriggerStub,
        DropdownMenuContent: DropdownMenuContentStub,
        DropdownMenuItem: DropdownMenuItemStub,
      },
    },
  });
}

// the stubs above keep the interaction tests independent of reka-ui; the
// trigger's own attributes only show up with the real component
function mountWithDropdown() {
  return mount(FavoriteMenuBtn, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.curQueueItem = queueItemFor(track());
});

describe("FavoriteMenuBtn", () => {
  // the menu is the whole point of the button: adding to a playlist has to be
  // there whichever way the favourite entry reads
  it.each([
    { favorite: false, entry: "favorites_add" },
    { favorite: true, entry: "favorites_remove" },
  ])("offers both entries for favorite $favorite", ({ favorite, entry }) => {
    mockStore.curQueueItem = queueItemFor(track({ favorite }));

    const text = mountButton().text();

    expect(text).toContain(entry);
    expect(text).toContain("add_playlist");
  });

  it("adds the playing item to the favourites", async () => {
    const item = track();
    mockStore.curQueueItem = queueItemFor(item);
    const wrapper = mountButton();

    await wrapper.get(".dropdown-item").trigger("click");

    expect(addItemToFavorites).toHaveBeenCalledWith(item);
    expect(removeItemFromFavorites).not.toHaveBeenCalled();
  });

  // the queue can hold the provider's copy of the item, whose id the library
  // does not know
  it("removes the library item behind a provider item", async () => {
    mockStore.curQueueItem = queueItemFor(
      track({ provider: "spotify", item_id: "sp1", favorite: true }),
    );
    getLibraryItem.mockResolvedValue(track({ item_id: "42", favorite: true }));
    const wrapper = mountButton();

    await wrapper.get(".dropdown-item").trigger("click");
    await flushPromises();

    expect(getLibraryItem).toHaveBeenCalledWith(
      MediaType.TRACK,
      "sp1",
      "spotify",
    );
    expect(removeItemFromFavorites).toHaveBeenCalledWith(MediaType.TRACK, "42");
  });

  it("hands the playing item to the playlist dialog", async () => {
    const item = track();
    mockStore.curQueueItem = queueItemFor(item);
    const wrapper = mountButton();

    await wrapper.findAll(".dropdown-item")[1].trigger("click");

    expect(eventbus.emit).toHaveBeenCalledWith("playlistdialog", {
      items: [item],
    });
  });

  // a line-in or other live source is not a library item
  it("disables itself for an audio source", () => {
    mockStore.curQueueItem = queueItemFor(
      track({ media_type: MediaType.AUDIO_SOURCE }),
    );

    expect(
      mountButton().get("button[aria-label]").attributes("disabled"),
    ).toBeDefined();
  });

  it("suppresses hover color after tapping the menu closed", async () => {
    const wrapper = mountButton();
    const trigger = wrapper.get("button[aria-label]");

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
    const wrapper = mountButton();
    const trigger = wrapper.get("button[aria-label]");

    await trigger.trigger("pointerenter", { pointerType: "mouse" });
    await trigger.trigger("click");
    await trigger.trigger("click");

    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("false");
    expect(trigger.attributes("data-suppress-hover")).toBe("false");
  });

  // touch leaves the button hovered from the tap that opened the menu, so
  // dismissing it anywhere but on the button would leave it reading as active
  it("suppresses it just the same when the menu closes on its own", async () => {
    const wrapper = mountButton();
    const trigger = wrapper.get("button[aria-label]");

    await trigger.trigger("pointerenter", { pointerType: "touch" });
    await trigger.trigger("click");
    await wrapper.get(".dropdown-dismiss").trigger("click");

    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("false");
    expect(trigger.attributes("data-suppress-hover")).toBe("true");
  });

  // the stubs cannot show the attribute surviving reka-ui's as-child merge onto
  // the same button the player control colour keys off
  it("suppresses hover color through the real menu too", async () => {
    const trigger = mountWithDropdown().get("button[aria-label]");

    expect(trigger.attributes("data-suppress-hover")).toBe("false");

    await trigger.trigger("pointerenter", { pointerType: "touch" });
    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();
    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();

    expect(trigger.attributes("data-state")).toBe("closed");
    expect(trigger.attributes("data-suppress-hover")).toBe("true");
  });
});
