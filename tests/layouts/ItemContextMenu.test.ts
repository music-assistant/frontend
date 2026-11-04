import ItemContextMenu from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { flushPromises, mount } from "@vue/test-utils";
import { markRaw, nextTick, reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { eventHandlers, storeMock } = vi.hoisted(() => ({
  eventHandlers: new Map<string, (event: ContextMenuDialogEvent) => void>(),
  storeMock: {
    activePlayer: undefined,
    activePlayerId: undefined,
    dialogActive: false,
    showPlayersMenu: true,
  },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    off: vi.fn((event: string) => eventHandlers.delete(event)),
    on: vi.fn(
      (event: string, handler: (payload: ContextMenuDialogEvent) => void) => {
        eventHandlers.set(event, handler);
      },
    ),
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => false },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    players: {},
  },
}));

vi.mock("@/helpers/icon", () => ({
  getLucideIcon: () => undefined,
  PLAYER_ICON_FALLBACK: "speaker",
}));

vi.mock("@/helpers/players", () => ({
  playerVisible: () => true,
}));

const passthroughStub = { template: "<div><slot /></div>" };

function mountContextMenu() {
  return mount(ItemContextMenu, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        DropdownMenu: {
          name: "DropdownMenu",
          props: ["open"],
          template: "<div><slot /></div>",
        },
        DropdownMenuContent: passthroughStub,
        DropdownMenuItem: {
          props: ["disabled"],
          template: `<button :disabled="disabled" @click="$emit('select', $event)"><slot /></button>`,
        },
        DropdownMenuSeparator: passthroughStub,
        DropdownMenuSub: passthroughStub,
        DropdownMenuSubContent: passthroughStub,
        DropdownMenuSubTrigger: passthroughStub,
        PlayerIcon: passthroughStub,
      },
    },
  });
}

describe("ItemContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers.clear();
    storeMock.dialogActive = false;
    storeMock.showPlayersMenu = true;
  });

  function pendingShare() {
    let finish!: () => void;
    const item = reactive({
      label: "provider_links.share",
      disabled: true,
      prepare: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = () => {
              item.disabled = false;
              resolve();
            };
          }),
      ),
    });
    return { item, finish: () => finish() };
  }

  it("opens immediately with Share disabled while other actions remain usable", async () => {
    const wrapper = mountContextMenu();
    const share = pendingShare();
    const action = vi.fn();
    eventHandlers.get("contextmenu")?.({
      items: [share.item, { label: "play_now", action }],
    });
    await nextTick();
    await nextTick();
    expect(share.item.prepare).toHaveBeenCalledOnce();
    expect(wrapper.getComponent({ name: "DropdownMenu" }).props("open")).toBe(
      true,
    );
    const buttons = wrapper.findAll("button");
    expect(buttons[0].element.disabled).toBe(true);
    expect(buttons[1].element.disabled).toBe(false);
    await buttons[1].trigger("click");
    expect(action).toHaveBeenCalledOnce();
    share.finish();
    await flushPromises();
    expect(buttons[0].element.disabled).toBe(false);
    wrapper.unmount();
  });

  it.each([false, true])(
    "keeps the latest menu ownership after out-of-order preparation (dismissed: %s)",
    async (dismiss) => {
      const wrapper = mountContextMenu();
      const first = pendingShare();
      const second = pendingShare();
      const firstAction = vi.fn();
      const secondAction = vi.fn();
      eventHandlers.get("contextmenu")?.({
        items: [first.item, { label: "rename", action: firstAction }],
      });
      await nextTick();
      eventHandlers.get("contextmenu")?.({
        items: [second.item, { label: "play_now", action: secondAction }],
      });
      await nextTick();
      await nextTick();
      second.finish();
      await flushPromises();
      const menu = wrapper.getComponent({ name: "DropdownMenu" });
      expect(menu.props("open")).toBe(true);
      if (dismiss) {
        menu.vm.$emit("update:open", false);
        await nextTick();
      }
      first.finish();
      await flushPromises();
      expect(menu.props("open")).toBe(!dismiss);
      expect(storeMock.dialogActive).toBe(!dismiss);
      expect(wrapper.text()).toContain("Play Now");
      expect(wrapper.text()).not.toContain("Rename");
      if (!dismiss) {
        await wrapper.findAll("button")[1].trigger("click");
        expect(secondAction).toHaveBeenCalledOnce();
        expect(firstAction).not.toHaveBeenCalled();
      }
      wrapper.unmount();
    },
  );

  it("stays dismissed when its pending preparation completes", async () => {
    const wrapper = mountContextMenu();
    const share = pendingShare();
    eventHandlers.get("contextmenu")?.({ items: [share.item] });
    await nextTick();
    await nextTick();
    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    await nextTick();
    share.finish();
    await flushPromises();
    expect(wrapper.getComponent({ name: "DropdownMenu" }).props("open")).toBe(
      false,
    );
    expect(storeMock.dialogActive).toBe(false);
    wrapper.unmount();
  });

  it("closes on an outside pointer without closing PlayerSelect in the same event", async () => {
    const wrapper = mountContextMenu();
    eventHandlers.get("contextmenu")?.({
      items: [{ label: "rename" }],
      posX: 10,
      posY: 20,
    });
    await nextTick();
    await nextTick();
    expect(storeMock.dialogActive).toBe(true);

    wrapper
      .get("[data-item-context-menu]")
      .element.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true }),
      );
    await Promise.resolve();
    expect(storeMock.dialogActive).toBe(true);

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    expect(storeMock.dialogActive).toBe(true);

    await Promise.resolve();
    expect(storeMock.dialogActive).toBe(false);
    wrapper.unmount();
  });

  it("stays open for pointers inside a select dropdown teleported to body", async () => {
    const wrapper = mountContextMenu();
    eventHandlers.get("contextmenu")?.({
      items: [{ label: "visualizer_options" }],
      posX: 10,
      posY: 20,
    });
    await nextTick();
    await nextTick();
    expect(storeMock.dialogActive).toBe(true);

    // A menu row's Select (e.g. the visualizer preset picker) teleports its
    // list to <body>; touching it to scroll starts with a pointerdown there.
    const selectContent = document.createElement("div");
    selectContent.setAttribute("data-slot", "select-content");
    const selectItem = document.createElement("div");
    selectContent.appendChild(selectItem);
    document.body.appendChild(selectContent);

    selectItem.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    await Promise.resolve();
    expect(storeMock.dialogActive).toBe(true);

    selectContent.remove();
    wrapper.unmount();
  });

  it("renders a subComponent item as a popout with its props", async () => {
    const popout = markRaw({
      props: ["playerId"],
      template: "<div data-test-popout>{{ playerId }}</div>",
    });
    const wrapper = mountContextMenu();
    eventHandlers.get("contextmenu")?.({
      items: [
        {
          label: "settings.visualizer_enabled.label",
          subComponent: popout,
          componentProps: { playerId: "kitchen" },
        },
      ],
      posX: 10,
      posY: 20,
    });
    await nextTick();
    await nextTick();

    // menuItemLabel resolves the label through the real i18n catalog
    expect(wrapper.text()).toContain("MilkDrop visualizer");
    expect(wrapper.get("[data-test-popout]").text()).toBe("kitchen");
    wrapper.unmount();
  });
});
