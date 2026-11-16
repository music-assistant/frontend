import ItemContextMenu from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { mount } from "@vue/test-utils";
import { markRaw, nextTick } from "vue";
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

  it("shows the text of an item as it is, never as a translation", async () => {
    const wrapper = mountContextMenu();
    eventHandlers.get("contextmenu")?.({
      items: [
        { label: "provider_menu_action/demo/a", text: "show_info" },
        {
          label: "provider_menu_action/demo/b",
          text: "{0} @:show_info <b>bold</b>",
        },
      ],
      posX: 10,
      posY: 20,
    });
    await nextTick();
    await nextTick();

    const rows = wrapper.findAll("span.truncate").map((row) => row.text());
    expect(rows).toEqual(["show_info", "{0} @:show_info <b>bold</b>"]);
    expect(wrapper.find("b").exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows a plugin's entries as they are in a submenu under its name, cut off as the other entries", async () => {
    // a translated label may be 80 characters long
    const long =
      "Ask the demo plugin about this track and all it knows about it, all at once, now";
    expect(long).toHaveLength(80);
    const wrapper = mountContextMenu();
    eventHandlers.get("contextmenu")?.({
      items: [
        {
          label: "provider_menu/demo",
          text: "{0} @:show_info",
          subItems: [
            { label: "provider_menu_action/demo/a", text: long },
            {
              label: "provider_menu_action/demo/b",
              text: "Send to the frame",
              disabled: true,
            },
          ],
        },
      ],
      posX: 10,
      posY: 20,
    });
    await nextTick();
    await nextTick();

    const lines = wrapper.findAll("span.truncate");
    expect(lines.map((line) => line.text())).toEqual([
      "{0} @:show_info",
      long,
      "Send to the frame",
    ]);
    expect(lines.every((line) => line.classes().includes("min-w-0"))).toBe(
      true,
    );
    // the submenu is capped as the menu, so a long entry is cut off on a phone
    expect(lines[1].element.parentElement!.parentElement!.classList).toContain(
      "max-w-[min(92vw,350px)]",
    );
    expect(lines[2].element.parentElement!.getAttribute("disabled")).toBe(
      "true",
    );
    wrapper.unmount();
  });

  it("keeps a long menu within the room the screen leaves, scrolling the rest", async () => {
    const wrapper = mountContextMenu();
    eventHandlers.get("contextmenu")?.({
      items: [{ label: "show_info" }],
      posX: 10,
      posY: 20,
    });
    await nextTick();

    expect(wrapper.get("[data-item-context-menu]").classes()).toEqual(
      expect.arrayContaining([
        "max-h-[min(85vh,var(--reka-dropdown-menu-content-available-height))]",
        "overflow-y-auto",
      ]),
    );
    wrapper.unmount();
  });
});
