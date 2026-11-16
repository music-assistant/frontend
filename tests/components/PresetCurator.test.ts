/**
 * The curator lists every preset favourites-first, filters by search, previews
 * the clicked row and reports stars without changing the preview.
 */
import PresetCurator from "@/components/PresetCurator.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/PresetPreviewCanvas.vue", () => ({
  default: {
    props: ["preset"],
    template: '<div data-test="preview">{{ preset }}</div>',
  },
}));

const NAMES = ["Beta", "alpha", "Gamma"];

const mountCurator = (favorites: string[] = []) =>
  mount(PresetCurator, { props: { presetNames: NAMES, favorites } });

const rowNames = (wrapper: ReturnType<typeof mountCurator>) =>
  wrapper.findAll("[data-test=preset-name]").map((row) => row.text());

describe("PresetCurator", () => {
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
});
