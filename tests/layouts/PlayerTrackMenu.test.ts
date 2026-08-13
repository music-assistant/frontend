import PlayerTrackMenu from "@/layouts/default/PlayerOSD/PlayerControlBtn/PlayerTrackMenu.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import {
  h,
  inject,
  provide,
  ref,
  type InjectionKey,
  type SetupContext,
} from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => {
  const api = { toggleFavorite: vi.fn(), providers: {}, players: {} };
  return { api, default: api };
});

vi.mock("@/plugins/router", () => ({ default: { push: vi.fn() } }));

vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      curQueueItem: undefined,
    }),
  };
});

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

function mountMenu() {
  return mount(PlayerTrackMenu, {
    props: { forceVisible: true, showQueue: true },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        DropdownMenu: DropdownMenuStub,
        DropdownMenuTrigger: DropdownMenuTriggerStub,
        DropdownMenuContent: true,
        Dialog: true,
        Teleport: true,
      },
    },
  });
}

// the stubs above keep the interaction tests independent of reka-ui; the
// trigger's own attributes only show up with the real component
function mountWithDropdown() {
  return mount(PlayerTrackMenu, {
    props: { forceVisible: true, showQueue: true },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { Dialog: true, Teleport: true },
    },
  });
}

enableAutoUnmount(afterEach);

describe("PlayerTrackMenu", () => {
  it("suppresses hover color after tapping the menu closed", async () => {
    const wrapper = mountMenu();
    const trigger = wrapper.get("button.player-control-button");

    expect(trigger.attributes("data-suppress-hover")).toBe("false");

    await wrapper.get("button.player-control-button").trigger("click");
    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("true");
    expect(trigger.attributes("data-suppress-hover")).toBe("false");

    await wrapper.get("button.player-control-button").trigger("click");
    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("false");
    expect(trigger.attributes("data-suppress-hover")).toBe("true");

    await trigger.trigger("pointerenter");
    expect(trigger.attributes("data-suppress-hover")).toBe("false");
  });

  // touch leaves the button hovered from the tap that opened the menu, so
  // dismissing it anywhere but on the button would leave it reading as active
  it("suppresses it just the same when the menu closes on its own", async () => {
    const wrapper = mountMenu();
    const trigger = wrapper.get("button.player-control-button");

    await trigger.trigger("click");
    await wrapper.get(".dropdown-dismiss").trigger("click");

    expect(wrapper.get(".dropdown").attributes("data-open")).toBe("false");
    expect(trigger.attributes("data-suppress-hover")).toBe("true");
  });

  it("leaves the open highlight to the menu's own state", async () => {
    const trigger = mountWithDropdown().get("button.player-control-button");

    // reka-ui marks the trigger data-state, which is what the player control
    // colour keys off while the menu is open; a second copy would drift from it
    expect(trigger.attributes("data-state")).toBe("closed");
    expect(trigger.attributes("data-active")).toBeUndefined();

    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();

    expect(trigger.attributes("data-state")).toBe("open");
  });

  // the stubs cannot show the attribute surviving reka-ui's as-child merge onto
  // the same button the player control colour keys off
  it("suppresses hover color through the real menu too", async () => {
    const trigger = mountWithDropdown().get("button.player-control-button");

    expect(trigger.attributes("data-suppress-hover")).toBe("false");

    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();
    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();

    expect(trigger.attributes("data-state")).toBe("closed");
    expect(trigger.attributes("data-suppress-hover")).toBe("true");
  });
});
