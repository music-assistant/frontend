import SmartPlaylistRuleValuePicker from "@/components/smart_playlist/SmartPlaylistRuleValuePicker.vue";
import SmartPlaylistSeedPicker from "@/components/smart_playlist/SmartPlaylistSeedPicker.vue";
import { $t } from "@/plugins/i18n";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component } from "vue";
import { track } from "../../fixtures/track";

const { storeMock } = vi.hoisted(() => ({
  storeMock: { isTouchscreen: false },
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("@/plugins/api", () => ({
  default: {
    getLibraryArtists: vi.fn(async () => []),
    getLibraryAlbums: vi.fn(async () => []),
  },
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    name: "MediaItemThumb",
    template: "<div />",
  },
}));

// reka opens the popover on pointerdown + click, and settles focus on a timer
// rather than a microtask
const openPopover = async (wrapper: VueWrapper) => {
  const trigger = wrapper.get("button");
  await trigger.trigger("pointerdown", { button: 0, pointerType: "mouse" });
  await trigger.trigger("click");
  await flushPromises();
  return await vi.waitFor(() => {
    const content = document.querySelector("[data-slot='popover-content']");
    expect(content).not.toBeNull();
    expect(content!.contains(document.activeElement)).toBe(true);
    return content!;
  });
};

const searchField = (content: Element) =>
  content.querySelector("input[data-slot='input']");

// an open popover keeps document-level listeners, so tear it down even when an
// assertion fails
enableAutoUnmount(afterEach);

// the seed picker puts its kind tabs above the search field, so the default
// focus of the two pickers lands on a different control. Its tabs are roving,
// so the one that takes focus is the active one rather than the first.
const pickers: Array<
  [string, Component, object, (c: Element) => Element | null, string]
> = [
  [
    "SmartPlaylistRuleValuePicker",
    SmartPlaylistRuleValuePicker,
    {
      source: "genre",
      selectedIds: [],
      preloadedOptions: [{ id: 1, name: "Ambient" }],
      addLabel: "Genre",
    },
    searchField,
    "Search genre",
  ],
  [
    "SmartPlaylistSeedPicker",
    SmartPlaylistSeedPicker,
    {
      kind: "album",
      searchQuery: "",
      results: [track({ item_id: "1", name: "Blue in Green" })],
      isSearching: false,
      isSubmitted: false,
      hasProvider: true,
      isFull: false,
    },
    (content: Element) =>
      content.querySelector("[role='tab'][data-state='active']"),
    "Search album",
  ],
];

describe.each(pickers)(
  "%s",
  (_name, component, props, firstControl, searchLabel) => {
    beforeEach(() => {
      storeMock.isTouchscreen = false;
      document.body.innerHTML = "";
    });

    it("focuses the first control on a non-touch device", async () => {
      const content = await openPopover(
        mount(component, { props, attachTo: document.body }),
      );

      expect(document.activeElement).toBe(firstControl(content));
    });

    it("focuses the popup itself on a touch device", async () => {
      storeMock.isTouchscreen = true;

      const content = await openPopover(
        mount(component, { props, attachTo: document.body }),
      );

      // no control inside the popup takes focus, so the search field cannot
      // raise the on-screen keyboard over the options
      expect(searchField(content)).not.toBeNull();
      expect(document.activeElement).not.toBe(firstControl(content));
      // the popup takes focus instead, so a screen reader announces it and the
      // tab order continues from there
      expect(document.activeElement).toBe(content);
    });

    it("names the search field after what it searches", async () => {
      const content = await openPopover(
        mount(component, { props, attachTo: document.body }),
      );

      expect(searchField(content)!.getAttribute("aria-label")).toBe(
        searchLabel,
      );
    });
  },
);

describe("SmartPlaylistSeedPicker search", () => {
  const seedProps = {
    kind: "album" as const,
    searchQuery: "blue",
    results: [],
    isSearching: false,
    isSubmitted: false,
    hasProvider: true,
    isFull: false,
  };

  const emptyState = (content: Element) =>
    content.querySelector("p")?.textContent?.trim();

  beforeEach(() => {
    storeMock.isTouchscreen = false;
    document.body.innerHTML = "";
  });

  it("emits submit on enter in the search field", async () => {
    const wrapper = mount(SmartPlaylistSeedPicker, {
      props: seedProps,
      attachTo: document.body,
    });
    const input = searchField(await openPopover(wrapper))!;

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(wrapper.emitted("submit")).toHaveLength(1);
  });

  it("ignores the enter that commits an IME composition", async () => {
    const wrapper = mount(SmartPlaylistSeedPicker, {
      props: seedProps,
      attachTo: document.body,
    });
    const input = searchField(await openPopover(wrapper))!;

    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        isComposing: true,
        bubbles: true,
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        keyCode: 229,
        bubbles: true,
      }),
    );

    expect(wrapper.emitted("submit")).toBeUndefined();
  });

  it("asks to type while the query is too short to submit", async () => {
    const content = await openPopover(
      mount(SmartPlaylistSeedPicker, {
        props: { ...seedProps, searchQuery: " b " },
        attachTo: document.body,
      }),
    );

    expect(emptyState(content)).toBe(
      $t("smart_playlist.picker_empty_search", { label: "album" }),
    );
  });

  it("prompts to press enter for a typed but unsubmitted query", async () => {
    const content = await openPopover(
      mount(SmartPlaylistSeedPicker, {
        props: seedProps,
        attachTo: document.body,
      }),
    );

    expect(emptyState(content)).toBe($t("command_center_press_enter"));
  });

  it("reports no match once the query is submitted", async () => {
    const content = await openPopover(
      mount(SmartPlaylistSeedPicker, {
        props: { ...seedProps, isSubmitted: true },
        attachTo: document.body,
      }),
    );

    expect(emptyState(content)).toBe(
      $t("smart_playlist.picker_empty_no_match", { label: "album" }),
    );
  });
});
