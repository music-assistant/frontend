import FacetedFilter from "@/components/FacetedFilter.vue";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock } = vi.hoisted(() => ({
  storeMock: { isTouchscreen: false },
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

const stubs = {
  Popover: { template: "<div><slot /></div>" },
  PopoverTrigger: { template: "<div><slot /></div>" },
  PopoverContent: { template: "<div><slot /></div>" },
  Button: { template: "<button><slot /></button>" },
  Badge: { template: "<span><slot /></span>" },
  Separator: { template: "<span />" },
  Checkbox: { template: '<input type="checkbox" />' },
};

const STAGE_OPTIONS = [
  { label: "Stable", value: "stable" },
  { label: "Beta", value: "beta" },
  { label: "Alpha", value: "alpha" },
  { label: "Experimental", value: "experimental" },
  { label: "Unmaintained", value: "unmaintained" },
  { label: "Deprecated", value: "deprecated" },
];

const manyOptions = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    label: `Provider ${i}`,
    value: `provider-${i}`,
  }));

const mountFilter = (options: { label: string; value: string }[]) =>
  mount(FacetedFilter, {
    props: { title: "Providers", options, modelValue: [] },
    global: { stubs },
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

const closePopover = async (wrapper: VueWrapper) => {
  await toggleTrigger(wrapper);
  await vi.waitFor(() =>
    expect(document.querySelector("[data-slot='popover-content']")).toBeNull(),
  );
};

const mountAndOpen = async (options: { label: string; value: string }[]) => {
  const wrapper = mount(FacetedFilter, {
    props: { title: "Providers", options, modelValue: [] },
    attachTo: document.body,
  });
  return { wrapper, content: await openPopover(wrapper) };
};

// an open popover keeps document-level listeners, so tear it down even when an
// assertion fails
enableAutoUnmount(afterEach);

describe("FacetedFilter", () => {
  beforeEach(() => {
    storeMock.isTouchscreen = false;
    document.body.innerHTML = "";
  });

  it("toggles a focused option with Enter", async () => {
    const wrapper = mount(FacetedFilter, {
      props: {
        title: "Media type",
        options: [{ label: "Albums", value: "album" }],
        modelValue: [],
      },
      global: { stubs },
    });

    await wrapper.get(".faceted-filter-item").trigger("keydown.enter");

    expect(wrapper.emitted("update:modelValue")).toEqual([[["album"]]]);
  });

  it("omits the search field until the list is long enough to need it", () => {
    const short = mountFilter(STAGE_OPTIONS);
    expect(short.find("input[data-slot='input']").exists()).toBe(false);
    expect(short.findAll(".faceted-filter-item")).toHaveLength(
      STAGE_OPTIONS.length,
    );

    expect(
      mountFilter(manyOptions(8)).find("input[data-slot='input']").exists(),
    ).toBe(false);
    expect(
      mountFilter(manyOptions(9)).find("input[data-slot='input']").exists(),
    ).toBe(true);
  });

  it("filters the options with the search field", async () => {
    const wrapper = mountFilter(manyOptions(12));

    await wrapper.get("input[data-slot='input']").setValue("Provider 1");

    // "Provider 1" plus "Provider 10" and "Provider 11"
    expect(wrapper.findAll(".faceted-filter-item")).toHaveLength(3);

    // a term left behind must not keep filtering a list that lost its field
    await wrapper.setProps({ options: STAGE_OPTIONS });

    expect(wrapper.find("input[data-slot='input']").exists()).toBe(false);
    expect(wrapper.findAll(".faceted-filter-item")).toHaveLength(
      STAGE_OPTIONS.length,
    );
  });

  it("focuses the first option of a short list when it opens", async () => {
    const { content } = await mountAndOpen(STAGE_OPTIONS);

    expect(content.querySelector("input[data-slot='input']")).toBeNull();
    expect(document.activeElement).toBe(
      content.querySelector(".faceted-filter-item"),
    );
  });

  it("skips the search field of a long list on a touch device", async () => {
    storeMock.isTouchscreen = true;

    const { content } = await mountAndOpen(manyOptions(12));

    expect(content.querySelector("input[data-slot='input']")).not.toBeNull();
    expect(document.activeElement).toBe(content);
  });

  it("skips the search field on a touch device with nothing left to show", async () => {
    storeMock.isTouchscreen = true;
    const { wrapper, content } = await mountAndOpen(manyOptions(12));

    const field = content.querySelector<HTMLInputElement>(
      "input[data-slot='input']",
    )!;
    field.value = "no such provider";
    field.dispatchEvent(new Event("input"));
    await flushPromises();
    expect(content.querySelectorAll(".faceted-filter-item")).toHaveLength(0);

    // the term outlives the popover, so it reopens on an empty list
    await closePopover(wrapper);
    const reopened = await openPopover(wrapper);

    expect(document.activeElement).toBe(reopened);
  });

  it("focuses the search field of a long list on a desktop", async () => {
    const { content } = await mountAndOpen(manyOptions(12));

    expect(document.activeElement).toBe(
      content.querySelector("input[data-slot='input']"),
    );
  });
});
