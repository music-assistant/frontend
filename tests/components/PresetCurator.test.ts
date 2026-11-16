/**
 * The curator lists every preset favourites-first, filters by search, previews
 * the clicked row and reports stars without changing the preview.
 */
import PresetCurator from "@/components/PresetCurator.vue";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/PresetPreviewCanvas.vue", () => ({
  default: {
    props: ["preset"],
    template: '<div data-test="preview">{{ preset }}</div>',
  },
}));

const hoverCapable = vi.hoisted(() => ({ value: true }));
vi.mock("@/helpers/visualizer/pointer", () => ({
  isHoverCapablePointer: () => hoverCapable.value,
}));

const HOVER_DWELL_MS = 150;
const NAMES = ["Beta", "alpha", "Gamma"];

const mountCurator = (favorites: string[] = []) =>
  mount(PresetCurator, { props: { presetNames: NAMES, favorites } });

const rowNames = (wrapper: ReturnType<typeof mountCurator>) =>
  wrapper.findAll("[data-test=preset-name]").map((row) => row.text());

describe("PresetCurator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hoverCapable.value = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists favourites first and previews the first row", () => {
    const wrapper = mountCurator(["Gamma"]);
    expect(rowNames(wrapper)).toEqual(["Gamma", "alpha", "Beta"]);
    expect(wrapper.get("[data-test=preview]").text()).toBe("Gamma");
  });

  it("does not report the seeded preview as a pick", () => {
    expect(mountCurator(["Gamma"]).emitted("update:previewed")).toBeUndefined();
  });

  it("filters by search text", async () => {
    const wrapper = mountCurator();
    await wrapper.get("input").setValue("ALP");
    expect(rowNames(wrapper)).toEqual(["alpha"]);
  });

  it("previews the clicked row", async () => {
    const wrapper = mountCurator();
    await wrapper.findAll("[data-test=preset-row]")[2].trigger("click");
    expect(wrapper.get("[data-test=preview]").text()).toBe("Gamma");
    expect(wrapper.emitted("update:previewed")?.at(-1)).toEqual(["Gamma"]);
  });

  it("previews from the keyboard through a focusable name button", async () => {
    const wrapper = mountCurator();
    const name = wrapper.findAll("[data-test=preset-name]")[2];
    expect(name.element.tagName).toBe("BUTTON");
    await name.trigger("click");
    expect(wrapper.emitted("update:previewed")?.at(-1)).toEqual(["Gamma"]);
  });

  it("emits the star toggle without moving the preview", async () => {
    const wrapper = mountCurator();
    await wrapper.findAll("button[aria-pressed]")[2].trigger("click");
    expect(wrapper.emitted("toggle-favorite")).toEqual([["Gamma"]]);
    expect(wrapper.get("[data-test=preview]").text()).toBe("alpha");
  });

  it("previews a hovered row after the dwell, then falls back to the clicked one", async () => {
    const wrapper = mountCurator();
    const rows = wrapper.findAll("[data-test=preset-row]");
    await rows[1].trigger("pointerenter");
    expect(wrapper.get("[data-test=preview]").text()).toBe("alpha");
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS);
    expect(wrapper.get("[data-test=preview]").text()).toBe("Beta");

    await wrapper.get("[data-test=preset-list]").trigger("pointerleave");
    expect(wrapper.get("[data-test=preview]").text()).toBe("alpha");
  });

  it("ignores hover on touch devices", async () => {
    hoverCapable.value = false;
    const wrapper = mountCurator();
    await wrapper.findAll("[data-test=preset-row]")[1].trigger("pointerenter");
    await vi.advanceTimersByTimeAsync(HOVER_DWELL_MS);
    expect(wrapper.get("[data-test=preview]").text()).toBe("alpha");
  });
});
