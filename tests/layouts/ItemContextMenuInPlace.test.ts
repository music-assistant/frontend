import ItemContextMenu from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { eventHandlers } = vi.hoisted(() => ({
  eventHandlers: new Map<string, (event: ContextMenuDialogEvent) => void>(),
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
  store: { dialogActive: false, showPlayersMenu: false },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => false },
}));

vi.mock("@/plugins/api", () => ({ default: { players: {} } }));

vi.mock("@/helpers/players", () => ({ playerVisible: () => true }));

enableAutoUnmount(afterEach);

let opener: HTMLButtonElement;

async function settle() {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises();
}

function emitContextMenu(event: Partial<ContextMenuDialogEvent>) {
  eventHandlers.get("contextmenu")?.({
    items: [
      {
        label: "queue",
        text: "Queue",
        subItems: [{ label: "queue_clear", text: "Clear" }],
      },
      { label: "stop_playback", text: "Stop" },
    ],
    ...event,
  });
}

function mountMenu() {
  return mount(ItemContextMenu, {
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
}

function menuLabels() {
  return [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].map(
    (el) => el.textContent?.trim(),
  );
}

function select(item: Element | null | undefined) {
  item?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
}

function menuItem(label: string) {
  return [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find(
    (el) => el.textContent?.trim() === label,
  );
}

describe("ItemContextMenu opened from a button", () => {
  beforeEach(() => {
    eventHandlers.clear();
    opener = document.createElement("button");
    document.body.appendChild(opener);
  });

  afterEach(() => {
    opener.remove();
  });

  it("replaces the menu with a submenu and goes back from it", async () => {
    mountMenu();
    emitContextMenu({ trigger: opener, inPlaceSubmenus: true });
    await settle();

    select(menuItem("Queue"));
    await settle();
    expect(menuLabels()).toEqual(["Queue", "Clear"]);
    expect(document.querySelector('[aria-label="Back"]')).not.toBeNull();

    select(document.querySelector('[aria-label="Back"]'));
    await settle();
    expect(menuLabels()).toEqual(["Queue", "Stop"]);
  });

  it("shows a submenu from its top", async () => {
    mountMenu();
    emitContextMenu({ trigger: opener, inPlaceSubmenus: true });
    await settle();
    const menu = document.querySelector<HTMLElement>(
      "[data-item-context-menu]",
    )!;
    menu.scrollTop = 120;

    select(menuItem("Queue"));
    await settle();
    expect(menu.scrollTop).toBe(0);
  });

  it.each([
    ["no entries", []],
    ["only hidden entries", [{ label: "stop_playback", hide: true }]],
  ])("does not open with %s", async (_, items) => {
    mountMenu();
    emitContextMenu({ trigger: opener, items });
    await settle();
    expect(document.querySelector("[data-item-context-menu]")).toBeNull();
  });

  it("closes when its button is pressed again, without opening again", async () => {
    mountMenu();
    emitContextMenu({ trigger: opener });
    await settle();

    // the press closes the menu, the click that follows opens it again
    opener.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    emitContextMenu({ trigger: opener });
    await settle();
    expect(document.querySelector("[data-item-context-menu]")).toBeNull();

    opener.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    emitContextMenu({ trigger: opener });
    await settle();
    expect(document.querySelector("[data-item-context-menu]")).not.toBeNull();
  });
});
