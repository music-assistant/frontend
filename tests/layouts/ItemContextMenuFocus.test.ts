import ItemContextMenu from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { eventHandlers, storeMock } = vi.hoisted(() => ({
  eventHandlers: new Map<string, (event: ContextMenuDialogEvent) => void>(),
  storeMock: {
    activePlayer: undefined,
    activePlayerId: undefined,
    dialogActive: false,
    showPlayersMenu: false,
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

enableAutoUnmount(afterEach);

let opener: HTMLButtonElement;

/** Reka restores focus a macrotask after the menu content unmounts. */
async function settle() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises();
}

async function openMenu(items: ContextMenuDialogEvent["items"]) {
  const wrapper = mount(ItemContextMenu, {
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  opener.focus();
  eventHandlers.get("contextmenu")?.({ items, posX: 10, posY: 20 });
  await settle();
  expect(document.querySelector("[data-item-context-menu]")).not.toBeNull();
  return wrapper;
}

function menuItem(label: string) {
  const item = [
    ...document.querySelectorAll<HTMLElement>("[role=menuitem]"),
  ].find((el) => el.textContent?.includes(label));
  if (!item) throw new Error(`no menu item ${label}`);
  return item;
}

describe("ItemContextMenu focus on close", () => {
  beforeEach(() => {
    eventHandlers.clear();
    storeMock.dialogActive = false;
    storeMock.showPlayersMenu = false;
    opener = document.createElement("button");
    document.body.appendChild(opener);
  });

  afterEach(() => {
    opener.remove();
  });

  it("hands focus back to the opener when closed with Escape", async () => {
    await openMenu([{ label: "rename" }]);
    expect(document.activeElement).not.toBe(opener);

    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settle();

    expect(document.querySelector("[data-item-context-menu]")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("hands focus back to the opener after selecting an item", async () => {
    const action = vi.fn();
    await openMenu([{ label: "rename", action }]);

    menuItem("rename").click();
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-item-context-menu]")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("hands focus back to the opener after selecting a submenu item", async () => {
    const action = vi.fn();
    await openMenu([
      { label: "more", subItems: [{ label: "sub_action", action }] },
    ]);

    const subTrigger = menuItem("more");
    subTrigger.focus();
    subTrigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await settle();
    menuItem("sub_action").click();
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-item-context-menu]")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("leaves focus where the selected action moved it", async () => {
    const field = document.createElement("input");
    document.body.appendChild(field);
    // like a dialog that focuses itself once the menu has gone
    const openDialog = () => setTimeout(() => field.focus(), 0);
    await openMenu([{ label: "rename", action: openDialog }]);

    menuItem("rename").click();
    await settle();

    expect(document.activeElement).toBe(field);
  });

  it("skips an opener the selected action removed", async () => {
    await openMenu([{ label: "drop_opener", action: () => opener.remove() }]);
    const focus = vi.spyOn(opener, "focus");

    menuItem("drop_opener").click();
    await settle();

    expect(focus).not.toHaveBeenCalled();
  });

  it("hands focus back after a left click outside a modal menu", async () => {
    await openMenu([{ label: "rename" }]);

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
    );
    await settle();

    expect(document.querySelector("[data-item-context-menu]")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("leaves focus alone after a right click outside", async () => {
    await openMenu([{ label: "rename" }]);
    const focus = vi.spyOn(opener, "focus");

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 2 }),
    );
    await settle();

    expect(document.querySelector("[data-item-context-menu]")).toBeNull();
    expect(focus).not.toHaveBeenCalled();
  });

  it("leaves focus alone after a click outside a non-modal menu", async () => {
    storeMock.showPlayersMenu = true;
    await openMenu([{ label: "rename" }]);
    const focus = vi.spyOn(opener, "focus");

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
    );
    await settle();

    expect(document.querySelector("[data-item-context-menu]")).toBeNull();
    expect(focus).not.toHaveBeenCalled();
  });
});
