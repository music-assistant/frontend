import LinkGenreDialog from "@/components/genre/LinkGenreDialog.vue";
import MergeGenreDialog from "@/components/genre/MergeGenreDialog.vue";
import { eventbus } from "@/plugins/eventbus";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component } from "vue";
import { genre } from "../../fixtures/genre";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    getLibraryGenres: vi.fn(),
    addGenreMediaMapping: vi.fn(),
    mergeGenres: vi.fn(),
  },
  storeMock: {
    isTouchscreen: false,
    dialogActive: false,
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  storeMock.isTouchscreen = false;
  storeMock.dialogActive = false;
  apiMock.getLibraryGenres.mockResolvedValue([
    genre({ item_id: "1", name: "Ambient" }),
    genre({ item_id: "2", name: "Jazz" }),
  ]);
  document.body.innerHTML = "";
});

const dialogs: Array<[string, Component, () => void]> = [
  [
    "LinkGenreDialog",
    LinkGenreDialog,
    () => eventbus.emit("linkGenreDialog", { items: [] }),
  ],
  [
    "MergeGenreDialog",
    MergeGenreDialog,
    () =>
      eventbus.emit("mergeGenreDialog", {
        genreIds: ["3"],
        genreNames: ["Downtempo"],
        genreContentTypes: [null],
      }),
  ],
];

describe.each(dialogs)("%s", (_name, component, open) => {
  it("focuses the genre search field on a non-touch device", async () => {
    await openGenrePicker(component, open);

    expect(document.activeElement).toBe(searchField());
  });

  it("leaves the genre search field alone on a touch device", async () => {
    storeMock.isTouchscreen = true;

    await openGenrePicker(component, open);

    // focusing the search field would open the on-screen keyboard over the
    // genre list
    expect(document.activeElement).not.toBe(searchField());
    // and the list has to stay up: focusing the popover itself would dismiss it
    expect(genreList()).not.toBeNull();
  });
});

function searchField() {
  return document.querySelector("[data-slot='command-input']");
}

function genreList() {
  return document.querySelector("[data-slot='popover-content']");
}

async function openGenrePicker(
  component: Component,
  open: () => void,
): Promise<VueWrapper> {
  const wrapper = mount(component, {
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  open();
  await flushPromises();

  // the dialog is teleported out of the wrapper, so it is only in the document
  document.querySelector<HTMLElement>("[role='combobox']")!.click();
  await flushPromises();
  // reka-ui focuses the command input from a 1ms timer, so a flush is not
  // enough to observe where focus ends up
  await new Promise((resolve) => setTimeout(resolve, 20));
  return wrapper;
}
