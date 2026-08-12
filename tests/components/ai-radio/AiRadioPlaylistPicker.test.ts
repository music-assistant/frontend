import AiRadioPlaylistPicker from "@/components/ai-radio/AiRadioPlaylistPicker.vue";
import { useShows } from "@/composables/ai-radio/useShows";
import { playlist } from "../../fixtures/playlist";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  default: {
    sendCommand: vi.fn(async () => []),
    getLibraryPlaylists: vi.fn(async () => []),
  },
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    name: "MediaItemThumb",
    template: "<div />",
  },
}));

const PLAYLISTS = [
  playlist({ item_id: "1", name: "Jazz classics" }),
  playlist({ item_id: "2", name: "Road trip" }),
  playlist({ item_id: "3", name: "Sunday morning" }),
];

const mountPicker = () =>
  mount(AiRadioPlaylistPicker, { attachTo: document.body });

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

// the playlist rows are the only buttons inside the popover content
const rows = (content: Element) => content.querySelectorAll("button");

// an open popover keeps document-level listeners, so tear it down even when an
// assertion fails
enableAutoUnmount(afterEach);

describe("AiRadioPlaylistPicker", () => {
  beforeEach(() => {
    useShows().playlists.value = PLAYLISTS;
    document.body.innerHTML = "";
  });

  afterEach(() => {
    useShows().playlists.value = [];
  });

  it("filters the playlists with the search field", async () => {
    const content = await openPopover(mountPicker());

    await typeSearch(content, "jazz");

    expect(rows(content)).toHaveLength(1);
    expect(rows(content)[0].textContent).toContain("Jazz classics");
  });

  it("reopens on the full list after picking a playlist", async () => {
    const wrapper = mountPicker();
    const content = await openPopover(wrapper);

    await typeSearch(content, "jazz");
    rows(content)[0].click();
    await flushPromises();
    await waitForClose();

    expect(wrapper.emitted("update:modelValue")).toEqual([
      [{ itemId: "1", provider: "library", name: "Jazz classics" }],
    ]);
    expect(rows(await openPopover(wrapper))).toHaveLength(PLAYLISTS.length);
  });

  it("reopens on the full list after a search", async () => {
    const wrapper = mountPicker();
    const content = await openPopover(wrapper);

    await typeSearch(content, "no such playlist");
    expect(rows(content)).toHaveLength(0);

    await closePopover(wrapper);
    const reopened = await openPopover(wrapper);

    expect(
      reopened.querySelector<HTMLInputElement>("input[data-slot='input']")!
        .value,
    ).toBe("");
    expect(rows(reopened)).toHaveLength(PLAYLISTS.length);
  });
});
