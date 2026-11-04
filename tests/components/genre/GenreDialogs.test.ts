import LinkAliasDialog from "@/components/genre/LinkAliasDialog.vue";
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
import type { Genre } from "@/plugins/api/interfaces";
import { toast } from "vue-sonner";
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
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
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

  it("focuses the genre list itself on a touch device", async () => {
    storeMock.isTouchscreen = true;

    await openGenrePicker(component, open);

    // focusing the search field would open the on-screen keyboard over the
    // genre list
    expect(document.activeElement).not.toBe(searchField());
    // the list takes focus instead, so a screen reader announces it and the
    // tab order continues from there
    expect(genreList()).not.toBeNull();
    expect(document.activeElement).toBe(genreList());
  });
});

describe("LinkAliasDialog", () => {
  it("searches full genres so their aliases are listed", async () => {
    apiMock.getLibraryGenres.mockResolvedValue([
      genre({ name: "Ambient", genre_aliases: ["Dark Ambient"] }),
    ]);
    mountLinkAliasDialog();

    await searchAliases("ambient");

    expect(apiMock.getLibraryGenres).toHaveBeenCalledWith(
      expect.objectContaining({ search: "ambient", summary: false }),
    );
    expect(aliasOptions()).toEqual(["Dark Ambient"]);
  });

  it("drops the picked alias when the search is edited", async () => {
    apiMock.getLibraryGenres.mockResolvedValue([
      genre({ name: "Ambient", genre_aliases: ["Dark Ambient"] }),
    ]);
    mountLinkAliasDialog();
    await searchAliases("ambient");
    document.querySelector<HTMLElement>("[data-slot='combobox-item']")!.click();
    await flushPromises();
    expect(linkButton().disabled).toBe(false);

    await searchAliases("jazz");

    expect(linkButton().disabled).toBe(true);
  });

  it("shows an error when the search fails", async () => {
    apiMock.getLibraryGenres.mockRejectedValue(new Error("offline"));
    mountLinkAliasDialog();

    await searchAliases("ambient");

    expect(toast.error).toHaveBeenCalledWith("settings.error_loading_genres");
  });

  it("forgets the picked alias when the dialog closes", async () => {
    apiMock.getLibraryGenres.mockResolvedValue([
      genre({ name: "Ambient", genre_aliases: ["Dark Ambient"] }),
    ]);
    const wrapper = mountLinkAliasDialog();
    await searchAliases("ambient");
    document.querySelector<HTMLElement>("[data-slot='combobox-item']")!.click();
    await flushPromises();

    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    await flushPromises();

    expect(linkButton().disabled).toBe(true);
  });

  it("ignores the answer to an older search", async () => {
    let answerOlderSearch: (genres: Genre[]) => void = () => {};
    apiMock.getLibraryGenres
      .mockReturnValueOnce(
        new Promise<Genre[]>((resolve) => (answerOlderSearch = resolve)),
      )
      .mockResolvedValueOnce([
        genre({ name: "Jazz", genre_aliases: ["Jazz Fusion"] }),
      ]);
    mountLinkAliasDialog();

    await searchAliases("ambient");
    await searchAliases("jazz");
    answerOlderSearch([
      genre({ name: "Ambient", genre_aliases: ["Dark Ambient"] }),
    ]);
    await flushPromises();

    expect(aliasOptions()).toEqual(["Jazz Fusion"]);
  });
});

function linkButton() {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === "link_alias",
  )!;
}

function mountLinkAliasDialog() {
  return mount(LinkAliasDialog, {
    attachTo: document.body,
    props: { modelValue: true, genreItemId: "9", currentAliases: [] },
    global: { mocks: { $t: (key: string) => key } },
  });
}

async function searchAliases(text: string) {
  await flushPromises();
  const input = document.querySelector<HTMLInputElement>(
    "[data-slot='combobox-input']",
  )!;
  input.value = text;
  input.dispatchEvent(new Event("input"));
  // past the dialog's search throttle
  await new Promise((resolve) => setTimeout(resolve, 450));
  await flushPromises();
}

function aliasOptions() {
  return [...document.querySelectorAll("[data-slot='combobox-item']")].map(
    (item) => item.textContent?.trim(),
  );
}

function searchField() {
  return document.querySelector("[data-slot='command-input']");
}

function trigger() {
  return document.querySelector<HTMLElement>("[role='combobox']");
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
  // and a real click leaves the button focused
  trigger()!.focus();
  trigger()!.click();
  await flushPromises();
  // reka-ui focuses the command input from a 1ms timer, so a flush is not
  // enough to observe where focus ends up
  await new Promise((resolve) => setTimeout(resolve, 20));
  return wrapper;
}
