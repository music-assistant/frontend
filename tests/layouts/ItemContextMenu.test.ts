import ItemContextMenu from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
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
        DropdownMenu: passthroughStub,
        DropdownMenuContent: passthroughStub,
        DropdownMenuItem: passthroughStub,
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
});
