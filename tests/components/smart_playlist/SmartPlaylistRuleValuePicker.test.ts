import SmartPlaylistRuleValuePicker from "@/components/smart_playlist/SmartPlaylistRuleValuePicker.vue";
import api from "@/plugins/api";
import type { Artist } from "@/plugins/api/interfaces";
import { artist } from "../../fixtures/artist";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  default: {
    getLibraryArtists: vi.fn(async () => []),
  },
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    name: "MediaItemThumb",
    template: "<div />",
  },
}));

const GENRES = [
  { id: 1, name: "Jazz" },
  { id: 2, name: "Rock" },
  { id: 3, name: "Reggae" },
];

const ARTISTS = [
  artist({ item_id: "10", name: "Beatles" }),
  artist({ item_id: "11", name: "Beach Boys" }),
];

const getLibraryArtists = vi.mocked(api.getLibraryArtists);

const mountPicker = (source: "genre" | "artist" = "genre") =>
  mount(SmartPlaylistRuleValuePicker, {
    props: {
      source,
      selectedIds: [],
      preloadedOptions: source === "genre" ? GENRES : [],
      addLabel: source === "genre" ? "Genre" : "Artist",
    },
    attachTo: document.body,
  });

// reka opens the popover on pointerdown + click, and settles focus on a timer
// rather than a microtask
const toggleTrigger = async (wrapper: VueWrapper) => {
  const trigger = wrapper.get("button");
  await trigger.trigger("pointerdown", { button: 0, pointerType: "mouse" });
  await trigger.trigger("click");
  await flushPromises();
};

// resolves with the popover content once it has settled its focus
const openPopover = async (wrapper: VueWrapper) => {
  await toggleTrigger(wrapper);
  return await vi.waitFor(() => {
    const content = document.querySelector("[data-slot='popover-content']");
    expect(content).not.toBeNull();
    expect(content!.contains(document.activeElement)).toBe(true);
    return content!;
  });
};

const waitForClose = async () =>
  await vi.waitFor(() =>
    expect(document.querySelector("[data-slot='popover-content']")).toBeNull(),
  );

const closePopover = async (wrapper: VueWrapper) => {
  await toggleTrigger(wrapper);
  await waitForClose();
};

// the field is portalled out of the wrapper, so drive the native input directly
const typeSearch = async (content: Element, term: string) => {
  const field = content.querySelector<HTMLInputElement>(
    "input[data-slot='input']",
  )!;
  field.value = term;
  field.dispatchEvent(new Event("input"));
  await flushPromises();
};

// the option rows are the only buttons inside the popover content
const rows = (content: Element) => content.querySelectorAll("button");

const searchTerm = (content: Element) =>
  content.querySelector<HTMLInputElement>("input[data-slot='input']")!.value;

const isSpinning = (content: Element) =>
  content.querySelector(".animate-spin") !== null;

let exitAnimation: HTMLStyleElement | undefined;
const nativeGetComputedStyle = window.getComputedStyle;

// reka keeps the closing content mounted while an exit animation runs, which is
// how the app's fade-out behaves. happy-dom runs none, so name one - and hand
// reka a plain snapshot of the computed style, since happy-dom throws when its
// live declaration is read through the reactive ref reka keeps it in.
const holdTheClosingAnimation = () => {
  exitAnimation = document.createElement("style");
  exitAnimation.textContent =
    "[data-slot='popover-content'][data-state='closed']{animation-name:popover-out}";
  document.head.appendChild(exitAnimation);

  window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
    const style = nativeGetComputedStyle.call(window, element, pseudo);
    return { animationName: style.animationName, display: style.display };
  }) as typeof window.getComputedStyle;
};

// an open popover keeps document-level listeners, so tear it down even when an
// assertion fails
enableAutoUnmount(afterEach);

describe("SmartPlaylistRuleValuePicker", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    getLibraryArtists.mockReset();
    getLibraryArtists.mockResolvedValue([]);
  });

  afterEach(() => {
    exitAnimation?.remove();
    exitAnimation = undefined;
    window.getComputedStyle = nativeGetComputedStyle;
  });

  it("filters the preloaded options with the search field", async () => {
    const content = await openPopover(mountPicker());

    await typeSearch(content, "jazz");

    expect(rows(content)).toHaveLength(1);
    expect(rows(content)[0].textContent).toContain("Jazz");
  });

  it("leaves the closing animation on the list the user last saw", async () => {
    holdTheClosingAnimation();
    const wrapper = mountPicker();
    const content = await openPopover(wrapper);

    await typeSearch(content, "jazz");
    expect(rows(content)).toHaveLength(1);

    await toggleTrigger(wrapper);
    await vi.waitFor(() =>
      expect(content.getAttribute("data-state")).toBe("closed"),
    );

    expect(rows(content)).toHaveLength(1);
  });

  it("reopens on the full list after a search", async () => {
    const wrapper = mountPicker();

    await typeSearch(await openPopover(wrapper), "no such genre");
    await closePopover(wrapper);
    const reopened = await openPopover(wrapper);

    expect(searchTerm(reopened)).toBe("");
    expect(rows(reopened)).toHaveLength(GENRES.length);
  });

  it("reopens on the full list after picking a value", async () => {
    const wrapper = mountPicker();
    const content = await openPopover(wrapper);

    await typeSearch(content, "jazz");
    rows(content)[0].click();
    await flushPromises();
    await waitForClose();

    expect(wrapper.emitted("add")).toEqual([[{ id: 1, name: "Jazz" }]]);

    // the rule row adds the picked value to its own list, so it comes back with
    // one option fewer
    await wrapper.setProps({ selectedIds: [1] });
    const reopened = await openPopover(wrapper);

    expect(searchTerm(reopened)).toBe("");
    expect(rows(reopened)).toHaveLength(GENRES.length - 1);
    expect(reopened.textContent).not.toContain("Jazz");
  });

  it("keeps a remote search that resolves after the close out of the next open", async () => {
    let deliverResults!: (results: Artist[]) => void;
    getLibraryArtists.mockReturnValueOnce(
      new Promise<Artist[]>((resolve) => {
        deliverResults = resolve;
      }),
    );

    const wrapper = mountPicker("artist");
    await typeSearch(await openPopover(wrapper), "bea");
    await vi.waitFor(() => expect(getLibraryArtists).toHaveBeenCalled());

    await closePopover(wrapper);
    const reopened = await openPopover(wrapper);

    deliverResults(ARTISTS);
    await flushPromises();

    expect(rows(reopened)).toHaveLength(0);
    expect(isSpinning(reopened)).toBe(false);
    expect(reopened.textContent).toContain("Type at least 2 characters");
  });

  it("drops a running remote search when it reopens", async () => {
    getLibraryArtists.mockReturnValueOnce(new Promise<Artist[]>(() => {}));

    const wrapper = mountPicker("artist");
    const content = await openPopover(wrapper);

    await typeSearch(content, "bea");
    await vi.waitFor(() => expect(isSpinning(content)).toBe(true));

    await closePopover(wrapper);
    const reopened = await openPopover(wrapper);

    expect(isSpinning(reopened)).toBe(false);
    expect(searchTerm(reopened)).toBe("");
  });
});
