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

/** The menu hands focus back a macrotask after its content unmounts. */
async function settle() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises();
}

function press(target: Element | null, key: string) {
  target?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function pointerDown(target: Element, button = 0) {
  target.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, button }),
  );
}

function emitContextMenu(items: ContextMenuDialogEvent["items"]) {
  eventHandlers.get("contextmenu")?.({ items, posX: 10, posY: 20 });
}

/** Opens the menu from the focused opener, as a keyboard or pointer user. */
async function openMenu(
  items: ContextMenuDialogEvent["items"],
  via: "keyboard" | "pointer" = "keyboard",
) {
  const wrapper = mount(ItemContextMenu, {
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  opener.focus();
  if (via === "keyboard") press(opener, "Enter");
  else pointerDown(opener);
  emitContextMenu(items);
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

function menuIsOpen() {
  return document.querySelector("[data-item-context-menu]") !== null;
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

  describe("keyboard", () => {
    it("hands focus back to the opener when closed with Escape", async () => {
      await openMenu([{ label: "rename" }]);
      expect(document.activeElement).not.toBe(opener);

      press(document.activeElement, "Escape");
      await settle();

      expect(menuIsOpen()).toBe(false);
      expect(document.activeElement).toBe(opener);
    });

    it("hands focus back to the opener after selecting an item", async () => {
      const action = vi.fn();
      await openMenu([{ label: "rename", action }]);

      press(menuItem("rename"), "Enter");
      await settle();

      expect(action).toHaveBeenCalledTimes(1);
      expect(menuIsOpen()).toBe(false);
      expect(document.activeElement).toBe(opener);
    });

    it("hands focus back to the opener after selecting a submenu item", async () => {
      const action = vi.fn();
      await openMenu([
        { label: "more", subItems: [{ label: "sub_action", action }] },
      ]);

      const subTrigger = menuItem("more");
      subTrigger.focus();
      press(subTrigger, "ArrowRight");
      await settle();
      press(menuItem("sub_action"), "Enter");
      await settle();

      expect(action).toHaveBeenCalledTimes(1);
      expect(menuIsOpen()).toBe(false);
      expect(document.activeElement).toBe(opener);
    });

    it("keeps the first opener when the menu is opened again while open", async () => {
      await openMenu([{ label: "rename" }]);

      emitContextMenu([{ label: "other" }]);
      await settle();
      press(document.activeElement, "Escape");
      await settle();

      expect(menuIsOpen()).toBe(false);
      expect(document.activeElement).toBe(opener);
    });

    it("leaves focus where the selected action moved it", async () => {
      const field = document.createElement("input");
      document.body.appendChild(field);
      // like a dialog that focuses itself once the menu has gone
      const openDialog = () => setTimeout(() => field.focus(), 0);
      await openMenu([{ label: "rename", action: openDialog }]);

      press(menuItem("rename"), "Enter");
      await settle();

      expect(document.activeElement).toBe(field);
      field.remove();
    });

    it("skips an opener the selected action removed", async () => {
      await openMenu([{ label: "drop_opener", action: () => opener.remove() }]);
      const focus = vi.spyOn(opener, "focus");

      press(menuItem("drop_opener"), "Enter");
      await settle();

      expect(focus).not.toHaveBeenCalled();
    });
  });

  describe("pointer", () => {
    it("leaves focus alone after selecting an item", async () => {
      const action = vi.fn();
      await openMenu([{ label: "rename", action }], "pointer");
      const focus = vi.spyOn(opener, "focus");

      const item = menuItem("rename");
      pointerDown(item);
      item.click();
      await settle();

      expect(action).toHaveBeenCalledTimes(1);
      expect(menuIsOpen()).toBe(false);
      expect(focus).not.toHaveBeenCalled();
    });

    it("leaves focus alone after a click outside a modal menu", async () => {
      await openMenu([{ label: "rename" }]);
      const focus = vi.spyOn(opener, "focus");

      pointerDown(document.body);
      await settle();

      expect(menuIsOpen()).toBe(false);
      expect(focus).not.toHaveBeenCalled();
    });

    it("leaves focus alone after a click outside a non-modal menu", async () => {
      storeMock.showPlayersMenu = true;
      await openMenu([{ label: "rename" }]);
      const focus = vi.spyOn(opener, "focus");

      pointerDown(document.body);
      await settle();

      expect(menuIsOpen()).toBe(false);
      expect(focus).not.toHaveBeenCalled();
    });
  });
});
